# Admin Navbar + Order-Status Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins get a browser push notification when a courier accepts or delivers an order (not just on new orders, which already works), plus a real navbar (desktop + mobile) with a bell showing recent order activity.

**Architecture:** Two new `webpush.notify_admins(...)` calls slot into the existing courier status-update routes, reusing the push infrastructure that already fires on new orders. A new read-only endpoint derives a notification feed directly from the `orders` table (no new table). The existing mobile-only header becomes the shared navbar for all screen sizes, gaining a polling `NotificationBell` component.

**Tech Stack:** FastAPI, SQLAlchemy (backend — no new dependencies); React + Tailwind + lucide-react icons (frontend admin app — no new dependencies).

Spec: `docs/superpowers/specs/2026-07-07-admin-navbar-notifications-design.md`

**Important — nested repos:** `backend/` and `admin/` are each their OWN independent git
repositories (separate `.git`, not submodules of the outer "All Foods" folder). Every task below
must run its file edits and git commands with cwd set to the correct nested repo
(`/Users/user/Desktop/All Foods/backend` or `/Users/user/Desktop/All Foods/admin`), using paths
relative to that repo root (e.g. `git add app/api/routes/courier.py`, never prefixed with
`backend/`).

---

### Task 1: Push admins on order accepted/delivered

**Files:**
- Modify: `backend/app/api/routes/courier.py`

- [ ] **Step 1: Add the `webpush` import**

At the top of `backend/app/api/routes/courier.py`, add this import next to the existing
`from app.services.orders import decrement_stock_atomic, ensure_transition` line:

```python
from app.services import webpush
```

- [ ] **Step 2: Push on accept**

Find this existing block inside `courier_update_order` (it currently only notifies the customer):

```python
    # "Qabul qilindi" — mijozga status xabari (bot).
    if notify_accept:
        background.add_task(notify_status_change, order, order.user.telegram_id)
```

Change it to also push the admin panel:

```python
    # "Qabul qilindi" — mijozga status xabari (bot) + admin panelga push.
    if notify_accept:
        background.add_task(notify_status_change, order, order.user.telegram_id)
        background.add_task(
            webpush.notify_admins,
            f"✅ Buyurtma qabul qilindi № {order.number}",
            f"{order.total:,} so'm · {order.address_line}",
            url="/orders",
            tag=f"accepted-{order.id}",
        )
```

- [ ] **Step 3: Push on delivered**

Find this line inside `courier_mark_delivered`:

```python
    background.add_task(notify_status_change, order, order.user.telegram_id)
    return order
```

