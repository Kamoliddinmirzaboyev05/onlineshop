import type { OrderStatus } from "../types";

const ACCEPTABLE_STATUSES = new Set<OrderStatus>([
  "pending",
  "confirmed",
  "preparing",
  "ready",
]);

/** Qabul qilingandan keyin, yo'lga chiqishdan oldin miqdor tahriri mumkin. */
const ADJUSTABLE_STATUSES = new Set<OrderStatus>([
  "accepted",
  "preparing",
  "ready",
]);

export function isAcceptableOrderStatus(status: OrderStatus): boolean {
  return ACCEPTABLE_STATUSES.has(status);
}

export function isAdjustableOrderStatus(status: OrderStatus): boolean {
  return ADJUSTABLE_STATUSES.has(status);
}
