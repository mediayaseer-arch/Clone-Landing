import { useEffect, useMemo, useState } from "react";
import { addDays, format, startOfDay } from "date-fns";
import { arSA } from "date-fns/locale";
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Menu,
  Minus,
  Plus,
  ShoppingCart,
  Ticket,
  User,
} from "lucide-react";
import { Link } from "wouter";
import { Calendar } from "@/components/ui/calendar";
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
  setStoredTicketCart,
  TICKET_PRODUCTS,
  type TicketProductId,
} from "@/lib/ticket-cart";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

const FIXED_VISIT_TIME = "١٧:٣٠ - ٢٣:٥٩";
const BOOKING_WINDOW_DAYS = 90;

const bookingClosedDateIsos = new Set(["2026-02-22"]);
const holidayDateIsos = new Set(["2026-02-27"]);

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

function toDateOnly(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function toDateOnlyIso(value: Date): string {
  return format(value, "yyyy-MM-dd");
}

function parseDateOnlyIso(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return undefined;
  }

  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

function isBookableDate(date: Date, minDate: Date, maxDate: Date): boolean {
  const normalizedDate = toDateOnly(date);
  if (
    normalizedDate.getTime() < minDate.getTime() ||
    normalizedDate.getTime() > maxDate.getTime()
  ) {
    return false;
  }

  return !bookingClosedDateIsos.has(toDateOnlyIso(normalizedDate));
}

function formatArabicDate(date: Date): string {
  return new Intl.DateTimeFormat("ar-QA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export default function Tickets() {
  const { toast } = useToast();
  const [storedCart] = useState(() => getStoredTicketCart());
  const minBookingDate = useMemo(() => startOfDay(new Date()), []);
  const maxBookingDate = useMemo(
    () => addDays(minBookingDate, BOOKING_WINDOW_DAYS),
    [minBookingDate]
  );
  const bookingClosedDates = useMemo(
    () =>
      Array.from(bookingClosedDateIsos)
        .map(parseDateOnlyIso)
        .filter((date): date is Date => Boolean(date)),
    []
  );
  const holidayDates = useMemo(
    () =>
      Array.from(holidayDateIsos)
        .map(parseDateOnlyIso)
        .filter((date): date is Date => Boolean(date)),
    []
  );
  const [isBookingOpen, setIsBookingOpen] = useState(true);
  const [showCalendar, setShowCalendar] = useState(!storedCart.visitDateIso);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(() =>
    parseStoredDate(storedCart.visitDateIso)
  );
  const [selectedTime] = useState(storedCart.visitTime ?? FIXED_VISIT_TIME);
  const [pickerQuantities, setPickerQuantities] = useState<
    Record<TicketProductId, number>
  >({
    adult: 1,
    junior: 1,
  });
  const [cartQuantities, setCartQuantities] = useState<
    Record<TicketProductId, number>
  >(storedCart.quantities);

  const orderItems = useMemo(
    () => buildTicketOrderItems(cartQuantities),
    [cartQuantities]
  );
  const subtotal = useMemo(() => getOrderSubtotal(orderItems), [orderItems]);

  useEffect(() => {
    setStoredTicketCart({
      visitDateIso: selectedDate ? format(selectedDate, "yyyy-MM-dd") : null,
      visitTime: selectedDate ? selectedTime : null,
      quantities: cartQuantities,
    });
  }, [cartQuantities, selectedDate, selectedTime]);

  useEffect(() => {
    if (!selectedDate) {
      return;
    }

    if (isBookableDate(selectedDate, minBookingDate, maxBookingDate)) {
      return;
    }

    setSelectedDate(undefined);
    setShowCalendar(true);
  }, [maxBookingDate, minBookingDate, selectedDate]);

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

    const product = TICKET_PRODUCTS.find((entry) => entry.id === productId);

    toast({
      title: "تمت إضافة التذاكر إلى السلة",
      description: `${pickerQuantities[productId]} × ${product?.name ?? "تذكرة دخول"}`,
      action: (
        <ToastAction
          altText="الذهاب إلى السلة"
          onClick={() => {
            if (typeof window !== "undefined") {
              window.location.hash = "cart";
            }

            const cartSection = document.getElementById("cart");
            if (cartSection) {
              try {
                cartSection.scrollIntoView({ behavior: "smooth", block: "start" });
              } catch {
                cartSection.scrollIntoView();
              }
            }
          }}
        >
          الذهاب إلى السلة
        </ToastAction>
      ),
    });
  };

  const clearCart = () => {
    setCartQuantities({
      adult: 0,
      junior: 0,
    });
  };

  const selectedDateText = selectedDate ? formatArabicDate(selectedDate) : "";
  const ticketCount = orderItems.reduce(
    (count, item) => count + item.quantity,
    0
  );

  return (
    <div className="min-h-screen bg-[#efefef] text-[#333]" dir="rtl" lang="ar">
      <div className="mx-auto flex min-h-screen w-full max-w-[1100px] flex-col bg-[#efefef]">
        <QuestMobileTopBar />

        <section className="relative h-[190px] overflow-hidden sm:h-[220px] md:h-[280px]">
          <img
            src="/3.png"
            alt="ألعاب مدينة الملاهي"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-black/10" />
          <h1 className="absolute bottom-8 right-6 text-4xl font-black text-white sm:text-5xl">
            التذاكر
          </h1>
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

          {selectedDate ? (
            <SessionTimerStrip className="mt-4 max-w-[560px]" />
          ) : null}

          <h2 className="mt-5 text-[2rem] font-black text-[hsl(var(--quest-purple))] sm:text-[2.15rem]">
            تذاكر الدخول
          </h2>

          <section className="mt-4 rounded-md bg-white p-3 shadow-sm md:p-4">
            <img
              src="/4.png"
              alt="تجربة تذاكر الدخول"
              className="h-[145px] w-full rounded-sm object-cover sm:h-[200px] md:h-[250px]"
            />
            <h3 className="mt-3 text-center text-[2rem] font-black text-[hsl(var(--quest-purple))] sm:text-[2.15rem]">
              تذاكر الدخول
            </h3>

            <div className="mt-3 overflow-hidden rounded-md border border-[#ececec]">
              <button
                type="button"
                onClick={() => setIsBookingOpen((open) => !open)}
                className="w-full bg-[#f9be13] px-3 py-2 text-right text-sm font-bold text-[#242424] flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  اختر تاريخ الزيارة لحجز تذاكر الدخول
                </span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${
                    isBookingOpen ? "" : "-rotate-90"
                  }`}
                />
              </button>

              {isBookingOpen ? (
                <div className="bg-[#f5f5f5] px-3 py-4">
                  <p className="text-center text-sm font-semibold text-[#464646]">
                    اختر تاريخ الزيارة:
                  </p>
                  {selectedDate ? (
                    <p className="mt-2 text-center text-xs text-[#5f5f5f]">
                      {selectedDateText}
                      <br />
                      وقت الزيارة:
                      <span className="block font-semibold text-[#3b3b3b]">
                        {selectedTime}
                      </span>
                    </p>
                  ) : (
                    <p className="mt-2 text-center text-xs text-[#777]">
                      وقت الزيارة:
                    </p>
                  )}

                  <div className="mt-3 flex justify-center">
                    <button
                      type="button"
                      onClick={() => setShowCalendar((open) => !open)}
                      className="inline-flex items-center gap-1 rounded border border-[hsl(var(--quest-purple))]/40 bg-white px-4 py-1.5 text-sm font-semibold text-[hsl(var(--quest-purple))]"
                    >
                      اختر التاريخ <CalendarDays className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {showCalendar ? (
                    <div className="mt-4 rounded-md border border-[#e9e9e9] bg-white p-2">
                      <Calendar
                        mode="single"
                        locale={arSA}
                        defaultMonth={selectedDate ?? minBookingDate}
                        selected={selectedDate}
                        onSelect={(day) => {
                          if (
                            !day ||
                            !isBookableDate(day, minBookingDate, maxBookingDate)
                          ) {
                            return;
                          }

                          setSelectedDate(day);
                          setShowCalendar(false);
                        }}
                        fromMonth={
                          new Date(
                            minBookingDate.getFullYear(),
                            minBookingDate.getMonth(),
                            1
                          )
                        }
                        toMonth={
                          new Date(
                            maxBookingDate.getFullYear(),
                            maxBookingDate.getMonth(),
                            1
                          )
                        }
                        disabled={(day) =>
                          !isBookableDate(day, minBookingDate, maxBookingDate)
                        }
                        modifiers={{
                          bookingClosed: bookingClosedDates,
                          holiday: holidayDates,
                        }}
                        modifiersClassNames={{
                          bookingClosed:
                            "bg-[#c62828] !text-white rounded-full opacity-100",
                          holiday:
                            "bg-[#f3a926] !text-white rounded-full opacity-100",
                        }}
                        className="p-2"
                        classNames={{
                          month: "space-y-3 w-full",
                          caption: "flex justify-center pt-1 relative items-center h-10",
                          caption_label: "text-lg font-bold text-[#383838]",
                          nav: "flex items-center",
                          nav_button:
                            "h-8 w-8 bg-transparent p-0 opacity-60 hover:opacity-100 inline-flex items-center justify-center rounded-md border border-[#e0e0e0] hover:bg-[#f4f0fb] transition-colors",
                          nav_button_previous: "absolute left-1",
                          nav_button_next: "absolute right-1",
                          table: "w-full border-collapse",
                          head_row: "grid grid-cols-7",
                          head_cell:
                            "text-center text-[11px] font-bold text-[#353535] py-2",
                          row: "grid grid-cols-7 mt-1",
                          cell: "text-center text-xs p-0.5",
                          day: "h-9 w-9 mx-auto rounded-full text-[12px] hover:bg-[#f4f0fb] inline-flex items-center justify-center transition-colors",
                          day_selected:
                            "bg-[#f3a926] text-white hover:bg-[#f3a926] focus:bg-[#f3a926] font-bold rounded-full",
                          day_today: "bg-[#f4f0fb] font-semibold",
                          day_disabled: "text-[#d4d4d4] opacity-100",
                        }}
                      />

                      <div className="mt-2 flex items-center justify-center gap-4 text-[11px] text-[#767676]">
                        <div className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-sm border border-[#cfcfcf] bg-white" />
                          متاح
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-sm bg-[#c62828]" />
                          الحجز مغلق
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-sm bg-[#f3a926]" />
                          عطلة
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
                <article
                  key={product.id}
                  className="rounded-md border border-[#ececec] bg-white px-3 py-3"
                >
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="h-[120px] w-full rounded-sm object-cover sm:h-[160px]"
                  />
                  <h3 className="mt-3 text-center text-[1.45rem] font-black text-[hsl(var(--quest-purple))]">
                    {product.name}
                  </h3>
                  <p className="mt-1 text-center text-sm text-[#5f5f5f]">
                    {formatQar(product.unitPrice)} / التذكرة
                  </p>
                  <button
                    type="button"
                    className="mt-1 w-full text-center text-xs text-[#5e5e5e] underline decoration-[#bbb] underline-offset-2"
                  >
                    عرض التفاصيل
                  </button>

                  <div className="mt-2 flex justify-center">
                    <div className="inline-flex items-center gap-4 rounded-full bg-[#f9be13] px-3 py-1 text-[hsl(var(--quest-purple))]">
                      <button
                        type="button"
                        onClick={() => onStepQuantity(product.id, -1)}
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full hover:bg-[#f4a907]"
                        aria-label={`تقليل الكمية من ${product.name}`}
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="min-w-4 text-center text-sm font-bold">
                        {pickerQuantities[product.id]}
                      </span>
                      <button
                        type="button"
                        onClick={() => onStepQuantity(product.id, 1)}
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full hover:bg-[#f4a907]"
                        aria-label={`زيادة الكمية من ${product.name}`}
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
                    أضف إلى السلة
                  </button>
                </article>
              ))}
            </section>
          ) : null}

          {ticketCount === 0 ? (
            <section className="mt-4 overflow-hidden rounded-md border border-[#e9e9e9] bg-white">
              <p className="px-3 py-3 text-sm text-[#666]">
                لا توجد منتجات في السلة.
              </p>
              <div className="flex items-center justify-between border-t border-[#efefef] px-3 py-3 text-sm font-semibold">
                <span>المبلغ:</span>
                <span>00.00</span>
              </div>
            </section>
          ) : (
            <section
              id="cart"
              className="mt-4 overflow-hidden rounded-md border border-[#e2e2e2] bg-white md:mt-6"
            >
              <div className="grid grid-cols-[1fr_auto_auto] gap-3 bg-[#f9be13] px-3 py-2 text-sm font-bold text-[#1b1b1b]">
                <span>المنتج</span>
                <span>الكمية</span>
                <span>السعر</span>
              </div>

              <div className="px-3 py-3 text-xs text-[#464646]">
                {orderItems.map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-[1fr_auto_auto] gap-3 py-1.5"
                  >
                    <span>{item.name}</span>
                    <span className="font-semibold">{item.quantity}</span>
                    <span>{formatQar(item.unitPrice * item.quantity)}</span>
                  </div>
                ))}

                {selectedDate ? (
                  <div className="mt-2 border-t border-[#f0f0f0] pt-2 text-[11px] text-[#5f5f5f]">
                    <p>
                      <span className="font-semibold">تاريخ الحجز:</span>{" "}
                      {selectedDateText}
                    </p>
                    <p>
                      <span className="font-semibold">وقت الزيارة:</span>{" "}
                      {selectedTime}
                    </p>
                  </div>
                ) : null}

                <div className="mt-2 border-t border-[#efefef] pt-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold">المجموع الفرعي</span>
                    <span>{formatQar(subtotal)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-sm font-bold">
                    <span>الإجمالي</span>
                    <span>{formatQar(subtotal)}</span>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <button
                    type="button"
                    onClick={clearCart}
                    className="w-full rounded border border-[hsl(var(--quest-purple))]/40 bg-white px-3 py-2 text-sm font-semibold text-[hsl(var(--quest-purple))]"
                  >
                    تفريغ السلة
                  </button>
                  {selectedDate ? (
                    <Link
                      href="/checkout"
                      className="block w-full rounded bg-[hsl(var(--quest-purple))] px-3 py-2 text-center text-sm font-semibold text-white hover:opacity-90"
                    >
                      المتابعة إلى الدفع
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="w-full cursor-not-allowed rounded bg-[hsl(var(--quest-purple))]/60 px-3 py-2 text-center text-sm font-semibold text-white"
                    >
                      اختر تاريخ الزيارة أولًا
                    </button>
                  )}
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