(it's the second-to-last line of that function, right before `return order`). Change it to:

```python
    background.add_task(notify_status_change, order, order.user.telegram_id)
    background.add_task(
        webpush.notify_admins,
        f"🎉 Buyurtma yetkazildi № {order.number}",
        f"{order.total:,} so'm · {order.address_line}",
        url="/orders",
        tag=f"delivered-{order.id}",
    )
    return order
```

- [ ] **Step 4: Verify the app still imports**

```bash
cd "/Users/user/Desktop/All Foods/backend" && source venv/bin/activate && python -c "from app.main import app; print('ok')"
```

Expected output: `ok`

- [ ] **Step 5: Commit**

```bash
cd "/Users/user/Desktop/All Foods/backend" && git add app/api/routes/courier.py && git commit -m "feat(backend): push admin panel on order accepted/delivered"
```

---

### Task 2: `GET /admin/notifications` endpoint

**Files:**
- Modify: `backend/app/schemas/admin.py`
- Modify: `backend/app/api/routes/admin.py`

- [ ] **Step 1: Add the schema**

Append to the end of `backend/app/schemas/admin.py` (the file already has `from pydantic import
BaseModel` and `from datetime import date, datetime` at the top):

```python
class NotificationEvent(BaseModel):
    type: str  # "new" | "accepted" | "delivered"
    order_id: int
    order_number: str
    total: int
    address_line: str
    at: datetime
```

- [ ] **Step 2: Add the endpoint**

`app/api/routes/admin.py` already imports `Order` (top-level `from app.models import (...)` block)
and already has `from app.schemas.admin import (...)` — add `NotificationEvent` to that import
tuple. Then append this to the end of the file:

```python
# ── Notifications (bildirishnoma) — recent order activity, derived from
# the orders table directly (no separate notification log to maintain) ──
@router.get("/notifications", response_model=list[NotificationEvent])
def list_notifications(db: Session = Depends(get_db)):
    orders = db.scalars(
        select(Order).order_by(Order.created_at.desc()).limit(50)
    ).all()

    events: list[NotificationEvent] = []
    for o in orders:
        events.append(NotificationEvent(
            type="new", order_id=o.id, order_number=o.number,
            total=o.total, address_line=o.address_line, at=o.created_at,
        ))
        if o.courier_accepted_at:
            events.append(NotificationEvent(
                type="accepted", order_id=o.id, order_number=o.number,
                total=o.total, address_line=o.address_line, at=o.courier_accepted_at,
            ))
        if o.courier_delivered_at:
            events.append(NotificationEvent(
                type="delivered", order_id=o.id, order_number=o.number,
                total=o.total, address_line=o.address_line, at=o.courier_delivered_at,
            ))

    events.sort(key=lambda e: e.at, reverse=True)
    return events[:30]
```

This lives under the router-level `require_staff` dependency already applied to the whole
`router` in this file (`router = APIRouter(prefix="/admin", ..., dependencies=[Depends(require_staff)])`)
— no extra auth wiring needed.

- [ ] **Step 3: Verify it imports**

```bash
cd "/Users/user/Desktop/All Foods/backend" && source venv/bin/activate && python -c "from app.main import app; print('ok')"
```

Expected output: `ok`

- [ ] **Step 4: Commit**

```bash
cd "/Users/user/Desktop/All Foods/backend" && git add app/schemas/admin.py app/api/routes/admin.py && git commit -m "feat(backend): add GET /admin/notifications endpoint"
```

---

### Task 3: Frontend type + NotificationBell component

**Files:**
- Modify: `admin/src/types.ts`
- Create: `admin/src/components/NotificationBell.tsx`

- [ ] **Step 1: Add the type**

Append to the end of `admin/src/types.ts`:

```typescript
export interface NotificationEvent {
  type: "new" | "accepted" | "delivered";
  order_id: number;
  order_number: string;
  total: number;
  address_line: string;
  at: string;
}
```

- [ ] **Step 2: Create the component**

```tsx
// admin/src/components/NotificationBell.tsx
import { Bell, CheckCircle2, PackageCheck, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { get } from "../api";
import type { NotificationEvent } from "../types";

const SEEN_KEY = "af_admin_notif_last_seen";

const ICON: Record<NotificationEvent["type"], typeof Bell> = {
  new: Sparkles,
  accepted: CheckCircle2,
  delivered: PackageCheck,
};

const LABEL: Record<NotificationEvent["type"], string> = {
  new: "Yangi buyurtma",
  accepted: "Qabul qilindi",
  delivered: "Yetkazildi",
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "hozir";
  if (min < 60) return `${min} daq oldin`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} soat oldin`;
  return `${Math.floor(hr / 24)} kun oldin`;
}

