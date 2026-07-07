# Elon (Announcements) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a superadmin broadcast a text+optional-image+TMA-button post to every bot user from the admin panel, see send history/stats, and resend an old post.

**Architecture:** One new SQLAlchemy table (`announcements`) records each post and its send counters. A new service module sends the post to every non-blocked user's Telegram chat via the Bot API (same `httpx`-against-`api.telegram.org` style already used in `services/notify.py`), running as a `BackgroundTasks` job so the admin's HTTP request returns immediately. Three admin-only REST endpoints (list/create/resend) and one new admin-panel page (`AnnouncementsPage.tsx`) round it out, following the existing `SuppliesPage.tsx` CRUD-page pattern.

**Tech Stack:** FastAPI, SQLAlchemy 2.0, Pydantic, httpx (backend, all already in `requirements.txt` — no new dependencies); React + react-router + Tailwind (frontend, existing admin app).

Spec: `docs/superpowers/specs/2026-07-07-elon-announcements-design.md`

> **Amendment (post-Task-1 review):** `Announcement.status` was changed from a plain
> `Mapped[str]`/`String(16)` to a proper `AnnouncementStatus(str, enum.Enum)` in
> `app/models/enums.py` (values: `pending`, `sending`, `sent`), matching the codebase's existing
> convention for every other status-like column (`OrderStatus`, `PaymentStatus`, `AdminRole`).
> Tasks below still show `status: str` / string literals like `"sending"` in code samples — treat
> every such reference as `AnnouncementStatus.sending` etc. (import `AnnouncementStatus` from
> `app.models.enums` wherever `status` is read or written). Pydantic schemas and the FastAPI JSON
> response are unaffected: `AnnouncementStatus` is a `str` subclass, so it still serializes as the
> plain string (`"pending"`/`"sending"`/`"sent"`) — the frontend TypeScript union type in Task 5
> needs no change.

---

### Task 1: `Announcement` model

**Files:**
- Create: `backend/app/models/announcement.py`
- Modify: `backend/app/models/__init__.py`

- [ ] **Step 1: Create the model file**

```python
# backend/app/models/announcement.py
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Announcement(Base):
    """A broadcast post (text + optional image + TMA button) sent to bot users."""

    __tablename__ = "announcements"

    id: Mapped[int] = mapped_column(primary_key=True)
    text: Mapped[str] = mapped_column(Text)
    image_url: Mapped[str | None] = mapped_column(String(512))
    button_text: Mapped[str] = mapped_column(String(64), default="🛍 Ochish")
    status: Mapped[str] = mapped_column(String(16), default="pending")
    total_recipients: Mapped[int] = mapped_column(Integer, default=0)
    sent_count: Mapped[int] = mapped_column(Integer, default=0)
    failed_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
```

- [ ] **Step 2: Register the model**

Edit `backend/app/models/__init__.py` — add the import (alphabetical, before `AdminUser`) and the
`__all__` entry:

```python
from app.models.admin import AdminUser
from app.models.announcement import Announcement
from app.models.enums import AdminRole, OrderStatus, PaymentMethod, PaymentStatus
from app.models.order import Address, Courier, DeliveryZone, Order, OrderItem
from app.models.push import PushSubscription
from app.models.restaurant import Category, Product, Restaurant
from app.models.supply import SupplyRecord
from app.models.user import User

__all__ = [
    "AdminUser",
    "Announcement",
    "PushSubscription",
    "AdminRole",
    "OrderStatus",
    "PaymentMethod",
    "PaymentStatus",
    "Address",
    "Courier",
    "DeliveryZone",
    "Order",
    "OrderItem",
    "Category",
    "Product",
    "Restaurant",
    "SupplyRecord",
    "User",
]
```

- [ ] **Step 3: Verify the table gets created**

This is a brand-new table, so `Base.metadata.create_all` (invoked by `initdb.py`, which already
runs `import app.models` first) will create it — no Alembic migration needed. Confirm by running,
from `backend/` with the venv active and the DB reachable (adjust as needed for local setup — see
`docker-compose.local-test.yml` / `backend/.env` for connection settings):

```bash
cd backend && source venv/bin/activate && python -m app.initdb
```

Expected output ends with `Tables created / verified.` and no traceback. If Postgres isn't running
locally, this step can be deferred to the manual end-to-end check in Task 8 (running the whole
stack via docker-compose) — don't block on it here.

