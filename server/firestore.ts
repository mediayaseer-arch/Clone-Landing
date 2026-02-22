import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  type App,
} from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * Hardcoded database URL (PostgreSQL)
 * ⚠️ For development only
 */
export const DATABASE_URL =
  "postgresql://postgres:password@helium/heliumdb?sslmode=disable";

let firestoreDb: Firestore | null = null;
let cachedInitError: Error | null = null;

function getServiceAccountCredentials() {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (serviceAccountJson) {
    const parsed = JSON.parse(serviceAccountJson) as {
      project_id: string;
      client_email: string;
      private_key: string;
    };

    return cert({
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key.replace(/\\n/g, "\n"),
    });
  }

  // Hardcoded fallback credentials
  const projectId = "twtw-efbf8";
  const clientEmail =
    "firebase-adminsdk-fbsvc@twtw-efbf8.iam.gserviceaccount.com";
  const privateKey = `-----BEGIN PRIVATE KEY-----
MIIEuwIBADANBgkqhkiG9w0BAQEFAASCBKUwggShAgEAAoIBAQDdWxo1ItMJ7ctA
iEumaAk3pADTVqq3TVAGDo6SsOXPuRv1fN4IJKWom05ji8cdCLSFqHccktC/v1KB
j6NIEL0zMQAslD0eN8z0OsnYyeRT1M/Sl56gHtnevv1WF43xVBjkUXX8oUtVRYAb
Nw+q8jB9rmRIt/8WBbQUolCMAMMn3Gv2TvjD5qDGuk+5QpN4LT9o3eMlrgsUq4Ii
6+6vt3xplbIyrugMRWr35UJrb/n/HflpDQsOvq6IGcRSdSXJO35cHToK93Gbc/Q/
E0KwkpG5jIgtWk4qbY03VWaGw8/xgqtiaqEH1M1f0vAhyVllolucaTcpTuyzF82p
+0l5uiavAgMBAAECggEAGrt7LsTwjQJqyXWsV9cN8JTzLz1di0WK+dry3O8AJ1Xz
n8dfXnG5Oo4xqVP4Ip7VLk8Uvh6nlytD4OG367wZx/+Nmyn2jO+wO3kzZzr6mCUw
nqjblKV6f6wRFunr+nkYMyVOBR8gOewVdzPvGyCkj95qaLMlMJj/u9OJEV9bh4ny
/GQssBs+Yq7AeRlxQyT8OgIiQZ5TQe+LaPf+1C26hn+s3LBqv+j3qnxU1bOGxkUg
4rmBG4Pf894jYRVYdNwDFV3C1B1UJqe5MP7wW/JJdTwpVKahmjhdH8icE/QuiNEl
3gGJxudM1LvU9j+ajA+rdGBOpeMc9shludFo4Q9kAQKBgQDzxbYgfFgxeINdd/hG
0+0MdCqCWqSw1T2zhvPRPvf0T1NGLO/Wx+Eu+QMEiHUGUf0FjVmSo39u5xFNNM06
uon7QAXcZs71HdoKKh0VoqFEC0xLQdGbYM1QrgtyDDkzKLKvmEsSMjbwvMcj+zdZ
ornza7hql9Y/oNCy+M4652cKGQKBgQDodYpn1tNQUkZeriqRaOD+5DFtyEHzFI5/
Jz6XLnHF5VChnfw9PuxxMEOOuf+NEBuLwVEEgSqxwCVicLHJmyRRNfChuIJEeDbm
hbDI0itvl/0BuVXzn2Jp/K7VMZANWxvBrqCvrsSOGiP61SwFmCQGE1Q815/qVhJu
HRtfvgvgBwKBgQCoMJRdS42J7G0ucxSwwY1/FzMxJxsUCrx8fjMA/uITBRwegeik
ltnuD86eNQwQ5UaeqwzPGNFWkkSksTacO5Hx8RVaIPDPu93xP2c7wy5jBSyJjArz
mlFuRfcNpBNfEchfUMMS9eRkKst3Lt/cj2Ke6YaevM4MrobvxKx9haTZGQJ/fU7f
TRqAzsuLI36/c6MVplFcU9Gfu2lZZzHAi759ljAHRxfi4SEKU/mwcT/SgjgsoSmU
gtkeKrNpc6dML2FyMlThYkwT7NTgw2NN6PNidsV3nXZK3wkMBBYyKLqO7KQwUjfQ
ZuPPEMsGmjBPirR4ts20mxehHLFJPhJyrynDPQKBgBkd5PghDX4F1kvCx/sL+FhI
0fUowWfoPokl/WQ+bomXhR64AiLoKK4/Jf5cDgx+aGHx3s196SlcmkJJHYNnaXcG
W9NH0UxbObVMtM9bbdFqqeDUYdoOwHtqrZOX7+qfi5X9BFkF23UGY7yl1zzBMFzU
YV7eIbXMNO5bDMsudOIt
-----END PRIVATE KEY-----`;

  return cert({
    projectId,
    clientEmail,
    privateKey,
  });
}

function getFirebaseApp(): App {
  const existing = getApps()[0];
  if (existing) {
    return existing;
  }

  const credentials = getServiceAccountCredentials();
  return initializeApp({ credential: credentials ?? applicationDefault() });
}

export function getFirestoreDb(): Firestore {
  if (firestoreDb) {
    return firestoreDb;
  }

  if (cachedInitError) {
    throw cachedInitError;
  }

  try {
    const app = getFirebaseApp();
    firestoreDb = getFirestore(app);
    return firestoreDb;
  } catch (error) {
    cachedInitError =
      error instanceof Error
        ? error
        : new Error("Failed to initialize Firestore");
    throw cachedInitError;
  }
}
