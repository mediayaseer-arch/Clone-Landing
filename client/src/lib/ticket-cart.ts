export type TicketProductId = "adult" | "junior";

export interface TicketProduct {
  id: TicketProductId;
  name: string;
  unitPrice: number;
  imageUrl: string;
}

export interface StoredTicketCart {
  visitDateIso: string | null;
  visitTime: string | null;
  quantities: Record<TicketProductId, number>;
}

export interface TicketOrderItem {
  id: TicketProductId;
  name: string;
  unitPrice: number;
  quantity: number;
}

export const TICKET_PRODUCTS: TicketProduct[] = [
  {
    id: "adult",
    name: "دخول إلكتروني - بالغ",
    unitPrice: 100,
    imageUrl:
      "https://images.unsplash.com/photo-1493857671505-72967e2e2760?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "junior",
    name: "دخول إلكتروني - طفل",
    unitPrice: 80,
    imageUrl:
      "https://images.unsplash.com/photo-1513889961551-628c1e5e2ee9?auto=format&fit=crop&w=1200&q=80",
  },
];

export const ticketProductMap: Record<TicketProductId, TicketProduct> = {
  adult: TICKET_PRODUCTS[0],
  junior: TICKET_PRODUCTS[1],
};

export const DEFAULT_TICKET_CART: StoredTicketCart = {
  visitDateIso: null,
  visitTime: null,
  quantities: {
    adult: 0,
    junior: 0,
  },
};

const STORAGE_KEY = "dohaquest.ticket.cart";

function sanitizeQuantity(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }

  if (value < 0) {
    return 0;
  }

  return Math.floor(value);
}

export function getStoredTicketCart(): StoredTicketCart {
  if (typeof window === "undefined") {
    return DEFAULT_TICKET_CART;
  }

  const serialized = window.localStorage.getItem(STORAGE_KEY);
  if (!serialized) {
    return DEFAULT_TICKET_CART;
  }

  try {
    const parsed = JSON.parse(serialized) as Partial<StoredTicketCart>;
    const visitDateIso = typeof parsed.visitDateIso === "string" ? parsed.visitDateIso : null;
    const visitTime = typeof parsed.visitTime === "string" ? parsed.visitTime : null;

    return {
      visitDateIso,
      visitTime,
      quantities: {
        adult: sanitizeQuantity(parsed.quantities?.adult),
        junior: sanitizeQuantity(parsed.quantities?.junior),
      },
    };
  } catch {
    return DEFAULT_TICKET_CART;
  }
}

export function setStoredTicketCart(cart: StoredTicketCart): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
}

export function clearStoredTicketCart(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
}

export function buildTicketOrderItems(quantities: Record<TicketProductId, number>): TicketOrderItem[] {
  return (Object.keys(quantities) as TicketProductId[])
    .filter((id) => quantities[id] > 0)
    .map((id) => {
      const product = ticketProductMap[id];
      return {
        id,
        name: product.name,
        unitPrice: product.unitPrice,
        quantity: quantities[id],
      };
    });
}

export function getOrderSubtotal(items: TicketOrderItem[]): number {
  return items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
}

export function formatQar(amount: number): string {
  const formattedAmount = new Intl.NumberFormat("ar-QA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  return `${formattedAmount} ر.ق`;
}
