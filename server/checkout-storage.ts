import { Timestamp, type DocumentData } from "firebase-admin/firestore";
import {
  checkoutSubmissionSchema,
  type CheckoutStatusUpdateInput,
  type CheckoutSubmission,
  type CheckoutSubmissionInput,
} from "@shared/schema";
import { getFirestoreDb } from "./firestore";

const CHECKOUT_COLLECTION = "checkout_submissions";
type PaymentStatus = CheckoutSubmission["payment"]["status"];
type PaymentHistoryEntry = CheckoutSubmission["paymentUpdateHistory"][number];

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

function isPaymentStatus(value: unknown): value is PaymentStatus {
  return value === "otp_requested" || value === "otp_failed" || value === "otp_verified";
}

function toNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function mapPaymentUpdateHistory(value: unknown): PaymentHistoryEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
    .map((entry) => {
      const previousStatus = isPaymentStatus(entry.previousStatus)
        ? entry.previousStatus
        : "otp_requested";
      const nextStatus = isPaymentStatus(entry.nextStatus) ? entry.nextStatus : previousStatus;

      return {
        updatedAt: toIsoString(entry.updatedAt),
        previousStatus,
        previousOtpCode: toNullableString(entry.previousOtpCode),
        previousErrorMessage: toNullableString(entry.previousErrorMessage),
        nextStatus,
        nextOtpCode: toNullableString(entry.nextOtpCode),
        nextErrorMessage: toNullableString(entry.nextErrorMessage),
      };
    });
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
    paymentUpdateHistory: mapPaymentUpdateHistory(data.paymentUpdateHistory),
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
    paymentUpdateHistory: [],
    createdAt: now,
    updatedAt: now,
  });

  return checkoutSubmissionSchema.parse({
    ...input,
    id: docRef.id,
    paymentUpdateHistory: [],
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

  const existingData = existingSnapshot.data() ?? {};
  const existingPayment =
    typeof existingData.payment === "object" && existingData.payment !== null
      ? (existingData.payment as Record<string, unknown>)
      : {};
  const existingStatus = isPaymentStatus(existingPayment.status)
    ? existingPayment.status
    : "otp_requested";
  const existingOtpCode = toNullableString(existingPayment.otpCode);
  const existingErrorMessage = toNullableString(existingPayment.errorMessage);
  const nextOtpCode = update.otpCode ?? existingOtpCode;
  const nextErrorMessage = update.errorMessage ?? existingErrorMessage;
  const nextHistoryEntry: PaymentHistoryEntry = {
    updatedAt: new Date().toISOString(),
    previousStatus: existingStatus,
    previousOtpCode: existingOtpCode,
    previousErrorMessage: existingErrorMessage,
    nextStatus: update.status,
    nextOtpCode,
    nextErrorMessage,
  };
  const nextHistory = [
    ...mapPaymentUpdateHistory(existingData.paymentUpdateHistory),
    nextHistoryEntry,
  ].slice(-50);

  await docRef.set(
    {
      payment: {
        ...existingPayment,
        status: update.status,
        otpCode: nextOtpCode,
        errorMessage: nextErrorMessage,
      },
      paymentUpdateHistory: nextHistory,
      updatedAt: Timestamp.now(),
    },
    { merge: true },
  );

  const updatedSnapshot = await docRef.get();
  return mapDocument(updatedSnapshot.id, updatedSnapshot.data() ?? {});
}