- [ ] **Step 4: Commit**

```bash
git add backend/app/models/announcement.py backend/app/models/__init__.py
git commit -m "feat(backend): add Announcement model"
```

---

### Task 2: Pydantic schemas

**Files:**
- Modify: `backend/app/schemas/admin.py`

- [ ] **Step 1: Append the two schemas**

Add to the end of `backend/app/schemas/admin.py` (it already has `from datetime import date,
datetime` at the top, so no new import is needed):

```python
class AnnouncementIn(BaseModel):
    text: str
    image_url: str | None = None
    button_text: str = "🛍 Ochish"


class AnnouncementOut(BaseModel):
    id: int
    text: str
    image_url: str | None = None
    button_text: str
    status: str
    total_recipients: int
    sent_count: int
    failed_count: int
    created_at: datetime
    sent_at: datetime | None = None

    class Config:
        from_attributes = True
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/schemas/admin.py
git commit -m "feat(backend): add Announcement schemas"
```

---

### Task 3: Broadcast service (with self-check)

This is the one piece of non-trivial logic in the feature (a loop that must tolerate
per-recipient failures and count them correctly), so it gets a runnable check — no pytest is
installed in this project (see `backend/requirements.txt`), so this follows the existing
project convention of plain scripts (like `app/initdb.py`) rather than introducing a test
framework: an `if __name__ == "__main__":` block with `assert`s.

**Files:**
- Create: `backend/app/services/announcements.py`

