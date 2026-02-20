import { applicationDefault, cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

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

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  return cert({
    projectId,
    clientEmail,
    privateKey: privateKey.replace(/\\n/g, "\n"),
  });
}

function getFirebaseApp(): App {
  const existing = getApps()[0];
  if (existing) {
    return existing;
  }

  const credentials = getServiceAccountCredentials();
  if (credentials) {
    return initializeApp({ credential: credentials });
  }

  return initializeApp({ credential: applicationDefault() });
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
    cachedInitError = error instanceof Error
      ? error
      : new Error("Failed to initialize Firestore");
    throw cachedInitError;
  }
}
