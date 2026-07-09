# Platform Superadmin (Sub-project 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Give the platform owner ("biz") an account they can actually log into, the ability to create/manage businessman (`Business`) accounts, and a platform-wide analytics view: how many businesses, stores, and customers exist, and what revenue/cost/profit each business is producing.

**Architecture:** Extends the existing `/platform` router (created in sub-project 2a, guarded by `require_platform_admin`, currently holding announcements + user block/delete). Adds `/platform/businesses` CRUD and `/platform/stats`. Stats reuse `_agg(db, restaurant_id, start)` from `app/api/routes/admin.py` — the same helper `/business/stats` uses — summed per business. Plus a new `superadmin/` React+TS PWA mirroring the `businessman/` app's structure.

**Tech Stack:** FastAPI, SQLAlchemy 2.0, Postgres, pytest. Frontend: Vite + React 18 + TS + Tailwind + react-router + zustand + sonner + lucide + vite-plugin-pwa.

**Base branch:** builds on `businessman-backend-2a` (not yet merged to master). Create a worktree from it:
```bash
cd "/Users/user/Desktop/All Foods/backend"
git worktree add .worktrees/superadmin-3 -b superadmin-3 businessman-backend-2a
cd .worktrees/superadmin-3 && python3.12 -m venv venv && source venv/bin/activate && pip install -r requirements.txt
```
Test Postgres/Redis: `docker compose -p allfoods-test -f "/Users/user/Desktop/All Foods/docker-compose.local-test.yml" up -d postgres redis` — **always pass `-p allfoods-test`**; omitting it stops the user's main `allfoods` stack.

Baseline: `pytest -q` → 59 passed.

---

### Task 1: Bootstrap the first platform admin in `seed.py`

**Blocker being fixed:** `platform_admins` is empty on every install. Nobody can log into `/platform/auth/login`, so the superadmin PWA has no way in.

**Files:**
- Modify: `app/core/config.py`
- Modify: `app/seed.py`
- Modify: `.env.example`
- Test: `tests/test_seed_platform_admin.py`

- [ ] **Step 1: Write the failing test**

Create `tests/test_seed_platform_admin.py`:

```python
from sqlalchemy import select

from app.models import PlatformAdmin


def test_seed_creates_platform_admin_and_is_idempotent(db_session, monkeypatch):
    from app import seed as seed_module

    monkeypatch.setattr(seed_module, "SessionLocal", lambda: db_session)
    # db_session's context-manager exit must not close the fixture's session.
    monkeypatch.setattr(db_session, "close", lambda: None)

    seed_module.seed()
    seed_module.seed()  # second run must not duplicate

    admins = db_session.scalars(select(PlatformAdmin)).all()
    assert len(admins) == 1
    assert admins[0].username == "platform"
```

**Note:** the test asserts the default username `platform`. If `settings.first_platform_username` resolves to something else in the test environment (e.g. a stray `.env`), assert on `settings.first_platform_username` instead of the literal.

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_seed_platform_admin.py -v`
Expected: FAIL — `assert 0 == 1` (no `PlatformAdmin` row is created).

- [ ] **Step 3: Add the settings and the seed block**

In `app/core/config.py`, next to the existing `first_admin_username`/`first_admin_password`:

```python
    # Platform superadmin bootstrap
    first_platform_username: str = "platform"
    first_platform_password: str = "platform12345"
```

In `app/seed.py`, import `PlatformAdmin` and append a block at the end of `seed()`:

```python
        # ── bootstrap platform superadmin (bizning akkaunt) ──
        if not db.scalar(
            select(PlatformAdmin).where(
                PlatformAdmin.username == settings.first_platform_username
            )
        ):
            db.add(PlatformAdmin(
                username=settings.first_platform_username,
                hashed_password=hash_password(settings.first_platform_password),
            ))
            db.commit()
            print(f"Created platform admin '{settings.first_platform_username}'.")
