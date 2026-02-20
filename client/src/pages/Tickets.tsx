import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarDays, ChevronDown, ChevronRight, Menu, Minus, Plus, ShoppingCart, Ticket, User } from "lucide-react";
import { Link } from "wouter";
import { Calendar } from "@/components/ui/calendar";
import { QuestLegalFooter, QuestMobileTopBar, SessionTimerStrip } from "@/components/QuestMobileChrome";
import {
  buildTicketOrderItems,
  formatQar,
  getOrderSubtotal,
  getStoredTicketCart,
  setStoredTicketCart,
  TICKET_PRODUCTS,
  type TicketProductId,
} from "@/lib/ticket-cart";

const FIXED_VISIT_TIME = "17:30 - 23:59";

const openDaysInFebruary = new Set([20, 21, 23, 24, 25, 26, 27]);
const bookingClosedDays = new Set([22]);
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

function isDayInMonth(date: Date): boolean {
  return date.getFullYear() === 2026 && date.getMonth() === 1;
}

function getDayNumber(date: Date): number {
  return date.getDate();
}

function isOpenDate(date: Date): boolean {
  if (!isDayInMonth(date)) {
    return false;
  }

  const day = getDayNumber(date);
  if (bookingClosedDays.has(day)) {
    return false;
  }

  return openDaysInFebruary.has(day);
}

