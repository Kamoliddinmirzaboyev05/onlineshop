# Admin navbar + order-status notifications — design

## Purpose
The admin panel already pushes a browser notification to admins when a **new** order arrives
(`notify_new_order` → `webpush.notify_admins`), but not when a courier **accepts** or **delivers**
one. Separately, the admin panel has a sidebar nav and a mobile-only top bar, but no persistent
top navbar on desktop and no in-panel place to see recent activity (browser push notifications
disappear; there's nothing to check back on).

This adds the two missing push triggers, a real navbar (shown on all screen sizes), and a
notification bell in that navbar showing recent order events.

## Scope
- Backend: two new `webpush.notify_admins(...)` calls (accept, delivered) in the existing courier
  status-update routes; one new read-only endpoint deriving recent events from the `orders` table.
- Frontend: extend the existing top bar into a real navbar (desktop + mobile); add a
  `NotificationBell` component.
- Out of scope: a persisted notification-log table (derived from `orders` instead — no new
  storage, nothing to clean up), websocket/real-time push to the in-panel list (30s polling is
  enough), server-side read/unread tracking (client-side `localStorage` is enough for now).

## Backend

**`app/api/routes/courier.py`** (`courier_update_order`, `courier_mark_delivered`):
- In `courier_update_order`, inside the existing `if notify_accept:` block (already schedules
  `notify_status_change` to the customer), add:
  `background.add_task(webpush.notify_admins, f"✅ Buyurtma qabul qilindi № {order.number}", f"{order.total:,} so'm · {order.address_line}", url="/orders", tag=f"accepted-{order.id}")`
- In `courier_mark_delivered`, alongside the existing `background.add_task(notify_status_change,
  ...)`, add:
  `background.add_task(webpush.notify_admins, f"🎉 Buyurtma yetkazildi № {order.number}", f"{order.total:,} so'm · {order.address_line}", url="/orders", tag=f"delivered-{order.id}")`
- Import `from app.services import webpush` (not yet imported in this file).

**New endpoint `GET /admin/notifications`** (in `app/api/routes/admin.py`, under the existing
`require_staff` router-level dependency — same access as the rest of `/admin`):
- Loads the last 50 orders ordered by `created_at desc`.
- For each order, emits up to 3 events depending on which timestamps are set:
  `created_at` → `type="new"`; `courier_accepted_at` → `type="accepted"`; `courier_delivered_at` →
  `type="delivered"`.
- Sorts the combined list by `at` descending, returns the first 30.
- Response schema `NotificationEvent`: `{type: "new"|"accepted"|"delivered", order_id: int,
  order_number: str, total: int, address_line: str, at: datetime}`.

## Frontend

**`admin/src/components/Layout.tsx`**:
- The existing `<header className="md:hidden sticky top-0 z-30 ...">` becomes the shared navbar:
  drop `md:hidden` so it renders at all breakpoints, add `md:ml-64` so it sits to the right of the
  fixed desktop sidebar (matching `<main>`'s existing `md:ml-64`), keep the menu (☰) button
  `md:hidden` (mobile-only — the sidebar is always visible on desktop already).
- Add `<NotificationBell />` at the right end of that header (`ml-auto`).

**New `admin/src/components/NotificationBell.tsx`**:
- Polls `GET /admin/notifications` every 30s (`setInterval`) plus once on mount.
- Tracks `lastSeenAt` in `localStorage` (defaults to "now" on first-ever load, so existing history
  doesn't show as a wall of unread on first use).
- Badge = count of events with `at > lastSeenAt`.
- Clicking the bell opens a dropdown listing the fetched events (icon + text per `type`, relative
  time) and sets `lastSeenAt` to the newest event's `at` (clearing the badge).

**`admin/src/types.ts`**: add a `NotificationEvent` interface matching the backend schema.

## Error handling
- `/admin/notifications` never fails the page — same as other admin list endpoints, a fetch error
  in `NotificationBell` is swallowed (bell just doesn't update that poll cycle, no toast spam every
  30s).
- The new `webpush.notify_admins` calls run as `BackgroundTasks`, so a push failure (as already
  true for every other push call in this codebase) can never fail the courier's request.

## Testing
- No new non-trivial branching logic beyond what already exists in `webpush.py` (already
  unguarded by tests, matching codebase convention). The event-deriving logic in the new endpoint
  (3-events-per-order, sort-and-slice) is simple enough that a manual check (Task list) covers it;
  no dedicated self-check script needed — it's a straight read-and-reshape, not a stateful/branchy
  algorithm like the announcement broadcast counter was.