```

Update the import line to `from app.models import AdminUser, Business, PlatformAdmin, Restaurant`.

In `.env.example`, document the two new vars near `FIRST_ADMIN_*`:
```
FIRST_PLATFORM_USERNAME=platform
FIRST_PLATFORM_PASSWORD=change-me-in-production
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_seed_platform_admin.py -v` → 1 passed
Run: `pytest -q` → 60 passed

- [ ] **Step 5: Commit**

```bash
git add app/core/config.py app/seed.py .env.example tests/test_seed_platform_admin.py
git commit -m "feat: bootstrap the first platform admin in seed.py"
```

---

### Task 2: `/platform/businesses` CRUD

**Files:**
- Modify: `app/schemas/business.py`
- Modify: `app/api/routes/platform.py`
- Test: `tests/test_platform_businesses.py`

- [ ] **Step 1: Write the failing test**

Create `tests/test_platform_businesses.py`:

```python
import pytest

from app.core.security import create_access_token, hash_password
from app.models import PlatformAdmin
from tests.conftest import auth


@pytest.fixture
def platform_token(db_session) -> str:
    admin = PlatformAdmin(username="plat_biz", hashed_password=hash_password("pw"))
    db_session.add(admin)
    db_session.commit()
    return create_access_token(subject=str(admin.id), role="platform_superadmin")


def test_list_businesses_includes_store_count(client, platform_token, tenant_a):
    resp = client.get("/api/platform/businesses", headers=auth(platform_token))
    assert resp.status_code == 200
    rows = resp.json()
    assert len(rows) == 1
    assert rows[0]["id"] == tenant_a.business_id
    assert rows[0]["stores_count"] == 1


def test_create_business(client, platform_token):
    resp = client.post(
        "/api/platform/businesses",
        json={"name": "Yangi biznes", "username": "yangi_biz", "password": "pw123456"},
        headers=auth(platform_token),
    )
    assert resp.status_code == 201
    assert resp.json()["username"] == "yangi_biz"
    assert "hashed_password" not in resp.json()


def test_created_business_can_log_in(client, platform_token):
    client.post(
        "/api/platform/businesses",
        json={"name": "Login biznes", "username": "login_biz", "password": "pw123456"},
        headers=auth(platform_token),
    )
    resp = client.post(
        "/api/business/auth/login", json={"username": "login_biz", "password": "pw123456"}
    )
    assert resp.status_code == 200


def test_duplicate_username_rejected(client, platform_token, tenant_a):
    resp = client.post(
        "/api/platform/businesses",
        json={"name": "Takror", "username": "biz_a", "password": "pw123456"},
        headers=auth(platform_token),
    )
    assert resp.status_code == 409


def test_toggle_business(client, platform_token, tenant_a):
    resp = client.patch(
        f"/api/platform/businesses/{tenant_a.business_id}/toggle",
        headers=auth(platform_token),
    )
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False


def test_business_with_stores_cannot_be_deleted(client, platform_token, tenant_a):
    resp = client.delete(
        f"/api/platform/businesses/{tenant_a.business_id}", headers=auth(platform_token)
    )
    assert resp.status_code == 409


def test_empty_business_can_be_deleted(client, platform_token):
    created = client.post(
        "/api/platform/businesses",
        json={"name": "Bo'sh", "username": "bosh_biz", "password": "pw123456"},
        headers=auth(platform_token),
    ).json()
    resp = client.delete(
        f"/api/platform/businesses/{created['id']}", headers=auth(platform_token)
    )
    assert resp.status_code == 204


def test_business_token_rejected(client, tenant_a):
    resp = client.get("/api/platform/businesses", headers=auth(tenant_a.business_token))
    assert resp.status_code == 401
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_platform_businesses.py -v`
Expected: FAIL with 404 (routes don't exist).

- [ ] **Step 3: Add schemas and endpoints**

Append to `app/schemas/business.py`:

```python
class BusinessCreateIn(BaseModel):
    name: str
    username: str
    password: str
    phone: str | None = None


class BusinessRow(BusinessOut):
    stores_count: int