- [ ] **Step 1: Write the self-check first (it will fail — the module doesn't exist yet)**

Create `backend/app/services/announcements.py` with just the piece under test and its check:

```python
"""Broadcasts an Announcement to every non-blocked bot user via the Bot API.

Mirrors app/services/notify.py's style: plain httpx calls to api.telegram.org,
failures are swallowed per-recipient (one blocked/deleted account must never
abort the batch).
"""

import time
from collections.abc import Callable
from datetime import datetime, timezone

import httpx
from sqlalchemy import select

from app.core.config import settings
from app.core.db import SessionLocal
from app.models import Announcement, User

_MSG_API = f"https://api.telegram.org/bot{settings.bot_token}/sendMessage"
_PHOTO_API = f"https://api.telegram.org/bot{settings.bot_token}/sendPhoto"
_DELAY_SECONDS = 0.05  # ~20 msg/s, under Telegram's flood limit


def _keyboard(button_text: str) -> dict:
    return {"inline_keyboard": [[{"text": button_text, "web_app": {"url": settings.tma_url}}]]}


def _send_one(chat_id: int, text: str, image_url: str | None, button_text: str) -> bool:
    """Sends one message to one Telegram user. Returns True on success."""
    try:
        if image_url:
            resp = httpx.post(
                _PHOTO_API,
                data={
                    "chat_id": chat_id,
                    "photo": image_url,
                    "caption": text,
                    "parse_mode": "HTML",
                    "reply_markup": _reply_markup_json(button_text),
                },
                timeout=10,
            )
        else:
            resp = httpx.post(
                _MSG_API,
                json={
                    "chat_id": chat_id,
                    "text": text,
                    "parse_mode": "HTML",
                    "reply_markup": _keyboard(button_text),
                },
                timeout=10,
            )
        return resp.status_code == 200
    except Exception:
        return False


def _reply_markup_json(button_text: str) -> str:
    import json
    return json.dumps(_keyboard(button_text))


def _send_all(
    telegram_ids: list[int],
    text: str,
    image_url: str | None,
    button_text: str,
    send: Callable[[int, str, str | None, str], bool] = _send_one,
) -> tuple[int, int]:
    """Sends to every id, tolerating individual failures. Returns (sent, failed)."""
    sent = failed = 0
    for chat_id in telegram_ids:
        if send(chat_id, text, image_url, button_text):
            sent += 1
        else:
            failed += 1
        time.sleep(_DELAY_SECONDS)
    return sent, failed


def broadcast(announcement_id: int) -> None:
    """Runs as a BackgroundTasks job — opens its own DB session since the
    request session that created the Announcement row is already closed."""
    with SessionLocal() as db:
        ann = db.get(Announcement, announcement_id)
        if not ann:
            return
        telegram_ids = list(
            db.scalars(select(User.telegram_id).where(User.is_blocked.is_(False))).all()
        )
        ann.status = "sending"
        ann.total_recipients = len(telegram_ids)
        db.commit()

        sent, failed = _send_all(telegram_ids, ann.text, ann.image_url, ann.button_text)

        ann.sent_count = sent
        ann.failed_count = failed
        ann.status = "sent"
        ann.sent_at = datetime.now(timezone.utc)
        db.commit()


if __name__ == "__main__":
    def _fake_send(chat_id: int, text: str, image_url: str | None, button_text: str) -> bool:
        return chat_id != 2  # simulate chat_id 2 failing (e.g. user blocked the bot)

    result = _send_all([1, 2, 3], "hi", None, "Ochish", send=_fake_send)
    assert result == (2, 1), f"expected (2, 1), got {result}"
    print("announcements self-check OK")
```

- [ ] **Step 2: Run it to verify the self-check passes**

(There's nothing to "fail first" here in the pytest sense since it's a single new file, so step 1
already includes the implementation — run it now to confirm the counting logic is correct.)

```bash
cd backend && source venv/bin/activate && python -m app.services.announcements
```

Expected output: `announcements self-check OK` and no `AssertionError`.

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/announcements.py
git commit -m "feat(backend): add announcement broadcast service"
```

---

### Task 4: Admin API routes

**Files:**
- Modify: `backend/app/api/routes/admin.py`

- [ ] **Step 1: Add the two model/schema names to the existing top-of-file imports**

Change:

```python
from app.models import (
    AdminUser, Category, Order, OrderItem, Product, PushSubscription, Restaurant, SupplyRecord, User,
)
```

to:

```python
from app.models import (
    AdminUser, Announcement, Category, Order, OrderItem, Product, PushSubscription, Restaurant,
    SupplyRecord, User,
)
```

And change:

```python
from app.schemas.admin import (
    DashboardStats, PeriodPoint, PushSubscriptionIn, ReportsOut,
    StockUpdate, SupplyRecordIn, SupplyRecordOut, TopProduct,
)
```

to:

```python
from app.schemas.admin import (
    AnnouncementIn, AnnouncementOut, DashboardStats, PeriodPoint, PushSubscriptionIn, ReportsOut,
    StockUpdate, SupplyRecordIn, SupplyRecordOut, TopProduct,
)
```

And add, next to the existing `from app.services.notify import notify_status_change` line:

```python
from app.services.announcements import broadcast
```

- [ ] **Step 2: Add the routes**

Append to the end of `backend/app/api/routes/admin.py` (after the existing "Admin users" section,
reusing the `require_superadmin` import that section already brings in):

```python
# ── Announcements (Elon) — broadcast a post to all bot users ────
@router.get("/announcements", response_model=list[AnnouncementOut])
def list_announcements(
    _: AdminUser = Depends(require_superadmin),
    db: Session = Depends(get_db),
):
    return db.scalars(select(Announcement).order_by(Announcement.created_at.desc())).all()


@router.post("/announcements", response_model=AnnouncementOut, status_code=201)
def create_announcement(
    data: AnnouncementIn,
    background: BackgroundTasks,
    _: AdminUser = Depends(require_superadmin),
    db: Session = Depends(get_db),
):
    ann = Announcement(**data.model_dump())
    db.add(ann)
    db.commit()
    db.refresh(ann)
    background.add_task(broadcast, ann.id)
    return ann


@router.post("/announcements/{aid}/resend", response_model=AnnouncementOut, status_code=201)
def resend_announcement(
    aid: int,
    background: BackgroundTasks,
    _: AdminUser = Depends(require_superadmin),
    db: Session = Depends(get_db),
):
    original = db.get(Announcement, aid)
    if not original:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Announcement not found")
    ann = Announcement(
        text=original.text, image_url=original.image_url, button_text=original.button_text,
    )
    db.add(ann)
    db.commit()
    db.refresh(ann)
    background.add_task(broadcast, ann.id)
    return ann
```

- [ ] **Step 3: Sanity-check the app still imports**

```bash
cd backend && source venv/bin/activate && python -c "from app.main import app; print('ok')"
```

Expected output: `ok` (this catches import typos/circular-import mistakes without needing a live
DB or a running server).

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/routes/admin.py
git commit -m "feat(backend): add announcement list/create/resend endpoints"
```

---

### Task 5: Frontend type

**Files:**
- Modify: `admin/src/types.ts`

- [ ] **Step 1: Append the type**

Add to the end of `admin/src/types.ts`:

```typescript
export interface Announcement {
  id: number;
  text: string;
  image_url?: string | null;
  button_text: string;
  status: "pending" | "sending" | "sent";
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  sent_at?: string | null;
}
```

- [ ] **Step 2: Commit**

```bash
git add admin/src/types.ts
git commit -m "feat(admin): add Announcement type"
```

---

### Task 6: Announcements page

**Files:**
- Create: `admin/src/pages/AnnouncementsPage.tsx`

- [ ] **Step 1: Create the page**

Follows `admin/src/pages/SuppliesPage.tsx`'s conventions (same `card`/`btn`/`input`/`th`/`td`
Tailwind classes, same load/save/toast pattern, reuses the existing `ImageUpload` component and
`get`/`post` API helpers — no new frontend dependency).

