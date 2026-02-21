import type { Express, Request, Response } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import {
  CheckoutSubmissionNotFoundError,
  createCheckoutSubmission,
  listCheckoutSubmissions,
  updateCheckoutSubmissionStatus,
} from "./checkout-storage";

type CheckoutRealtimeEvent = {
  type: "created" | "status_updated";
  submissionId: string;
  status?: "otp_requested" | "otp_failed" | "otp_verified";
  at: string;
};

const checkoutStreamClients = new Set<Response>();

function writeSseEvent(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function broadcastCheckoutChange(event: CheckoutRealtimeEvent): void {
  checkoutStreamClients.forEach((client) => {
    if (client.writableEnded) {
      checkoutStreamClients.delete(client);
      return;
    }

    writeSseEvent(client, "checkout_changed", event);
  });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get(api.checkout.stream.path, (req: Request, res: Response) => {
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    if (typeof res.flushHeaders === "function") {
      res.flushHeaders();
    }

    checkoutStreamClients.add(res);
    writeSseEvent(res, "ready", { at: new Date().toISOString() });

    const heartbeat = setInterval(() => {
      if (res.writableEnded) {
        return;
      }

      writeSseEvent(res, "ping", { at: new Date().toISOString() });
    }, 25000);

    req.on("close", () => {
      clearInterval(heartbeat);
      checkoutStreamClients.delete(res);
    });
  });

  app.post(api.newsletter.subscribe.path, async (req, res) => {
    try {
      const input = api.newsletter.subscribe.input.parse(req.body);
      const subscriber = await storage.createSubscriber(input);
      res.status(201).json(subscriber);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      
      if (err instanceof Error && err.message.includes('unique constraint')) {
        return res.status(400).json({ message: "This email is already subscribed!" });
      }
      throw err;
    }
  });

  app.post(api.checkout.create.path, async (req, res) => {
    try {
      const input = api.checkout.create.input.parse(req.body);
      const submission = await createCheckoutSubmission(input);
      broadcastCheckoutChange({
        type: "created",
        submissionId: submission.id,
        status: submission.payment.status,
        at: new Date().toISOString(),
      });
      res.status(201).json(submission);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }

      if (err instanceof Error) {
        return res.status(500).json({
          message: `Unable to save checkout data to Firestore: ${err.message}`,
        });
      }

      throw err;
    }
  });

  app.get(api.checkout.list.path, async (_req, res) => {
    try {
      const submissions = await listCheckoutSubmissions();
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.status(200).json(submissions);
    } catch (err) {
      if (err instanceof Error) {
        return res.status(500).json({
          message: `Unable to read checkout data from Firestore: ${err.message}`,
        });
      }
      throw err;
    }
  });

  app.patch(api.checkout.updateStatus.path, async (req, res) => {
    try {
      const { id } = api.checkout.updateStatus.params.parse(req.params);
      const input = api.checkout.updateStatus.input.parse(req.body);
      const updated = await updateCheckoutSubmissionStatus(id, input);
      broadcastCheckoutChange({
        type: "status_updated",
        submissionId: updated.id,
        status: updated.payment.status,
        at: new Date().toISOString(),
      });
      res.status(200).json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }

      if (err instanceof CheckoutSubmissionNotFoundError) {
        return res.status(404).json({ message: "Checkout record not found." });
      }

      if (err instanceof Error) {
        return res.status(500).json({
          message: `Unable to update checkout data in Firestore: ${err.message}`,
        });
      }
      throw err;
    }
  });

  return httpServer;
}
