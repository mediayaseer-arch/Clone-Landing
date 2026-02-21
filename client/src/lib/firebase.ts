import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  ReCaptchaV3Provider,
  initializeAppCheck,
} from "firebase/app-check";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import {
  checkoutSubmissionSchema,
  type CheckoutStatusUpdateInput,
  type CheckoutSubmission,
  type CheckoutSubmissionInput,
} from "@shared/schema";

const firebaseConfig = {
  apiKey: "AIzaSyAZ-QH9QBmUHTVowsfYoK0BU1JMKd9pL-o",
  authDomain: "dryah-875c0.firebaseapp.com",
  databaseURL: "https://dryah-875c0-default-rtdb.firebaseio.com",
  projectId: "dryah-875c0",
  storageBucket: "dryah-875c0.firebasestorage.app",
  messagingSenderId: "4984579245",
  appId: "1:4984579245:web:819acd24e59d94fa0b9224",
  measurementId: "G-DVKDRKT0S6",
};

const CHECKOUT_COLLECTION = "pays";
const appCheckSiteKey = (import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY as string | undefined)?.trim();
const appCheckDebugToken = (import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN as string | undefined)?.trim();

function initializeFirebase() {
  if (typeof window === "undefined") {
    return null;
  }

  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.warn(
      "Firebase configuration is incomplete. Some features may not work.",
    );
    return null;
  }

  return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
}

function mapCheckoutDocument(id: string, data: DocumentData): CheckoutSubmission | null {
  const parsed = checkoutSubmissionSchema.safeParse({
    id,
    billing: data.billing,
    visitDateIso: data.visitDateIso ?? null,
    visitTime: data.visitTime ?? null,
    items: data.items ?? [],
    subtotal: data.subtotal ?? 0,
    total: data.total ?? 0,
    payment: data.payment,
    createdAt: typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString(),
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : new Date().toISOString(),
  });

  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}

function ensureVisitorId(): string {
  if (typeof window === "undefined") {
    throw new Error("Visitor ID is only available in the browser.");
  }

  const existing = window.localStorage.getItem("visitor");
  if (existing) {
    return existing;
  }

  const generated =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `visitor-${Date.now()}`;

  window.localStorage.setItem("visitor", generated);
  return generated;
}

function initializeFirebaseAppCheck(firebaseApp: FirebaseApp) {
  if (typeof window === "undefined") {
    return;
  }

  if (appCheckDebugToken) {
    (
      globalThis as typeof globalThis & {
        FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean;
      }
    ).FIREBASE_APPCHECK_DEBUG_TOKEN =
      appCheckDebugToken === "true" ? true : appCheckDebugToken;
  }

  if (!appCheckSiteKey) {
    if (import.meta.env.PROD) {
      console.warn(
        "Firebase App Check site key is not configured. Bot protection is reduced.",
      );
    }
    return;
  }

  try {
    initializeAppCheck(firebaseApp, {
      provider: new ReCaptchaV3Provider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (error) {
    console.error("Failed to initialize Firebase App Check:", error);
  }
}

function assertAppCheckIsReadyForWrites() {
  if (import.meta.env.PROD && !appCheckSiteKey) {
    throw new Error(
      "Security configuration is missing. Please contact support before submitting data.",
    );
  }
}

const app = initializeFirebase();
if (app) {
  initializeFirebaseAppCheck(app);
}
const db = app ? getFirestore(app) : null;
const auth = app ? getAuth(app) : null;

export const loginWithEmail = async (email: string, password: string) => {
  if (!auth) {
    throw new Error("Auth not initialized");
  }
  return signInWithEmailAndPassword(auth, email, password);
};

export const logoutUser = async () => {
  if (!auth) {
    return;
  }
  return signOut(auth);
};

export const onAuthChange = (callback: (user: User | null) => void) => {
  if (!auth) {
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
};

export async function createCheckoutSubmission(
  data: CheckoutSubmissionInput,
): Promise<CheckoutSubmission> {
  assertAppCheckIsReadyForWrites();

  if (!db) {
    throw new Error("Firebase not initialized. Cannot add data.");
  }

  const id = ensureVisitorId();
  const docRef = doc(db, CHECKOUT_COLLECTION, id);
  const now = new Date().toISOString();

  await setDoc(
    docRef,
    {
      ...data,
      createdAt: now,
      updatedAt: now,
    },
    { merge: true },
  );

  return checkoutSubmissionSchema.parse({
    id,
    ...data,
    createdAt: now,
    updatedAt: now,
  });
}

export async function getCheckoutSubmission(id: string): Promise<CheckoutSubmission | null> {
  if (!db) {
    throw new Error("Firebase not initialized. Cannot read data.");
  }

  const snapshot = await getDoc(doc(db, CHECKOUT_COLLECTION, id));
  if (!snapshot.exists()) {
    return null;
  }

  return mapCheckoutDocument(snapshot.id, snapshot.data());
}

export async function listCheckoutSubmissions(maxItems = 300): Promise<CheckoutSubmission[]> {
  if (!db) {
    throw new Error("Firebase not initialized. Cannot list data.");
  }

  const recordsQuery = query(
    collection(db, CHECKOUT_COLLECTION),
    orderBy("createdAt", "desc"),
    limit(maxItems),
  );

  const snapshot = await getDocs(recordsQuery);
  return snapshot.docs
    .map((record) => mapCheckoutDocument(record.id, record.data()))
    .filter((record): record is CheckoutSubmission => record !== null);
}

export async function updateCheckoutSubmissionStatus(
  id: string,
  update: CheckoutStatusUpdateInput,
): Promise<CheckoutSubmission> {
  assertAppCheckIsReadyForWrites();

  if (!db) {
    throw new Error("Firebase not initialized. Cannot update data.");
  }

  const docRef = doc(db, CHECKOUT_COLLECTION, id);
  const existingSnapshot = await getDoc(docRef);

  if (!existingSnapshot.exists()) {
    throw new Error(`Checkout submission ${id} was not found`);
  }

  const currentData = existingSnapshot.data();
  const currentPayment =
    currentData && typeof currentData.payment === "object" && currentData.payment
      ? currentData.payment
      : {};

  await setDoc(
    docRef,
    {
      payment: {
        ...currentPayment,
        status: update.status,
        otpCode: update.otpCode ?? null,
        errorMessage: update.errorMessage ?? null,
      },
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );

  const updatedSnapshot = await getDoc(docRef);
  if (!updatedSnapshot.exists()) {
    throw new Error(`Checkout submission ${id} was not found after update`);
  }

  const mapped = mapCheckoutDocument(updatedSnapshot.id, updatedSnapshot.data());
  if (!mapped) {
    throw new Error("Updated checkout submission has invalid format");
  }

  return mapped;
}

export function listenForSubmissionStatus(
  id: string,
  callback: (record: CheckoutSubmission | null) => void,
): Unsubscribe {
  if (!db) {
    callback(null);
    return () => {};
  }

  const docRef = doc(db, CHECKOUT_COLLECTION, id);
  return onSnapshot(docRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }

    callback(mapCheckoutDocument(snapshot.id, snapshot.data()));
  });
}

export { db, auth };
