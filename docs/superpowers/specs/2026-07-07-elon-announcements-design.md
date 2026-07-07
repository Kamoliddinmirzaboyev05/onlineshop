# Elon (Announcements) — design

## Purpose
Superadmin needs to broadcast a post (text + optional image + a button that opens the TMA) to
all bot users from the admin panel, see send history/stats, and resend an old post.

## Scope
- Backend: new `announcements` table, broadcast service, admin routes.
- Frontend: new superadmin-only "Elon" page (compose + history/stats).
- Out of scope (explicitly deferred): per-recipient delivery tracking, custom deep-link path for
  the button (always opens TMA root), scheduling/drafts.

## Data model
New table `announcements` (`backend/app/models/announcement.py`):

| column            | type                  | notes                                   |
|-------------------|-----------------------|------------------------------------------|
| id                | PK                    |                                          |
| text              | Text                  | message body (HTML parse mode)          |
| image_url         | String(512), nullable | optional photo, from `/admin/upload`     |
| button_text       | String(64)            | default `"🛍 Ochish"`                    |
| status            | String(16)             | `pending` \| `sending` \| `sent`         |
| total_recipients  | Integer, default 0    | snapshot of non-blocked user count       |
| sent_count        | Integer, default 0    |                                          |
| failed_count      | Integer, default 0    |                                          |
| created_at        | DateTime tz            |                                          |
| sent_at           | DateTime tz, nullable  | set when broadcast finishes             |

No Alembic migration needed — it's a brand-new table, `Base.metadata.create_all` (run at
container start via `initdb.py`) creates it.

## Backend

**`app/services/announcements.py`** (new, mirrors `services/notify.py` / `services/webpush.py`):
- `broadcast(announcement_id: int) -> None` — runs as a `BackgroundTasks` job (own `SessionLocal`,
  since the request session is closed by the time it runs).
  - Loads the announcement, loads all `User.telegram_id` where `is_blocked` is false.
  - Sets `status="sending"`, `total_recipients=len(users)`, commits.
  - For each user: `sendPhoto` (if `image_url`) or `sendMessage` (if not), with an inline keyboard
    button of type `web_app` pointing at `settings.tma_url`. Uses `httpx` directly against the Bot
    API, same as `notify.py`, catching exceptions per-recipient (one failure must not stop the
    batch).
  - Sleeps ~50ms between sends (≈20 msg/s, under Telegram's flood limits).
  - Increments `sent_count`/`failed_count` as it goes; on completion sets `status="sent"`,
    `sent_at=now()`.

**`app/api/routes/admin.py`** additions (all behind `require_superadmin`, matching the
`admin-users` section pattern):
- `GET /admin/announcements` → list, newest first.
- `POST /admin/announcements` → body `{text, image_url?, button_text?}`; creates row
  (`status="pending"`), kicks off `background.add_task(broadcast, row.id)`, returns the row.
- `POST /admin/announcements/{id}/resend` → clones an existing announcement's `text`/`image_url`/
  `button_text` into a new row and broadcasts it (history of the original stays untouched).

**`app/schemas/admin.py`** additions: `AnnouncementIn` (text, image_url, button_text — all with
sane defaults) and `AnnouncementOut` (full row incl. stats/status).

## Frontend (admin)

- `src/pages/AnnouncementsPage.tsx` (new), route `/announcements`, nav entry "Elon" (Megaphone
  icon), `roles: ["superadmin"]` — same gating as Reports/Users/Couriers/Settings.
- Layout follows `SuppliesPage.tsx` conventions:
  - Stat cards: jami postlar soni, jami yuborilgan xabarlar (sum of `sent_count`), joriy
    foydalanuvchilar soni (for context).
  - "Yangi post" button opens a modal: `ImageUpload` (optional), text `<textarea>`, button-text
    input (prefilled default), Submit → `POST /admin/announcements`.
  - History table: thumbnail/text preview, button text, status badge, `sent_count`/`failed_count`/
    `total_recipients`, `created_at`, and a "Qayta yuborish" row action → `POST
    /admin/announcements/{id}/resend`.
- No polling/websocket for live progress — reload the list on demand (refresh button / re-fetch
  after resend), consistent with how other admin pages behave today.

## Error handling
- Per-recipient send failures are caught and counted, never raised — a single blocked/deleted
  Telegram account must not abort the broadcast (same principle as `notify.py`).
- Broadcasting a post to zero users (no non-blocked users) still marks the row `sent` with
  `total_recipients=0`.

## Testing
- One backend check exercising the broadcast service against a fake/mocked Bot API call (success +
  one simulated failure), asserting `sent_count`/`failed_count`/`status` end up correct — the
  smallest thing that fails if the counting logic breaks.