export default function NotificationBell() {
  const [events, setEvents] = useState<NotificationEvent[]>([]);
  const [open, setOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState(
    () => localStorage.getItem(SEEN_KEY) ?? new Date().toISOString(),
  );
  const boxRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      setEvents(await get<NotificationEvent[]>("/admin/notifications"));
    } catch {
      // silent — bell just won't update this poll cycle
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const unseen = events.filter((e) => e.at > lastSeen).length;

  const toggle = () => {
    setOpen((o) => !o);
    if (!open && events.length) {
      const newest = events[0].at;
      setLastSeen(newest);
      localStorage.setItem(SEEN_KEY, newest);
    }
  };

  return (
    <div className="relative" ref={boxRef}>
      <button
        className="icon-btn relative"
        onClick={toggle}
        aria-label="Bildirishnomalar"
      >
        <Bell size={20} />
        {unseen > 0 && (
          <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold grid place-items-center">
            {unseen > 9 ? "9+" : unseen}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-auto card p-2 z-50 shadow-lg">
          {events.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-6">Hozircha faoliyat yo'q</p>
          )}
          {events.map((e, i) => {
            const Icon = ICON[e.type];
            return (
              <div
                key={`${e.order_id}-${e.type}-${i}`}
                className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50"
              >
                <span className="grid place-items-center h-8 w-8 rounded-lg bg-brand/10 text-brand shrink-0">
                  <Icon size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-800">
                    {LABEL[e.type]} · № {e.order_number}
                  </div>
                  <div className="text-xs text-slate-500 truncate">{e.address_line}</div>
                </div>
                <span className="text-xs text-slate-400 shrink-0">{timeAgo(e.at)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
cd "/Users/user/Desktop/All Foods/admin" && git add src/types.ts src/components/NotificationBell.tsx && git commit -m "feat(admin): add NotificationBell component"
```

---

### Task 4: Wire the navbar into Layout

**Files:**
- Modify: `admin/src/components/Layout.tsx`

- [ ] **Step 1: Import `NotificationBell`**

Add near the top of `admin/src/components/Layout.tsx`, alongside the existing
`import PushButton from "./PushButton";` line:

```typescript
import NotificationBell from "./NotificationBell";
```

- [ ] **Step 2: Turn the mobile-only header into the shared navbar**

Find this existing block:

```tsx
      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 flex items-center gap-3 h-14 px-4 bg-white border-b border-slate-200">
        <button className="icon-btn" onClick={() => setOpen(true)} aria-label="Menu"><Menu size={22} /></button>
        <span className="grid place-items-center h-8 w-8 rounded-lg bg-brand text-white"><Store size={18} /></span>
        <span className="font-bold tracking-tight">All Foods</span>
      </header>
```

Replace it with:

```tsx
      {/* Navbar — mobile top bar + desktop header (offset past the fixed sidebar) */}
      <header className="sticky top-0 z-30 flex items-center gap-3 h-14 px-4 bg-white border-b border-slate-200 md:ml-64">
        <button className="icon-btn md:hidden" onClick={() => setOpen(true)} aria-label="Menu"><Menu size={22} /></button>
        <span className="grid place-items-center h-8 w-8 rounded-lg bg-brand text-white md:hidden"><Store size={18} /></span>
        <span className="font-bold tracking-tight md:hidden">All Foods</span>
        <span className="ml-auto">
          <NotificationBell />
        </span>
      </header>
```

(The mobile-only logo/title stay `md:hidden` — on desktop the sidebar already shows the "All
Foods" branding, so the navbar itself only needs to carry the bell there.)

- [ ] **Step 3: Commit**

```bash
cd "/Users/user/Desktop/All Foods/admin" && git add src/components/Layout.tsx && git commit -m "feat(admin): show navbar on desktop, add notification bell"
```

---

### Task 5: End-to-end manual verification

**Files:** none (verification only)

- [ ] **Step 1: Start the stack** (backend + admin dev server), matching whatever local workflow
is already in use (see `README.md` / `docker-compose.local-test.yml`).

- [ ] **Step 2: Confirm the navbar renders on desktop** — open the admin panel in a desktop-width
browser window and confirm a top bar with the bell icon is now visible (previously nothing was
there), and that it doesn't overlap the sidebar.

- [ ] **Step 3: Confirm the navbar still works on mobile** — narrow the browser window (or use
device emulation) and confirm the menu button + logo + bell all still show and the drawer still
opens.

- [ ] **Step 4: Confirm the bell fetches and displays events** — place a test order through the
TMA (or use existing test data), confirm a "Yangi buyurtma" event appears in the bell dropdown
within 30s, and the badge count increments.

- [ ] **Step 5: Confirm accept/deliver pushes** — as a courier, accept then deliver that test
order; confirm (a) a browser push notification arrives for each step (if push is enabled in this
browser profile — see `PushButton`), and (b) the corresponding "Qabul qilindi"/"Yetkazildi" events
show up in the bell dropdown.

- [ ] **Step 6: Confirm the badge clears** — click the bell, confirm the unseen badge disappears,
reload the page, confirm it stays cleared (persisted via `localStorage`) until a genuinely new
event arrives.

No commit for this task — it's verification of work already committed in Tasks 1–4. If any step
uncovers a bug, fix it in the relevant task's file and commit a follow-up fix commit.