```tsx
import { CircleCheck, CircleX, Megaphone, Plus, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { get, post } from "../api";
import ImageUpload from "../components/ImageUpload";
import { ErrorRetry, TableSkeleton } from "../components/Skeleton";
import type { Announcement, DashboardStats } from "../types";

const STATUS_LABEL: Record<Announcement["status"], string> = {
  pending: "Navbatda",
  sending: "Yuborilmoqda…",
  sent: "Yuborildi",
};

export default function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const [form, setForm] = useState<{ text: string; image_url: string | null; button_text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setErr(false);
    try {
      const [list, stats] = await Promise.all([
        get<Announcement[]>("/admin/announcements"),
        get<DashboardStats>("/admin/stats"),
      ]);
      setItems(list);
      setUsersTotal(stats.users_total);
    } catch {
      setErr(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openForm = () => setForm({ text: "", image_url: null, button_text: "🛍 Ochish" });

  const save = async () => {
    if (!form || !form.text.trim() || saving) return;
    setSaving(true);
    try {
      await post("/admin/announcements", form);
      setForm(null);
      toast.success("Post yuborish boshlandi");
      load();
    } catch {
      toast.error("Yuborib bo'lmadi");
    } finally {
      setSaving(false);
    }
  };

  const resend = async (a: Announcement) => {
    try {
      await post(`/admin/announcements/${a.id}/resend`, {});
      toast.success("Qayta yuborish boshlandi");
      load();
    } catch {
      toast.error("Qayta yuborib bo'lmadi");
    }
  };

  const totalSent = items.reduce((s, a) => s + a.sent_count, 0);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-1">Elon</h1>
      <p className="text-slate-500 mb-5">
        Botga rasmli/matnli post yuboring — tugma orqali ilova ochiladi.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <Card label="Jami postlar" value={String(items.length)} />
        <Card label="Jami yuborilgan xabar" value={String(totalSent)} />
        <Card label="Foydalanuvchilar" value={String(usersTotal)} />
      </div>

      <div className="flex justify-end mb-4">
        <button className="btn" onClick={openForm}>
          <Plus size={18} /> Yangi post
        </button>
      </div>

      {err ? <ErrorRetry onRetry={load} /> : loading ? <TableSkeleton cols={6} /> : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className="th">Sana</th>
                <th className="th">Post</th>
                <th className="th">Tugma</th>
                <th className="th">Holat</th>
                <th className="th">Yuborildi / Xato / Jami</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50/60">
                  <td className="td text-slate-500 text-sm">
                    {new Date(a.created_at).toLocaleString("ru-RU")}
                  </td>
                  <td className="td max-w-[260px]">
                    <div className="flex items-center gap-2">
                      {a.image_url && (
                        <img
                          src={a.image_url}
                          alt=""
                          className="h-10 w-10 rounded-lg object-cover bg-slate-100 shrink-0"
                        />
                      )}
                      <span className="truncate text-slate-700">{a.text}</span>
                    </div>
                  </td>
                  <td className="td text-sm">{a.button_text}</td>
                  <td className="td text-sm">{STATUS_LABEL[a.status]}</td>
                  <td className="td text-sm font-medium">
                    {a.sent_count} / {a.failed_count} / {a.total_recipients}
                  </td>
                  <td className="td text-right">
                    <button
                      className="icon-btn hover:text-brand"
                      title="Qayta yuborish"
                      onClick={() => resend(a)}
                    >
                      <RotateCcw size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="td text-center text-slate-400 py-10">
                    Hali post yuborilmagan
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="card p-6 w-[28rem] max-h-[90vh] overflow-auto space-y-3">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <Megaphone size={18} /> Yangi post
            </h2>

            <ImageUpload
              value={form.image_url}
              onChange={(url) => setForm({ ...form, image_url: url })}
              label="Rasm (ixtiyoriy)"
            />

            <label className="block">
              <span className="text-xs text-slate-500">Matn</span>
              <textarea
                className="input mt-1"
                rows={4}
                placeholder="Post matni..."
                value={form.text}
                onChange={(e) => setForm({ ...form, text: e.target.value })}
              />
            </label>

            <label className="block">
              <span className="text-xs text-slate-500">Tugma matni</span>
              <input
                className="input mt-1"
                value={form.button_text}
                onChange={(e) => setForm({ ...form, button_text: e.target.value })}
              />
            </label>

            <div className="flex gap-2 justify-end pt-2">
              <button className="btn-ghost" onClick={() => setForm(null)}>
                <CircleX size={16} /> Bekor
              </button>
              <button className="btn" onClick={save} disabled={!form.text.trim() || saving}>
                <CircleCheck size={16} /> Yuborish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-5">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="text-2xl font-bold mt-1 tracking-tight">{value}</div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add admin/src/pages/AnnouncementsPage.tsx
git commit -m "feat(admin): add AnnouncementsPage"
```

