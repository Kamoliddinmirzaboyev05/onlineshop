# Delivery flow: zone, assignment, receipt, courier push

Date: 2026-06-27
Status: approved (phased build)

## Goal

End-to-end order delivery flow:

1. User sends **location** (map/Telegram) when ordering.
2. Admin sets a **delivery zone**; orders outside it are rejected with a clear message.
3. On order, the bot sends the user a **receipt image** with all details
   (number, items, totals, address, phone).
4. Admin **confirms** the order and **assigns it to a courier**.
5. The assigned courier gets a **web push notification**, opens the order, taps
   **Navigation** (Yandex/Google maps), and marks **delivered** — visible in admin.

## Key decisions

- **Zone shape:** circle (center lat/lng + radius km). Simple, fits "Fergana city only".
- **Maps:** Leaflet + OpenStreetMap (free, no key) in admin (zone picker) and TMA (location picker).
- **Receipt:** server-rendered PNG via Pillow, sent through Telegram `sendPhoto`.
- **Courier identity:** orders are assigned **directly to the courier login account**
  (`AdminUser` with role=courier). The legacy `Courier` (telegram) table is left untouched.
- **Build order:** backend → admin → courier/tma, with a checkpoint after each phase.

## Data model changes

- `Order.assigned_courier_id` → FK `admin_users.id`, nullable, indexed.
- `DeliveryZone`: add `center_lat`, `center_lng`, `radius_km` (Float). Reuse
  `name`, `fee`, `is_active`. Single active zone is the operating model.
- `PushSubscription.admin_user_id` → FK `admin_users.id`, nullable.
  `null` = admin panel subscription; set = that courier's subscription.

Columns added via an idempotent `ALTER TABLE` step in `initdb` (dev setup uses
`create_all`; `create_all` does not alter existing tables).

## Phase 1 — backend

- `app/services/geo.py`: `haversine_km(a, b)`, `is_within_zone(zone, lat, lng)`.
- `create_order`: if an active zone exists, require coords and reject when outside
  → HTTP 400 `"Yetkazib berish hududidan tashqarida"`.
- Admin zone: `GET /admin/delivery-zone`, `PUT /admin/delivery-zone`.
- Assignment: `PATCH /admin/orders/{id}` accepts `assigned_courier_id`;
  `GET /admin/courier-accounts` lists active courier `AdminUser`s for the dropdown.
- Courier scope: `/courier/orders`, `/courier/history`, `/courier/stats`,
  `/courier/earnings` filter to `assigned_courier_id == me.id`.
- Courier push: `GET /courier/push/public-key`, `POST /courier/push/subscribe`
  (stores `admin_user_id = me.id`); `webpush.notify_courier(admin_user_id, ...)`.
  Assignment triggers a push to that courier.
- Receipt: `app/services/receipt.py` (Pillow) → PNG; `notify.py` sends it on
  `confirmed`. Add `Pillow` to requirements.

## Phase 2 — admin panel

- Delivery-zone page: Leaflet map (click = center), radius slider, fee, save.
- Orders board: assign-courier dropdown, show assigned courier and status.
- Add `react-leaflet` + `leaflet` deps.

## Phase 3 — courier app + TMA

- Courier: service worker + web-push subscribe on login; notification opens the
  order; assigned-only list (already filtered by API). Maps button already shipped.
- TMA checkout: Leaflet location picker; send `lat/lng`; surface the out-of-zone error.

## Out of scope

- Multiple zones / per-zone pricing.
- Live courier GPS tracking.
- Full uz/ru i18n of the courier app.
