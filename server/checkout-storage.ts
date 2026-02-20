import { Timestamp, type DocumentData } from "firebase-admin/firestore";
import {
  checkoutSubmissionSchema,
  type CheckoutStatusUpdateInput,
  type CheckoutSubmission,
  type CheckoutSubmissionInput,
} from "@shared/schema";
import { getFirestoreDb } from "./firestore";

const CHECKOUT_COLLECTION = "checkout_submissions";

export class CheckoutSubmissionNotFoundError extends Error {
  constructor(id: string) {
    super(`Checkout submission ${id} was not found`);
    this.name = "CheckoutSubmissionNotFoundError";
  }
}

function toIsoString(value: unknown): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }

  if (value && typeof value === "object" && "toDate" in value) {
    const candidate = value as { toDate: () => Date };
    return candidate.toDate().toISOString();
  }

  return new Date().toISOString();
}

function mapDocument(id: string, data: DocumentData): CheckoutSubmission {
  return checkoutSubmissionSchema.parse({
    id,
    billing: data.billing,
    visitDateIso: data.visitDateIso ?? null,
    visitTime: data.visitTime ?? null,
    items: data.items ?? [],
    subtotal: data.subtotal ?? 0,
    total: data.total ?? 0,
    payment: data.payment,
    createdAt: toIsoString(data.createdAt),
    updatedAt: toIsoString(data.updatedAt),
  });
}

export async function createCheckoutSubmission(
  input: CheckoutSubmissionInput,
): Promise<CheckoutSubmission> {
  const firestore = getFirestoreDb();
  const docRef = firestore.collection(CHECKOUT_COLLECTION).doc();
  const now = Timestamp.now();

  await docRef.set({
    ...input,
    createdAt: now,
    updatedAt: now,
  });

  return checkoutSubmissionSchema.parse({
    ...input,
    id: docRef.id,
    createdAt: now.toDate().toISOString(),
    updatedAt: now.toDate().toISOString(),
  });
}

export async function listCheckoutSubmissions(limit = 300): Promise<CheckoutSubmission[]> {
  const firestore = getFirestoreDb();
  const snapshot = await firestore
    .collection(CHECKOUT_COLLECTION)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => mapDocument(doc.id, doc.data()));
}

export async function updateCheckoutSubmissionStatus(
  id: string,
  update: CheckoutStatusUpdateInput,
): Promise<CheckoutSubmission> {
  const firestore = getFirestoreDb();
  const docRef = firestore.collection(CHECKOUT_COLLECTION).doc(id);
  const existingSnapshot = await docRef.get();

  if (!existingSnapshot.exists) {
    throw new CheckoutSubmissionNotFoundError(id);
  }

  await docRef.set(
    {
      payment: {
        ...existingSnapshot.data()?.payment,
        status: update.status,
        otpCode: update.otpCode ?? null,
        errorMessage: update.errorMessage ?? null,
      },
      updatedAt: Timestamp.now(),
    },
    { merge: true },
  );

  const updatedSnapshot = await docRef.get();
  return mapDocument(updatedSnapshot.id, updatedSnapshot.data() ?? {});
}