```

In `app/api/routes/platform.py`, add imports (`func`, `hash_password`, `Business`, `Restaurant`, the new schemas) and these endpoints:

```python
# ── Businesses (tadbirkorlar) ────────────────────────────────────
@router.get("/businesses", response_model=list[BusinessRow])
def list_businesses(db: Session = Depends(get_db)):
    rows = db.execute(
        select(Business, func.count(Restaurant.id))
        .outerjoin(Restaurant, Restaurant.business_id == Business.id)
        .group_by(Business.id)
        .order_by(Business.created_at.desc())
    ).all()
    return [
        BusinessRow(**BusinessOut.model_validate(b).model_dump(), stores_count=n)
        for b, n in rows
    ]


@router.post("/businesses", response_model=BusinessOut, status_code=201)
def create_business(data: BusinessCreateIn, db: Session = Depends(get_db)):
    if db.scalar(select(Business).where(Business.username == data.username)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Username already taken")
    b = Business(
        name=data.name,
        username=data.username,
        phone=data.phone,
        hashed_password=hash_password(data.password),
    )
    db.add(b)
    db.commit()
    db.refresh(b)
    return b


@router.patch("/businesses/{bid}/toggle", response_model=BusinessOut)
def toggle_business(bid: int, db: Session = Depends(get_db)):
    b = db.get(Business, bid)
    if not b:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Business not found")
    b.is_active = not b.is_active
    db.commit()
    db.refresh(b)
    return b


@router.delete("/businesses/{bid}", status_code=204)
def delete_business(bid: int, db: Session = Depends(get_db)):
    """Do'koni bor biznes o'chirilmaydi (409) — cascade uning do'konlarini,
    mahsulotlarini va xodimlarini ham olib ketardi."""
    b = db.get(Business, bid)
    if not b:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Business not found")
    stores = db.scalar(
        select(func.count(Restaurant.id)).where(Restaurant.business_id == bid)
    )
    if stores:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Do'koni bor bizneslni o'chirib bo'lmaydi"
        )
    db.delete(b)
    db.commit()
```

**Note:** `BusinessOut` must not expose `hashed_password` — verify it doesn't (it shouldn't; check `app/schemas/business.py`).

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_platform_businesses.py -v` → 8 passed
Run: `pytest -q` → 68 passed

- [ ] **Step 5: Commit**

```bash
git add app/schemas/business.py app/api/routes/platform.py tests/test_platform_businesses.py
git commit -m "feat: add /platform/businesses CRUD"
```

---

### Task 3: `/platform/stats` — platform-wide analytics

**Files:**
- Modify: `app/schemas/business.py`
- Modify: `app/api/routes/platform.py`
- Test: `tests/test_platform_stats.py`

- [ ] **Step 1: Write the failing test**

Create `tests/test_platform_stats.py`:

```python
import pytest

from app.core.security import create_access_token, hash_password
from app.models import PlatformAdmin
from tests.conftest import auth, make_order


@pytest.fixture
def platform_token(db_session) -> str:
    admin = PlatformAdmin(username="plat_stats", hashed_password=hash_password("pw"))
    db_session.add(admin)
    db_session.commit()
    return create_access_token(subject=str(admin.id), role="platform_superadmin")


def test_platform_stats_counts_everything(client, db_session, platform_token, tenant_a, tenant_b):
    make_order(db_session, tenant_a, total=5_000)
    make_order(db_session, tenant_b, total=7_000)

    resp = client.get("/api/platform/stats?period=all", headers=auth(platform_token))
    assert resp.status_code == 200
    body = resp.json()

    assert body["businesses_total"] == 2
    assert body["stores_total"] == 2
    assert body["customers_total"] == 2
    assert body["total_orders"] == 2
    assert body["total_revenue"] == 12_000  # both businesses, unlike /business/stats
    assert len(body["businesses"]) == 2


def test_platform_stats_breaks_down_per_business(client, db_session, platform_token, tenant_a, tenant_b):
    make_order(db_session, tenant_a, total=5_000)

    resp = client.get("/api/platform/stats?period=all", headers=auth(platform_token))
    rows = {r["business_id"]: r for r in resp.json()["businesses"]}
    assert rows[tenant_a.business_id]["revenue"] == 5_000
    assert rows[tenant_a.business_id]["stores"] == 1
    assert rows[tenant_b.business_id]["revenue"] == 0


def test_platform_stats_rejects_bad_period(client, platform_token):
    resp = client.get("/api/platform/stats?period=decade", headers=auth(platform_token))
    assert resp.status_code == 400


def test_business_cannot_read_platform_stats(client, tenant_a):
    resp = client.get("/api/platform/stats", headers=auth(tenant_a.business_token))
    assert resp.status_code == 401
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_platform_stats.py -v`
Expected: FAIL with 404 (route doesn't exist).

- [ ] **Step 3: Add schema and endpoint**

Append to `app/schemas/business.py`:

```python
class BusinessBreakdown(BaseModel):
    business_id: int
    name: str
    stores: int
    orders: int
    revenue: int
    cost: int
    profit: int


class PlatformStatsOut(BaseModel):
    businesses_total: int
    stores_total: int
    customers_total: int
    total_orders: int
    total_revenue: int
    total_cost: int
    total_profit: int
    businesses: list[BusinessBreakdown]
```

In `app/api/routes/platform.py`:

```python
@router.get("/stats", response_model=PlatformStatsOut)
def platform_stats(period: str = "month", db: Session = Depends(get_db)):
    """Butun platforma kesimida: nechta biznes/do'kon/mijoz, va har bir biznes
    bo'yicha buyurtma / aylanma / harajat / foyda."""
    from app.api.routes.admin import _agg
    from app.api.routes.business import _period_start

    start = _period_start(period)

    businesses = db.scalars(select(Business).order_by(Business.id)).all()
    breakdown: list[BusinessBreakdown] = []
    for b in businesses:
        stores = db.scalars(
            select(Restaurant).where(Restaurant.business_id == b.id)
        ).all()
        orders = revenue = profit = 0
        for store in stores:
            o, r, p = _agg(db, store.id, start)
            orders += o
            revenue += r
            profit += p
        breakdown.append(BusinessBreakdown(
            business_id=b.id, name=b.name, stores=len(stores),
            orders=orders, revenue=revenue, cost=revenue - profit, profit=profit,
        ))

    return PlatformStatsOut(
        businesses_total=len(businesses),
        stores_total=db.scalar(select(func.count(Restaurant.id))) or 0,
        customers_total=db.scalar(select(func.count(User.id))) or 0,
        total_orders=sum(x.orders for x in breakdown),
        total_revenue=sum(x.revenue for x in breakdown),
        total_cost=sum(x.cost for x in breakdown),
        total_profit=sum(x.profit for x in breakdown),
        businesses=breakdown,
    )
```

`_period_start` (in `app/api/routes/business.py`) already raises 400 for an unknown period and returns `None` for `"all"` — reuse it, don't duplicate. Import it inside the function to avoid a circular import, same as `_agg`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_platform_stats.py -v` → 4 passed
Run: `pytest -q` → 72 passed

- [ ] **Step 5: Commit**

```bash
git add app/schemas/business.py app/api/routes/platform.py tests/test_platform_stats.py
git commit -m "feat: add /platform/stats platform-wide analytics"
```

---

### Task 4: `superadmin/` PWA

**Files:** new app at `/Users/user/Desktop/All Foods/superadmin/`

Mirror `businessman/` exactly (it's the closest sibling — same auth shape, same layout, same Tailwind classes). **Read the whole `businessman/` app first.**

Differences:
- Token localStorage key: `af_platform_token`
- Auth endpoints: `POST /platform/auth/login`, `GET /platform/auth/me`
- Dev/preview port: **3003** (admin 3000, courier 3001, businessman 3002)
- **No store switcher** — a platform admin isn't scoped to a store.
- Nav (Uzbek, lucide icons):
  - `/` — Umumiy (dashboard)
  - `/businesses` — Tadbirkorlar
  - `/customers` — Mijozlar
  - `/announcements` — E'lonlar

Pages:
- **DashboardPage** — `GET /platform/stats?period=month`, with a period selector (`today|week|month|all`). Render 7 tiles (bizneslar, do'konlar, mijozlar, buyurtmalar, aylanma, harajat, foyda) and a per-business table (nomi, do'konlar, buyurtmalar, aylanma, harajat, foyda).
- **BusinessesPage** — `GET /platform/businesses` table (nomi, username, telefon, do'konlar soni, holati). "Yangi tadbirkor" modal form → `POST /platform/businesses` (name, username, password, phone). Row actions: toggle active (`PATCH .../toggle`), delete (`DELETE ...`, with a confirm dialog; surface the 409 "do'koni bor" error as a toast rather than a crash).
- **CustomersPage** — there is **no** `GET /platform/users` list endpoint. Only `PATCH /platform/users/{uid}/block` and `DELETE /platform/users/{uid}` exist. So either add `GET /platform/users` to the backend as part of this task (a simple paginated `select(User)`, platform-wide — mirror the old `admin.py` `list_users` shape and its `_user_dict`), or make this page a placeholder. **Prefer adding the endpoint** — a superadmin with a block button and no list to click it from is useless. Write a test for it alongside Task 2's tests if you add it.
- **AnnouncementsPage** — port the one that was deleted from `admin/` in sub-project 2a. Recover it from git: `cd "/Users/user/Desktop/All Foods/admin" && git show 8cd731a^:src/pages/AnnouncementsPage.tsx`. Change its API paths from `/admin/announcements` to `/platform/announcements`.

Verification: `npm install && npm run build` must pass with zero TS errors; `npm run dev` must boot clean.

Git: `superadmin/` is its own nested repo (like `admin/`, `businessman/`). `git init` + commit inside it, then add `/superadmin/` to the outer repo's `.gitignore` and commit that separately.

---

### Task 5: End-to-end verification

- [ ] **Step 1: Clean test DB + run the real migration/seed from this worktree**

```bash
cd "/Users/user/Desktop/All Foods"
docker compose -p allfoods-test -f docker-compose.local-test.yml down -v
docker compose -p allfoods-test -f docker-compose.local-test.yml up -d postgres redis
cd backend/.worktrees/superadmin-3 && source venv/bin/activate
export POSTGRES_HOST=localhost POSTGRES_PORT=5433 POSTGRES_USER=allfoods \
       POSTGRES_PASSWORD=allfoods POSTGRES_DB=allfoods REDIS_URL=redis://localhost:6380/0 \
       SECRET_KEY=testsecret
python -m app.initdb && python -m app.seed
```
Expected: includes `Created platform admin 'platform'.`

- [ ] **Step 2: Boot the API and verify the platform admin can actually log in**

```bash
nohup uvicorn app.main:app --host 127.0.0.1 --port 8099 > /tmp/uvicorn-superadmin.log 2>&1 &
sleep 5
curl -s -X POST http://127.0.0.1:8099/api/platform/auth/login \
  -H 'Content-Type: application/json' -d '{"username":"platform","password":"platform12345"}'
```
Expected: a token. This is the whole point of Task 1 — if it 401s, the bootstrap didn't work.

- [ ] **Step 3: Create a businessman through the API and confirm they can log in**

Use the token from Step 2 to `POST /api/platform/businesses`, then `POST /api/business/auth/login` with those credentials. Expected: 201 then 200.

- [ ] **Step 4: Confirm a businessman token is rejected by `/platform/*`**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8099/api/platform/stats \
  -H "Authorization: Bearer <businessman-token>"
```
Expected: 401.

- [ ] **Step 5: Tear down**

```bash
pkill -f "uvicorn app.main:app --host 127.0.0.1 --port 8099"
cd "/Users/user/Desktop/All Foods"
docker compose -p allfoods-test -f docker-compose.local-test.yml down -v
```
Then confirm the user's main stack is still up: `docker ps --format "{{.Names}}" | grep -E "^allfoods-(backend|postgres)"`.