---

### Task 7: Wire up routing and nav

**Files:**
- Modify: `admin/src/App.tsx`
- Modify: `admin/src/components/Layout.tsx`

- [ ] **Step 1: Add the route in `App.tsx`**

Add the import next to the other page imports:

```typescript
import AnnouncementsPage from "./pages/AnnouncementsPage";
```

Add the route next to the other `SUPERADMIN`-gated routes (e.g. right after the `/reports` line):

```tsx
<Route path="/announcements" element={<Protected roles={SUPERADMIN}><AnnouncementsPage /></Protected>} />
```

- [ ] **Step 2: Add the nav link in `Layout.tsx`**

Add `Megaphone` to the existing lucide-react import line:

```typescript
import {
  Bike, BarChart3, LayoutDashboard, LogOut, MapPinned, Megaphone, Menu, ReceiptText,
  Settings, ShoppingBasket, Store, Truck, Users, Warehouse, X,
} from "lucide-react";
```

Add a link entry to the `links` array, next to the other `roles: ["superadmin"]` entries:

```typescript
  { to: "/announcements", label: "Elon", icon: Megaphone, roles: ["superadmin"] },
```

- [ ] **Step 3: Commit**

```bash
git add admin/src/App.tsx admin/src/components/Layout.tsx
git commit -m "feat(admin): wire up Elon (announcements) page routing and nav"
```

---

### Task 8: End-to-end manual verification

**Files:** none (verification only)

- [ ] **Step 1: Start the stack**

```bash
cd "/Users/user/Desktop/All Foods" && docker-compose -f docker-compose.local-test.yml up -d --build
```

(Use whichever compose file/workflow is already used for local dev — check `README.md` if
unsure. The goal is a running backend + Postgres + the admin frontend dev server.)

- [ ] **Step 2: Log into the admin panel as a superadmin**, open the new **Elon** nav link, and
confirm the page loads with empty stats (0 postlar) and no console errors.

- [ ] **Step 3: Create a test post** with just text (no image) targeting a Telegram account you
control that has started the bot (so it's in the `users` table and not blocked). Confirm:
  - The row appears in the history table with status `Yuborilmoqda…` then `Yuborildi` on refresh.
  - The Telegram account receives the message with the button, and tapping the button opens the
    TMA.

- [ ] **Step 4: Create a second test post with an image**, confirm the photo + caption + button
arrive correctly in Telegram.

- [ ] **Step 5: Click "Qayta yuborish" on one of the rows**, confirm a new row appears in the
history (the original row is unchanged) and the message arrives again in Telegram.

- [ ] **Step 6: Confirm role gating** — log in as (or temporarily check) a `manager` account and
confirm `/announcements` is not reachable (redirects away) and the nav link isn't shown, matching
how `/reports`/`/users` already behave for managers.

No commit for this task — it's verification of work already committed in Tasks 1–7. If any step
uncovers a bug, fix it in the relevant task's file and commit a follow-up fix commit.
