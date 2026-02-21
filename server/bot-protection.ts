import type { Express, NextFunction, Request, RequestHandler, Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { botVerificationInputSchema } from "@shared/schema";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const MIN_HUMAN_FILL_MS = 1_500;
const MAX_FORM_AGE_MS = 45 * 60 * 1_000;

const BLOCKED_USER_AGENT_PATTERN =
  /(curl|wget|python-requests|libwww-perl|scrapy|go-http-client|httpclient|postmanruntime|insomnia|nikto|sqlmap|nmap|masscan)/i;

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

type TurnstileVerificationResult =
  | { ok: true }
  | { ok: false; statusCode: 403 | 503; message: string };

function isStrictBotModeEnabled(): boolean {
  return process.env.NODE_ENV === "production" || process.env.BOT_PROTECTION_STRICT === "true";
}

function getTurnstileSecret(): string {
  return process.env.TURNSTILE_SECRET_KEY?.trim() ?? "";
}

function getAllowedTurnstileHostnames(): string[] {
  return (process.env.TURNSTILE_ALLOWED_HOSTNAMES ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function getApiClientAddress(req: Request): string {
  const fallbackIp = req.ip ?? "";
  if (Array.isArray(req.ips) && req.ips.length > 0) {
    return req.ips[0] ?? fallbackIp;
  }
  return fallbackIp;
}

async function verifyTurnstileToken(
  token: string,
  remoteIp: string,
  hostHeader: string | undefined,
): Promise<TurnstileVerificationResult> {
  const turnstileSecret = getTurnstileSecret();
  const strictMode = isStrictBotModeEnabled();

  if (!turnstileSecret) {
    if (strictMode) {
      return {
        ok: false,
        statusCode: 503,
        message: "Bot protection is not configured on the server.",
      };
    }

    return { ok: true };
  }

  if (!token) {
    return {
      ok: false,
      statusCode: 403,
      message: "Security challenge is required.",
    };
  }

  const requestBody = new URLSearchParams();
  requestBody.set("secret", turnstileSecret);
  requestBody.set("response", token);
  if (remoteIp) {
    requestBody.set("remoteip", remoteIp);
  }

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 5_000);

  try {
    const verificationResponse = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: requestBody.toString(),
      signal: abortController.signal,
    });

    if (!verificationResponse.ok) {
      return {
        ok: false,
        statusCode: 403,
        message: "Unable to verify security challenge.",
      };
    }

    const verificationData = (await verificationResponse.json()) as {
      success?: boolean;
      hostname?: string;
    };

    if (!verificationData.success) {
      return {
        ok: false,
        statusCode: 403,
        message: "Security challenge failed.",
      };
    }

    const configuredHostnames = getAllowedTurnstileHostnames();
    if (
      configuredHostnames.length > 0 &&
      verificationData.hostname &&
      !configuredHostnames.includes(verificationData.hostname.toLowerCase())
    ) {
      return {
        ok: false,
        statusCode: 403,
        message: "Security challenge hostname check failed.",
      };
    }

    if (
      strictMode &&
      configuredHostnames.length === 0 &&
      hostHeader &&
      verificationData.hostname &&
      verificationData.hostname.toLowerCase() !== hostHeader.split(":")[0]?.toLowerCase()
    ) {
      return {
        ok: false,
        statusCode: 403,
        message: "Security challenge host mismatch.",
      };
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      statusCode: 403,
      message: "Security verification service is unavailable.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

function mutatingApiIntegrityGuard(req: Request, res: Response, next: NextFunction) {
  if (!MUTATING_METHODS.has(req.method)) {
    next();
    return;
  }

  const userAgent = req.get("user-agent") ?? "";
  if (!userAgent || BLOCKED_USER_AGENT_PATTERN.test(userAgent)) {
    res.status(403).json({ message: "Automated traffic is blocked." });
    return;
  }

  const secFetchSite = req.get("sec-fetch-site");
  if (secFetchSite && secFetchSite.toLowerCase() === "cross-site") {
    res.status(403).json({ message: "Cross-site requests are blocked." });
    return;
  }

  const originHeader = req.get("origin");
  const hostHeader = req.get("host");

  if (originHeader && hostHeader) {
    try {
      const originHost = new URL(originHeader).host;
      if (originHost !== hostHeader) {
        res.status(403).json({ message: "Origin mismatch." });
        return;
      }
    } catch {
      res.status(403).json({ message: "Invalid origin header." });
      return;
    }
  }

  next();
}

export const sensitiveWriteLimiter = rateLimit({
  windowMs: 10 * 60 * 1_000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many submission attempts. Please try again later." },
});

export const verifyBotProtectedSubmission: RequestHandler = async (req, res, next) => {
  try {
    const parsed = botVerificationInputSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid bot protection payload.",
        field: parsed.error.errors[0]?.path.join(".") ?? "body",
      });
      return;
    }

    const formData = parsed.data;
    const honeypotValue = (formData.website ?? "").trim();
    if (honeypotValue.length > 0) {
      res.status(403).json({ message: "Suspicious form submission detected." });
      return;
    }

    const elapsedMs = Date.now() - formData.formStartedAt;
    if (elapsedMs < MIN_HUMAN_FILL_MS || elapsedMs > MAX_FORM_AGE_MS) {
      res.status(403).json({ message: "Invalid form submission timing." });
      return;
    }

    const verification = await verifyTurnstileToken(
      formData.botToken?.trim() ?? "",
      getApiClientAddress(req),
      req.get("host"),
    );

    if (!verification.ok) {
      res.status(verification.statusCode).json({ message: verification.message });
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
};

export function applyGlobalBotProtection(app: Express) {
  app.set("trust proxy", 1);

  app.use(
    helmet({
      contentSecurityPolicy: process.env.NODE_ENV === "production" ? undefined : false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.use(
    rateLimit({
      windowMs: 60 * 1_000,
      max: process.env.NODE_ENV === "production" ? 400 : 4_000,
      standardHeaders: true,
      legacyHeaders: false,
      message: { message: "Too many requests from this IP. Please retry shortly." },
    }),
  );

  app.use(
    "/api",
    rateLimit({
      windowMs: 60 * 1_000,
      max: process.env.NODE_ENV === "production" ? 100 : 1_000,
      standardHeaders: true,
      legacyHeaders: false,
      message: { message: "API rate limit exceeded. Please slow down." },
    }),
    mutatingApiIntegrityGuard,
  );
}