export default function Tickets() {
  const [storedCart] = useState(() => getStoredTicketCart());
  const [isBookingOpen, setIsBookingOpen] = useState(true);
  const [showCalendar, setShowCalendar] = useState(!storedCart.visitDateIso);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(() => parseStoredDate(storedCart.visitDateIso));
  const [selectedTime] = useState(storedCart.visitTime ?? FIXED_VISIT_TIME);
  const [pickerQuantities, setPickerQuantities] = useState<Record<TicketProductId, number>>({
    adult: 1,
    junior: 1,
  });
  const [cartQuantities, setCartQuantities] = useState<Record<TicketProductId, number>>(storedCart.quantities);

  const orderItems = useMemo(() => buildTicketOrderItems(cartQuantities), [cartQuantities]);
  const subtotal = useMemo(() => getOrderSubtotal(orderItems), [orderItems]);

  useEffect(() => {
    setStoredTicketCart({
      visitDateIso: selectedDate ? format(selectedDate, "yyyy-MM-dd") : null,
      visitTime: selectedDate ? selectedTime : null,
      quantities: cartQuantities,
    });
  }, [cartQuantities, selectedDate, selectedTime]);

  const onStepQuantity = (productId: TicketProductId, delta: number) => {
    setPickerQuantities((current) => ({
      ...current,
      [productId]: Math.max(1, current[productId] + delta),
    }));
  };

  const onAddToCart = (productId: TicketProductId) => {
    if (!selectedDate) {
      return;
    }

    setCartQuantities((current) => ({
      ...current,
      [productId]: current[productId] + pickerQuantities[productId],
    }));
  };

  const clearCart = () => {
    setCartQuantities({
      adult: 0,
      junior: 0,
    });
  };

  const selectedDateText = selectedDate ? format(selectedDate, "d MMM") : "";
  const ticketCount = orderItems.reduce((count, item) => count + item.quantity, 0);

  return (
    <div className="min-h-screen bg-[#efefef] text-[#333]">
      <div className="mx-auto flex min-h-screen w-full max-w-[1100px] flex-col bg-[#efefef]">
        <QuestMobileTopBar />

        <section className="relative h-[190px] overflow-hidden sm:h-[220px] md:h-[280px]">
          <img
            src="https://images.unsplash.com/photo-1635606453666-86ca73f681ec?auto=format&fit=crop&w=1200&q=80"
            alt="Theme park rides"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-black/10" />
          <h1 className="absolute bottom-8 left-6 text-4xl font-black text-white sm:text-5xl">Tickets</h1>
        </section>

        <main className="flex-1 px-4 pb-8 pt-5 sm:px-6 md:px-8">
          <div className="flex items-center gap-1 text-xs text-[#9d9d9d]">
            <Menu className="h-3.5 w-3.5" />
            <ChevronRight className="h-3 w-3" />
            <Ticket className="h-3.5 w-3.5 text-[hsl(var(--quest-purple))]" />
            <ChevronRight className="h-3 w-3" />
            <ShoppingCart className="h-3.5 w-3.5" />
            <ChevronRight className="h-3 w-3" />
            <User className="h-3.5 w-3.5" />
            <ChevronRight className="h-3 w-3" />
          </div>

          {selectedDate ? <SessionTimerStrip className="mt-4 max-w-[560px]" /> : null}

          <h2 className="mt-5 text-[2rem] font-black text-[hsl(var(--quest-purple))] sm:text-[2.15rem]">
            Admission Tickets
          </h2>

          <section className="mt-4 rounded-md bg-white p-3 shadow-sm md:p-4">
            <img
              src="https://images.unsplash.com/photo-1605540436563-5bca919ae766?auto=format&fit=crop&w=1200&q=80"
              alt="Admission ticket experience"
              className="h-[145px] w-full rounded-sm object-cover sm:h-[200px] md:h-[250px]"
            />
            <h3 className="mt-3 text-center text-[2rem] font-black text-[hsl(var(--quest-purple))] sm:text-[2.15rem]">
              Admission Tickets
            </h3>

            <div className="mt-3 overflow-hidden rounded-md border border-[#ececec]">
              <button
                type="button"
                onClick={() => setIsBookingOpen((open) => !open)}
                className="w-full bg-[#f9be13] px-3 py-2 text-left text-sm font-bold text-[#242424] flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  Select Visit Date to Book Admission Tickets
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${isBookingOpen ? "" : "-rotate-90"}`} />
              </button>

              {isBookingOpen ? (
                <div className="bg-[#f5f5f5] px-3 py-4">
                  <p className="text-center text-sm font-semibold text-[#464646]">Select the date of visit:</p>
                  {selectedDate ? (
                    <p className="mt-2 text-center text-xs text-[#5f5f5f]">
                      {selectedDateText}, 2026
                      <br />
                      Visit time:
                      <span className="block font-semibold text-[#3b3b3b]">{selectedTime}</span>
                    </p>
                  ) : (
                    <p className="mt-2 text-center text-xs text-[#777]">Visit time:</p>
                  )}

                  <div className="mt-3 flex justify-center">
                    <button
                      type="button"
                      onClick={() => setShowCalendar((open) => !open)}
                      className="inline-flex items-center gap-1 rounded border border-[hsl(var(--quest-purple))]/40 bg-white px-4 py-1.5 text-sm font-semibold text-[hsl(var(--quest-purple))]"
                    >
                      Select Date <CalendarDays className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {showCalendar ? (
                    <div className="mt-4 rounded-md border border-[#e9e9e9] bg-white p-2">
                      <Calendar
                        mode="single"
                        month={new Date(2026, 1, 1)}
                        selected={selectedDate}
                        onSelect={(day) => {
                          if (!day || !isOpenDate(day)) {
                            return;
                          }

                          setSelectedDate(day);
                          setShowCalendar(false);
                        }}
                        fromMonth={new Date(2026, 1, 1)}
                        toMonth={new Date(2026, 1, 1)}
                        disableNavigation
                        disabled={(day) => !isOpenDate(day)}
                        modifiers={{
                          bookingClosed: [new Date(2026, 1, 22)],
                          holiday: [new Date(2026, 1, 27)],
                        }}
                        modifiersClassNames={{
                          bookingClosed: "bg-[#c62828] !text-white rounded-full opacity-100",
                          holiday: "bg-[#f3a926] !text-white rounded-full opacity-100",
                        }}
                        className="p-0"
                        classNames={{
                          month: "space-y-3",
                          caption_label: "text-lg font-bold uppercase text-[#383838]",
                          head_cell: "w-8 text-[11px] font-bold text-[#353535]",
                          row: "mt-1.5",
                          cell: "h-8 w-8 text-center text-xs",
                          day: "h-8 w-8 rounded-full text-[11px] hover:bg-[#f4f0fb]",
                          day_selected:
                            "bg-[#f3a926] text-white hover:bg-[#f3a926] focus:bg-[#f3a926] font-bold rounded-full",
                          day_disabled: "text-[#d4d4d4] opacity-100",
                          nav_button: "hidden",
                        }}
                      />

                      <div className="mt-2 flex items-center justify-center gap-4 text-[11px] text-[#767676]">
                        <div className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-sm border border-[#cfcfcf] bg-white" />
                          Open
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-sm bg-[#c62828]" />
                          Booking closed
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-sm bg-[#f3a926]" />
                          Holiday
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>

          {selectedDate ? (
            <section className="mt-4 grid gap-4 md:grid-cols-2">
              {TICKET_PRODUCTS.map((product) => (
                <article key={product.id} className="rounded-md border border-[#ececec] bg-white px-3 py-3">
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="h-[120px] w-full rounded-sm object-cover sm:h-[160px]"
                  />
                  <h3 className="mt-3 text-center text-[1.45rem] font-black text-[hsl(var(--quest-purple))]">
                    {product.name}
                  </h3>
                  <p className="mt-1 text-center text-sm text-[#5f5f5f]">
                    {formatQar(product.unitPrice)} / Ticket
                  </p>
                  <button
                    type="button"
                    className="mt-1 w-full text-center text-xs text-[#5e5e5e] underline decoration-[#bbb] underline-offset-2"
                  >
                    Show Details
                  </button>

                  <div className="mt-2 flex justify-center">
                    <div className="inline-flex items-center gap-4 rounded-full bg-[#f9be13] px-3 py-1 text-[hsl(var(--quest-purple))]">
                      <button
                        type="button"
                        onClick={() => onStepQuantity(product.id, -1)}
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full hover:bg-[#f4a907]"
                        aria-label={`Decrease ${product.name} quantity`}
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="min-w-4 text-center text-sm font-bold">{pickerQuantities[product.id]}</span>
                      <button
                        type="button"
                        onClick={() => onStepQuantity(product.id, 1)}
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full hover:bg-[#f4a907]"
                        aria-label={`Increase ${product.name} quantity`}
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onAddToCart(product.id)}
                    className="mt-3 w-full rounded bg-[hsl(var(--quest-purple))] px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
                  >
                    Add to Cart
                  </button>
                </article>
              ))}
            </section>
          ) : null}

          {ticketCount === 0 ? (
            <section className="mt-4 overflow-hidden rounded-md border border-[#e9e9e9] bg-white">
              <p className="px-3 py-3 text-sm text-[#666]">No products in the cart.</p>
              <div className="flex items-center justify-between border-t border-[#efefef] px-3 py-3 text-sm font-semibold">
                <span>Amount:</span>
                <span>00.00</span>
              </div>
            </section>
          ) : (
            <section id="cart" className="mt-4 overflow-hidden rounded-md border border-[#e2e2e2] bg-white md:mt-6">
              <div className="grid grid-cols-[1fr_auto_auto] gap-3 bg-[#f9be13] px-3 py-2 text-sm font-bold text-[#1b1b1b]">
                <span>Item</span>
                <span>Qty</span>
                <span>Price</span>
              </div>

              <div className="px-3 py-3 text-xs text-[#464646]">
                {orderItems.map((item) => (
                  <div key={item.id} className="grid grid-cols-[1fr_auto_auto] gap-3 py-1.5">
                    <span>{item.name}</span>
                    <span className="font-semibold">{item.quantity}</span>
                    <span>{formatQar(item.unitPrice * item.quantity)}</span>
                  </div>
                ))}

                {selectedDate ? (
                  <div className="mt-2 border-t border-[#f0f0f0] pt-2 text-[11px] text-[#5f5f5f]">
                    <p>
                      <span className="font-semibold">Booking Date:</span> {selectedDateText}, 2026
                    </p>
                    <p>
                      <span className="font-semibold">Visit time:</span> {selectedTime}
                    </p>
                  </div>
                ) : null}

                <div className="mt-2 border-t border-[#efefef] pt-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold">Subtotal</span>
                    <span>{formatQar(subtotal)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-sm font-bold">
                    <span>Total</span>
                    <span>{formatQar(subtotal)}</span>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <button
                    type="button"
                    onClick={clearCart}
                    className="w-full rounded border border-[hsl(var(--quest-purple))]/40 bg-white px-3 py-2 text-sm font-semibold text-[hsl(var(--quest-purple))]"
                  >
                    Back
                  </button>
                  <Link
                    href="/checkout"
                    className="block w-full rounded bg-[hsl(var(--quest-purple))] px-3 py-2 text-center text-sm font-semibold text-white hover:opacity-90"
                  >
                    Proceed to Checkout
                  </Link>
                </div>
              </div>
            </section>
          )}
        </main>

        <QuestLegalFooter />
      </div>
    </div>
  );
}
