# Courier-driven order flow (courier sees orders immediately)

> Updated decision, 2026-07-02: keep the full operational status chain
> `pending → confirmed → preparing → ready → accepted → delivering → delivered`.
> A newly placed customer order must still appear in the courier app immediately
> while it is `pending`, so couriers can self-claim it without waiting for admin.

## Problem

Order lifecycle had two separate concerns that were being mixed together:

1. The business still wants the preparation statuses (`confirmed`, `preparing`, `ready`) available for operational tracking.
2. Couriers must not wait for those statuses before seeing a new order. A fresh `pending` order should appear in the courier app immediately and can be self-claimed by a courier.
3. Customer-side delivery confirmation is not part of the flow. When the courier marks the order delivered, the order is `delivered`.

Admin remains a read-only observer of courier assignment, with one exception: admin retains the ability to cancel an order.

## Status model

**Statuses:** `pending, confirmed, preparing, ready, accepted, delivering, delivered, cancelled`

Allowed transitions:

```
pending    → confirmed, accepted, cancelled
confirmed  → preparing, accepted, cancelled
preparing  → ready, accepted, cancelled
ready      → accepted, delivering, cancelled
accepted   → delivering, cancelled
delivering → delivered, cancelled
delivered  → terminal
cancelled  → terminal
```

- `confirmed`, `preparing`, and `ready` stay in the backend enum and all frontend status unions.
- Courier list includes any non-terminal unassigned order, including `pending`, `confirmed`, `preparing`, and `ready`.
- `delivered` is set by the courier's delivered action — no separate customer confirmation step.
- `cancelled` remains reachable from any non-terminal state, admin-only.

## Backend changes (`backend/`)

### `app/models/enums.py`
Keep `confirmed`, `preparing`, `ready`, and `accepted` in `OrderStatus`.

### `app/services/orders.py`
Keep `_ALLOWED_TRANSITIONS` aligned to the table above.

### `app/api/routes/courier.py`
- `GET /courier/orders` returns active orders assigned to the courier plus active unassigned orders, including fresh `pending` orders.
- Courier can claim an unassigned order by setting `status=accepted`.
- Courier then moves `accepted → delivering`, and the delivered action finishes the order as `delivered`.
- `decrement_stock_atomic()` fires when the courier marks the order delivered.

### `app/api/routes/orders.py`
No customer delivery confirmation is required. Customer-facing `GET /orders/{id}` reflects live status.

### `app/api/routes/admin.py`
`PATCH /admin/orders/{order_id}`:
- Remove `assigned_courier_id` from the accepted payload/behavior — admin can no longer assign couriers.
- Restrict `status` to only accept `cancelled` (from any non-terminal current state). Any other status value in the payload is rejected (400).
- All `GET /admin/orders`, `GET /admin/courier-accounts`, stats/report endpoints are unchanged — admin still sees full order state and courier assignment (read-only) plus existing reporting.

## Admin panel changes (`admin/src/pages/OrdersPage.tsx`)

- Remove the `NEXT` status-flow button group (confirmed/preparing/ready/delivering progression).
- Remove the `assign()` function and courier-assignment dropdown/UI.
- Keep a single "Bekor qilish" (cancel) action, shown for any non-terminal order; calls `PATCH /admin/orders/{id}` with `status=cancelled`.
- Order list becomes otherwise read-only: status shown as a badge, assigned courier shown as plain text (not editable).
- Admin status labels include `accepted`.
- No changes to existing reports/stats pages beyond whatever queries reference the removed statuses (see Migration/Cleanup).

## Courier app changes (this repo, `courier/`)

- `src/types.ts`: keep `OrderStatus` as `pending | confirmed | preparing | ready | accepted | delivering | delivered | cancelled`.
- `src/pages/OrdersPage.tsx` and `src/pages/OrderDetailPage.tsx`:
  - Remove "awaiting customer confirmation" copy.
  - The "Yetkazaman" (start delivering) button behavior is unchanged (PATCH status=delivering).
  - Keep a single "Yetkazdim" button, shown once status is `delivering`; on success, order moves to history/completed list immediately.

## TMA changes (`tma/`)

- `src/pages/OrdersPage.tsx`: remove the `courier_delivered_at`-gated "confirm receipt" prompt.
- Order detail screen shows live status only (poll/refetch as it already does). When status flips to `delivered`, show the existing success/celebration screen automatically, no button press required.

## Migration / cleanup

- No status enum migration is needed for `confirmed`, `preparing`, or `ready`; they remain valid.
- Grep all four projects for customer-confirmation copy such as "mijoz tasdig'i" and receipt-confirm prompts.

## Testing

- Backend: verify `_ALLOWED_TRANSITIONS`, admin non-cancel rejection, and courier visibility for fresh `pending` unassigned orders.
- Courier app: existing vitest setup (`src/test/`) — add/adjust tests for the new single-button delivered flow if `OrdersPage`/`OrderDetailPage` have testable logic extracted (per existing `utils/format` test pattern).
- Manual smoke test per app: create order (TMA) → verify it appears immediately in courier app while `pending` → accept (courier) → deliver (courier) → confirm status shows `delivered` everywhere.
