import type { OrderStatus } from "../types";

const ACCEPTABLE_STATUSES = new Set<OrderStatus>([
  "pending",
  "confirmed",
  "preparing",
  "ready",
]);

export function isAcceptableOrderStatus(status: OrderStatus): boolean {
  return ACCEPTABLE_STATUSES.has(status);
}
