import { useMemo, useState } from "react";
import { format } from "date-fns";
import { CreditCard } from "lucide-react";
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

export default function Checkout() {
  const [billingDetails, setBillingDetails] = useState<BillingDetails>({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
  });
  const [storedCart] = useState(() => getStoredTicketCart());

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

  return (
    <div className="min-h-screen bg-[#efefef] text-[#333]">
      <div className="mx-auto max-w-[390px] min-h-screen bg-[#efefef] flex flex-col">
        <section className="relative h-[190px] overflow-hidden">
          <img
            src="https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?auto=format&fit=crop&w=1200&q=80"
            alt="Colorful carousel at indoor park"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-black/5" />
          <h1 className="absolute bottom-8 left-6 text-4xl font-black text-white">Checkout</h1>
        </section>

        <QuestMobileTopBar />

        <main className="flex-1 px-4 pb-8 pt-4">
          <SessionTimerStrip />

          <section className="mt-4 bg-[#e9edf3] p-4 border-l-4 border-l-[hsl(var(--quest-purple))] text-[#5f5f5f] text-sm">
            <p>
              Have a coupon?
              <span className="ml-1 text-[#4d4d4d]">Click here to enter your code</span>
            </p>
          </section>

          <section className="mt-6">
            <h2 className="text-[2rem] font-black text-[hsl(var(--quest-purple))]">Billing Details</h2>

            <form className="mt-4 space-y-3">
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

              <label className="block">
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

          <section className="mt-7">
            <h2 className="text-[2rem] font-black text-[hsl(var(--quest-purple))]">Your Order</h2>

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
            <h2 className="text-[2rem] font-black text-[hsl(var(--quest-purple))]">Payments</h2>

            <div className="mt-3 rounded-xl border border-[#e8e8e8] bg-white p-3">
              <div className="rounded-md border border-[#ececec] bg-[#f8f8f8] px-3 py-2 text-sm font-semibold text-[#3e3e3e] flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Credit / Debit Cards
              </div>

              <p className="mt-3 text-xs leading-5 text-[#444]">
                SkipCash is a payment app that offers a convenient and enjoyable experience throughout the payments
                journey for both consumers and merchants.
              </p>

              <p className="mt-4 text-xs leading-5 text-[#666]">
                Your personal data will be used to process your order, support your experience throughout this website,
                and for other purposes described in our privacy policy.
              </p>

              <button
                type="button"
                className="mt-4 w-full rounded bg-[hsl(var(--quest-purple))] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                Proceed to Payment
              </button>
            </div>
          </section>
        </main>

        <QuestLegalFooter />
      </div>
    </div>
  );
}
