# Businessman Backend (Sub-project 2a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a `Business` (tadbirkor) manage their own stores through the existing `/admin/*` endpoints — which currently have **no store scoping at all** — plus a small new `/business/*` router for store CRUD and cross-store stats.

**Architecture:** A single new `current_restaurant` dependency resolves "which store am I acting on?" for both principal types (store staff → always their own `admin.restaurant_id`; businessman → a required `?restaurant_id=` query param, validated to belong to them). Every scoped endpoint in `admin.py` swaps its unscoped query (or the old `default_store(db)` "first restaurant found" helper) for this dependency. The `/admin` router keeps an authentication floor (`get_current_staff_or_business`) so no endpoint can ever become accidentally unauthenticated; staff-only endpoints add `Depends(require_staff)` on top. Announcements and user block/delete move out to a new `/platform/*` router guarded by `require_platform_admin`.

**Tech Stack:** FastAPI, SQLAlchemy 2.0, Postgres, pytest (real Postgres on port 5433 via `docker-compose.local-test.yml`).

**Base branch:** This builds directly on Phase 1a's branch `multi-tenant-foundation-1a` (which is NOT yet merged to `master`). Create a new worktree/branch from it:
```bash
cd "/Users/user/Desktop/All Foods/backend"
git worktree add .worktrees/businessman-backend-2a -b businessman-backend-2a multi-tenant-foundation-1a
```
Set up the venv in the new worktree (`python3.12 -m venv venv && source venv/bin/activate && pip install -r requirements.txt`). Test Postgres: `docker compose -p allfoods-test -f ../docker-compose.local-test.yml up -d postgres redis` — **always pass `-p allfoods-test`**; omitting it collides with and stops the user's main `allfoods` docker stack.

**Spec:** `docs/superpowers/specs/2026-07-09-businessman-backend-design.md` (in the outer "All Foods" repo).

**Security note:** This plan changes authorization on a live admin panel. Two deliberate breaking changes to the existing `admin` PWA are handled in Task 11. Do not skip Task 11 — without it the admin PWA's Users and Announcements pages will 403.

---

### Task 1: Shared test fixtures for two businesses × two stores

Every scoping test in this plan needs the same fixture shape: two independent businesses, each owning a store, each store with its own staff/products/orders. Build it once.

**Files:**
- Modify: `tests/conftest.py`

- [ ] **Step 1: Add the fixtures**

Append to `tests/conftest.py`:

```python
from dataclasses import dataclass


@dataclass
class Tenant:
    """One business + its store + a superadmin staff account, with tokens."""
    business_id: int
    business_token: str
    restaurant_id: int
    staff_id: int
    staff_token: str


def _make_tenant(db_session, slug: str) -> Tenant:
    from app.core.security import create_access_token, hash_password
    from app.models import AdminUser, Business, Restaurant
    from app.models.enums import AdminRole

    business = Business(
        name=f"Biznes {slug}", username=f"biz_{slug}", hashed_password=hash_password("pw"),
    )
    db_session.add(business)
    db_session.commit()

    restaurant = Restaurant(name=f"Do'kon {slug}", business_id=business.id)
    db_session.add(restaurant)
    db_session.commit()

    staff = AdminUser(
        username=f"staff_{slug}", hashed_password=hash_password("pw"),
        role=AdminRole.superadmin, restaurant_id=restaurant.id,
    )
    db_session.add(staff)
    db_session.commit()

    return Tenant(
        business_id=business.id,
        business_token=create_access_token(subject=str(business.id), role="businessman"),
        restaurant_id=restaurant.id,
        staff_id=staff.id,
        staff_token=create_access_token(subject=str(staff.id), role=AdminRole.superadmin.value),
    )


@pytest.fixture
def tenant_a(db_session) -> Tenant:
    return _make_tenant(db_session, "a")


@pytest.fixture
def tenant_b(db_session) -> Tenant:
    return _make_tenant(db_session, "b")


def auth(token: str) -> dict:
    """Authorization header helper for tests."""
    return {"Authorization": f"Bearer {token}"}
```

- [ ] **Step 2: Verify fixtures import cleanly**

Run: `pytest --collect-only -q`
Expected: collects the existing 19 tests, no import/collection errors.

- [ ] **Step 3: Commit**

```bash
git add tests/conftest.py
git commit -m "test: add two-tenant fixtures for scoping tests"
```

---

### Task 2: `get_current_staff_or_business` and `current_restaurant` dependencies

**Files:**
- Modify: `app/api/deps.py`
- Test: `tests/test_scope_deps.py`

- [ ] **Step 1: Write the failing test**

Create `tests/test_scope_deps.py`:

```python
import pytest
from fastapi import HTTPException

from app.models import Business, Restaurant


def test_staff_gets_own_restaurant_ignoring_query_param(db_session, tenant_a, tenant_b):
    from app.api.deps import current_restaurant, get_current_staff_or_business

    principal = get_current_staff_or_business(
        authorization=f"Bearer {tenant_a.staff_token}", db=db_session
    )
    # Staff asks for tenant B's store; must still get their own (A's).
    result = current_restaurant(
        restaurant_id=tenant_b.restaurant_id, principal=principal, db=db_session
    )
    assert result.id == tenant_a.restaurant_id


def test_business_gets_own_restaurant(db_session, tenant_a):
    from app.api.deps import current_restaurant, get_current_staff_or_business

    principal = get_current_staff_or_business(
        authorization=f"Bearer {tenant_a.business_token}", db=db_session
    )
    result = current_restaurant(
        restaurant_id=tenant_a.restaurant_id, principal=principal, db=db_session
    )
    assert result.id == tenant_a.restaurant_id


def test_business_cannot_reach_other_businesss_store(db_session, tenant_a, tenant_b):
    from app.api.deps import current_restaurant, get_current_staff_or_business

    principal = get_current_staff_or_business(
        authorization=f"Bearer {tenant_a.business_token}", db=db_session
    )
    with pytest.raises(HTTPException) as exc:
        current_restaurant(
            restaurant_id=tenant_b.restaurant_id, principal=principal, db=db_session
        )
    assert exc.value.status_code == 403


def test_business_must_supply_restaurant_id(db_session, tenant_a):
    from app.api.deps import current_restaurant, get_current_staff_or_business

    principal = get_current_staff_or_business(
        authorization=f"Bearer {tenant_a.business_token}", db=db_session
    )
    with pytest.raises(HTTPException) as exc:
        current_restaurant(restaurant_id=None, principal=principal, db=db_session)
    assert exc.value.status_code == 400


def test_courier_token_rejected_by_staff_or_business(db_session, tenant_a):
    from app.api.deps import get_current_staff_or_business
    from app.core.security import create_access_token, hash_password
    from app.models import AdminUser
    from app.models.enums import AdminRole

    courier = AdminUser(
        username="courier_x", hashed_password=hash_password("pw"),
        role=AdminRole.courier, restaurant_id=tenant_a.restaurant_id,
    )
    db_session.add(courier)
    db_session.commit()
    token = create_access_token(subject=str(courier.id), role=AdminRole.courier.value)

    with pytest.raises(HTTPException) as exc:
        get_current_staff_or_business(authorization=f"Bearer {token}", db=db_session)
    assert exc.value.status_code == 403
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_scope_deps.py -v`
Expected: FAIL with `ImportError: cannot import name 'get_current_staff_or_business' from 'app.api.deps'`

- [ ] **Step 3: Add the dependencies**

In `app/api/deps.py`, update the models import line:

```python
from app.models import AdminUser, Business, PlatformAdmin, Restaurant, User
```

Append to the end of the file:

```python
# ── Scoping: bitta endpoint, ikki xil principal (do'kon xodimi yoki tadbirkor) ──
def get_current_staff_or_business(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> AdminUser | Business:
    """Do'kon xodimi (superadmin/manager) yoki tadbirkor (Business) tokenini qabul qiladi.

    Kuryer bu yerga kira olmaydi — unda alohida /courier router bor.
    """
    payload = decode_token(_bearer(authorization))
    if not payload:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    role = payload.get("role")

    if role == "businessman":
        business = db.get(Business, int(payload["sub"]))
        if not business or not business.is_active:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Business not found")
        return business

    if role in {AdminRole.superadmin.value, AdminRole.manager.value}:
        admin = db.get(AdminUser, int(payload["sub"]))
        if not admin or not admin.is_active:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Admin not found")
        return admin

    raise HTTPException(status.HTTP_403_FORBIDDEN, "Staff or business only")


def current_restaurant(
    restaurant_id: int | None = None,
    principal: AdminUser | Business = Depends(get_current_staff_or_business),
    db: Session = Depends(get_db),
) -> Restaurant:
    """Amal qilinayotgan do'konni aniqlaydi va egalikni tekshiradi.

    - Do'kon xodimi: har doim o'z `admin.restaurant_id`si. `restaurant_id` query
      param berilsa ham e'tiborga olinmaydi.
    - Tadbirkor: `restaurant_id` MAJBURIY va unga tegishli bo'lishi shart.
    """
    if isinstance(principal, Business):
        if restaurant_id is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "restaurant_id required")
        store = db.get(Restaurant, restaurant_id)
        if not store or store.business_id != principal.id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your store")
        return store

    store = db.get(Restaurant, principal.restaurant_id)
    if not store:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Store not found")
    return store


def require_store_admin_or_business(
    principal: AdminUser | Business = Depends(get_current_staff_or_business),
) -> AdminUser | Business:
    """Xodim boshqaruvi uchun: do'kon superadmin'i yoki tadbirkor (manager emas)."""
    if isinstance(principal, AdminUser) and principal.role != AdminRole.superadmin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Superadmin or business only")
    return principal
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_scope_deps.py -v`
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add app/api/deps.py tests/test_scope_deps.py
git commit -m "feat: add current_restaurant scoping dependency"
```

---

### Task 3: `restaurant_id` on `DeliveryZone` and `Courier`

Both are currently single global rows. With two businesses, staff of business A editing "the" delivery zone silently changes business B's stores. Same table-shape fix as `admin_users.restaurant_id` in Phase 1a.

**Files:**
- Modify: `app/models/order.py`
- Modify: `app/initdb.py`
- Test: `tests/test_multi_tenant_models.py`

- [ ] **Step 1: Write the failing test**

Append to `tests/test_multi_tenant_models.py`:

```python
def test_delivery_zone_requires_restaurant_id(db_session, tenant_a):
    from app.models import DeliveryZone

    db_session.add(DeliveryZone(name="Zona"))
    with pytest.raises(IntegrityError):
        db_session.commit()


def test_courier_requires_restaurant_id(db_session, tenant_a):
    from app.models import Courier

    db_session.add(Courier(name="Kuryer"))
    with pytest.raises(IntegrityError):
        db_session.commit()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_multi_tenant_models.py -v`
Expected: FAIL — both new tests fail (rows insert successfully, no `IntegrityError` raised, because the columns don't exist yet).

- [ ] **Step 3: Add the columns + retrofit SQL**

In `app/models/order.py`, add to the `DeliveryZone` class (after `id`):

```python
    restaurant_id: Mapped[int] = mapped_column(
        ForeignKey("restaurants.id", ondelete="CASCADE"), index=True
    )
```

And to the `Courier` class (after `id`):

```python
    restaurant_id: Mapped[int] = mapped_column(
        ForeignKey("restaurants.id", ondelete="CASCADE"), index=True
    )
```

(`ForeignKey` is already imported in `order.py`.)

In `app/initdb.py`, inside `main()`'s `with engine.begin() as conn:` block, **after** the existing `admin_users.restaurant_id` backfill block (which already computes `first_restaurant`), append:

```python
        # delivery_zones / couriers — cross-tenant izolyatsiya uchun do'konga bog'lash.
        for table in ("delivery_zones", "couriers"):
            conn.execute(text(
                f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS restaurant_id INTEGER "
                "REFERENCES restaurants(id) ON DELETE CASCADE"
            ))
            if first_restaurant:
                conn.execute(
                    text(f"UPDATE {table} SET restaurant_id = :rid WHERE restaurant_id IS NULL"),
                    {"rid": first_restaurant[0]},
                )
            conn.execute(text(f"ALTER TABLE {table} ALTER COLUMN restaurant_id SET NOT NULL"))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_multi_tenant_models.py -v`
Expected: all pass (the 4 existing + 2 new)

Then: `pytest -q`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add app/models/order.py app/initdb.py tests/test_multi_tenant_models.py
git commit -m "feat: scope DeliveryZone and Courier to a restaurant"
```

---

### Task 4: Swap the `/admin` router's auth floor; scope `/store`, `/stats`, `/reports`, `/delivery-stats`

**Files:**
- Modify: `app/api/routes/admin.py`
- Test: `tests/test_admin_scoping.py`

- [ ] **Step 1: Write the failing test**

Create `tests/test_admin_scoping.py`:

```python
from tests.conftest import auth


def test_business_reads_own_store(client, tenant_a):
    resp = client.get(
        f"/api/admin/store?restaurant_id={tenant_a.restaurant_id}",
        headers=auth(tenant_a.business_token),
    )
    assert resp.status_code == 200
    assert resp.json()["id"] == tenant_a.restaurant_id


def test_business_cannot_read_other_store(client, tenant_a, tenant_b):
    resp = client.get(
        f"/api/admin/store?restaurant_id={tenant_b.restaurant_id}",
        headers=auth(tenant_a.business_token),
    )
    assert resp.status_code == 403


def test_staff_reads_own_store_without_param(client, tenant_a):
    resp = client.get("/api/admin/store", headers=auth(tenant_a.staff_token))
    assert resp.status_code == 200
    assert resp.json()["id"] == tenant_a.restaurant_id


def test_business_without_restaurant_id_gets_400(client, tenant_a):
    resp = client.get("/api/admin/store", headers=auth(tenant_a.business_token))
    assert resp.status_code == 400


def test_stats_scoped_to_store(client, tenant_a):
    resp = client.get(
        f"/api/admin/stats?restaurant_id={tenant_a.restaurant_id}",
        headers=auth(tenant_a.business_token),
    )
    assert resp.status_code == 200
    assert resp.json()["orders_total"] == 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_admin_scoping.py -v`
Expected: FAIL — `test_business_reads_own_store` returns 401 (the `/admin` router's `require_staff` rejects a businessman token).

- [ ] **Step 3: Rewire the router and scope the four endpoints**

In `app/api/routes/admin.py`:

Change the imports:
```python
from app.api.deps import current_restaurant, get_current_staff_or_business, require_staff
```

Change the router declaration (authentication floor — every endpoint still requires a valid staff-or-business token; per-endpoint scoping is layered on top):
```python
# Autentifikatsiya poli: hech bir endpoint tokensiz ochilib qolmasligi uchun.
# Har bir endpoint ustiga o'z scoping/ruxsat dependency'sini qo'shadi.
router = APIRouter(
    prefix="/admin", tags=["admin"],
    dependencies=[Depends(get_current_staff_or_business)],
)
```

**Delete** the `default_store()` function entirely (it returned "the first restaurant found" — meaningless once there are many).

Rewrite the four endpoints:

```python
# ── Store ────────────────────────────────────────────────────────
@router.get("/store", response_model=RestaurantOut)
def get_store(store: Restaurant = Depends(current_restaurant)):
    return store


@router.put("/store", response_model=RestaurantOut)
def update_store(
    data: StoreSettingsIn,
    store: Restaurant = Depends(current_restaurant),
    db: Session = Depends(get_db),
):
    for k, v in data.model_dump().items():
        setattr(store, k, v)
    db.commit()
    db.refresh(store)
    return store
```

For `stats`, `reports`, and `delivery_analytics`, thread the store id through the aggregation helpers. Change `_agg`, `_series`, and `_top_products` signatures to take `restaurant_id: int` and filter on it:

```python
def _agg(db: Session, restaurant_id: int, start: datetime | None = None) -> tuple[int, int, int]:
    delivered = OrderStatus.delivered
    cond = [Order.status == delivered, Order.restaurant_id == restaurant_id]
    if start is not None:
        cond.append(Order.created_at >= start)

    orders = db.scalar(select(func.count(Order.id)).where(*cond)) or 0
    revenue = db.scalar(
        select(func.coalesce(func.sum(Order.total), 0)).where(*cond)
    ) or 0
    profit = db.scalar(
        select(
            func.coalesce(
                func.sum((OrderItem.price - OrderItem.cost) * OrderItem.quantity), 0
            )
        )
        .select_from(Order)
        .join(OrderItem, OrderItem.order_id == Order.id)
        .where(*cond)
    ) or 0
    return int(orders), int(revenue), int(profit)


def _series(db: Session, restaurant_id: int, trunc: str, start: datetime) -> list[PeriodPoint]:
    delivered = OrderStatus.delivered
    period = func.date_trunc(trunc, Order.created_at)
    rows = db.execute(
        select(
            period.label("p"),
            func.count(func.distinct(Order.id)),
            func.coalesce(func.sum(OrderItem.price * OrderItem.quantity), 0),
            func.coalesce(
                func.sum((OrderItem.price - OrderItem.cost) * OrderItem.quantity), 0
            ),
        )
        .select_from(Order)
        .join(OrderItem, OrderItem.order_id == Order.id)
        .where(
            Order.status == delivered,
            Order.created_at >= start,
            Order.restaurant_id == restaurant_id,
        )
        .group_by(period)
        .order_by(period)
    ).all()
    return [
        PeriodPoint(period=p.date().isoformat(), orders=o, revenue=int(r), profit=int(pf))
        for p, o, r, pf in rows
    ]


def _top_products(db: Session, restaurant_id: int, limit: int = 20) -> list[TopProduct]:
    delivered = OrderStatus.delivered
    rows = db.execute(
        select(
            Product.id,
            Product.name_uz,
            Product.image_url,
            func.coalesce(func.sum(OrderItem.quantity), 0).label("qty"),
            func.coalesce(func.sum(OrderItem.price * OrderItem.quantity), 0).label("rev"),
            func.coalesce(
                func.sum((OrderItem.price - OrderItem.cost) * OrderItem.quantity), 0
            ).label("prof"),
        )
        .select_from(OrderItem)
        .join(Order, Order.id == OrderItem.order_id)
        .join(Product, Product.id == OrderItem.product_id)
        .where(Order.status == delivered, Order.restaurant_id == restaurant_id)
        .group_by(Product.id, Product.name_uz, Product.image_url)
        .order_by(func.sum(OrderItem.quantity).desc())
        .limit(limit)
    ).all()
    return [
        TopProduct(
            product_id=pid, name_uz=name, image_url=img,
            quantity=int(qty), revenue=int(rev), profit=int(prof),
        )
        for pid, name, img, qty, rev, prof in rows
    ]
```

And the endpoints that call them:

```python
@router.get("/stats", response_model=DashboardStats)
def stats(store: Restaurant = Depends(current_restaurant), db: Session = Depends(get_db)):
    rid = store.id
    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week = today - timedelta(days=7)
    month = today - timedelta(days=30)

    o_today, r_today, p_today = _agg(db, rid, today)
    o_week, r_week, p_week = _agg(db, rid, week)
    o_month, r_month, p_month = _agg(db, rid, month)
    o_total, r_total, p_total = _agg(db, rid, None)

    pending_orders = db.scalar(
        select(func.count(Order.id)).where(
            Order.status == OrderStatus.pending, Order.restaurant_id == rid
        )
    ) or 0
    users_total = db.scalar(
        select(func.count(func.distinct(Order.user_id))).where(Order.restaurant_id == rid)
    ) or 0
    products_total = db.scalar(
        select(func.count(Product.id)).where(Product.restaurant_id == rid)
    ) or 0
    low_stock_count = db.scalar(
        select(func.count(Product.id)).where(
            Product.stock <= Product.low_stock_threshold, Product.restaurant_id == rid
        )
    ) or 0

    return DashboardStats(
        orders_today=o_today, revenue_today=r_today, profit_today=p_today,
        orders_week=o_week, revenue_week=r_week, profit_week=p_week,
        orders_month=o_month, revenue_month=r_month, profit_month=p_month,
        orders_total=o_total, revenue_total=r_total, profit_total=p_total,
        pending_orders=pending_orders,
        users_total=users_total,
        products_total=products_total,
        low_stock_count=low_stock_count,
        top_products=_top_products(db, rid, limit=5),
    )


@router.get("/reports", response_model=ReportsOut)
def reports(store: Restaurant = Depends(current_restaurant), db: Session = Depends(get_db)):
    rid = store.id
    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    return ReportsOut(
        daily=_series(db, rid, "day", today - timedelta(days=30)),
        weekly=_series(db, rid, "week", today - timedelta(weeks=12)),
        monthly=_series(db, rid, "month", today - timedelta(days=365)),
        top_products=_top_products(db, rid, limit=20),
    )


@router.get("/delivery-stats")
def delivery_analytics(
    store: Restaurant = Depends(current_restaurant), db: Session = Depends(get_db)
):
    """Yetkazib berish o'rtachalari: namuna soni, o'rtacha masofa/vaqt, min/km (ETA o'rganish)."""
    from app.services.eta import delivery_stats

    return delivery_stats(db, restaurant_id=store.id)
```

Then update `app/services/eta.py`'s `delivery_stats` to accept and filter on `restaurant_id`. Read that file first; add `restaurant_id: int` as a keyword parameter and add `Order.restaurant_id == restaurant_id` to its existing `where(...)` clause. If it has no `where` clause yet, add one.

**Note on `users_total` in `/stats`:** it changed meaning from "all bot users on the platform" to "distinct customers who ordered from this store" — that's the correct per-store number and matches the `GET /users` change in Task 8.

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_admin_scoping.py -v`
Expected: 5 passed

Run: `pytest -q`
Expected: all pass. **If `tests/test_admin_write_paths.py::test_default_store_creates_restaurant_with_business_id` fails because `default_store` no longer exists — that's expected.** Delete that one test (the function it tested is gone); keep `test_create_admin_user_sets_restaurant_id_from_creator`.

- [ ] **Step 5: Commit**

```bash
git add app/api/routes/admin.py app/services/eta.py tests/test_admin_scoping.py tests/test_admin_write_paths.py
git commit -m "feat: scope /admin store, stats, reports, delivery-stats to a restaurant"
```

---

### Task 5: Scope categories and products

**Files:**
- Modify: `app/api/routes/admin.py`
- Modify: `app/schemas/catalog.py`
- Test: `tests/test_admin_scoping.py`

- [ ] **Step 1: Write the failing test**

Append to `tests/test_admin_scoping.py`:

```python
def _make_category(client, tenant, name="Ichimliklar"):
    return client.post(
        f"/api/admin/categories?restaurant_id={tenant.restaurant_id}",
        json={"name_uz": name, "name_ru": name, "parent_id": None, "sort_order": 0},
        headers=auth(tenant.business_token),
    )


def test_business_creates_category_in_own_store(client, tenant_a):
    resp = _make_category(client, tenant_a)
    assert resp.status_code == 201


def test_category_list_is_scoped(client, tenant_a, tenant_b):
    _make_category(client, tenant_a, "A kategoriya")
    _make_category(client, tenant_b, "B kategoriya")

    resp = client.get(
        f"/api/admin/restaurants/{tenant_a.restaurant_id}/categories",
        headers=auth(tenant_a.business_token),
    )
    assert resp.status_code == 200
    names = [c["name_uz"] for c in resp.json()]
    assert names == ["A kategoriya"]


def test_business_cannot_list_other_stores_categories(client, tenant_a, tenant_b):
    resp = client.get(
        f"/api/admin/restaurants/{tenant_b.restaurant_id}/categories?restaurant_id={tenant_b.restaurant_id}",
        headers=auth(tenant_a.business_token),
    )
    assert resp.status_code == 403


def test_business_cannot_edit_other_stores_product(client, tenant_a, tenant_b):
    # Tenant B creates a category + product in their own store.
    cat = _make_category(client, tenant_b, "B kat").json()
    sub = client.post(
        f"/api/admin/categories?restaurant_id={tenant_b.restaurant_id}",
        json={"name_uz": "B sub", "name_ru": "B sub", "parent_id": cat["id"], "sort_order": 0},
        headers=auth(tenant_b.business_token),
    ).json()
    prod = client.post(
        f"/api/admin/products?restaurant_id={tenant_b.restaurant_id}",
        json={
            "category_id": sub["id"], "name_uz": "B mahsulot", "name_ru": "B mahsulot",
            "price": 1000, "cost": 500, "stock": 10, "unit": "dona",
            "low_stock_threshold": 2, "is_available": True, "sort_order": 0,
        },
        headers=auth(tenant_b.business_token),
    ).json()

    # Tenant A tries to change its price, scoped to their own store.
    resp = client.put(
        f"/api/admin/products/{prod['id']}?restaurant_id={tenant_a.restaurant_id}",
        json={
            "category_id": sub["id"], "name_uz": "O'g'irlangan", "name_ru": "O'g'irlangan",
            "price": 1, "cost": 1, "stock": 1, "unit": "dona",
            "low_stock_threshold": 1, "is_available": True, "sort_order": 0,
        },
        headers=auth(tenant_a.business_token),
    )
    assert resp.status_code == 404


def test_business_cannot_change_other_stores_stock(client, tenant_a, tenant_b):
    cat = _make_category(client, tenant_b, "B kat2").json()
    sub = client.post(
        f"/api/admin/categories?restaurant_id={tenant_b.restaurant_id}",
        json={"name_uz": "B sub2", "name_ru": "B sub2", "parent_id": cat["id"], "sort_order": 0},
        headers=auth(tenant_b.business_token),
    ).json()
    prod = client.post(
        f"/api/admin/products?restaurant_id={tenant_b.restaurant_id}",
        json={
            "category_id": sub["id"], "name_uz": "B mahsulot2", "name_ru": "B mahsulot2",
            "price": 1000, "cost": 500, "stock": 10, "unit": "dona",
            "low_stock_threshold": 2, "is_available": True, "sort_order": 0,
        },
        headers=auth(tenant_b.business_token),
    ).json()

    resp = client.patch(
        f"/api/admin/products/{prod['id']}/stock?restaurant_id={tenant_a.restaurant_id}",
        json={"stock": 999},
        headers=auth(tenant_a.business_token),
    )
    assert resp.status_code == 404
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_admin_scoping.py -v`
Expected: FAIL — `test_business_creates_category_in_own_store` returns 422 (`CategoryIn` still requires `restaurant_id` in the body, which the test no longer sends).

- [ ] **Step 3: Take `restaurant_id` out of the request bodies and scope the endpoints**

In `app/schemas/catalog.py`, **remove** the `restaurant_id: int` field from both `CategoryIn` and `ProductIn` (it now comes from the scope, never from client input — a client must not be able to write a row into someone else's store by lying in the body).

In `app/api/routes/admin.py`, rewrite the category and product endpoints:

```python
# ── Categories ───────────────────────────────────────────────────
@router.get("/restaurants/{rid}/categories", response_model=list[CategoryOut])
def list_categories(
    rid: int, store: Restaurant = Depends(current_restaurant), db: Session = Depends(get_db)
):
    if rid != store.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your store")
    return db.scalars(
        select(Category).where(Category.restaurant_id == rid).order_by(Category.sort_order)
    ).all()


def _check_parent(db: Session, parent_id: int | None, restaurant_id: int) -> None:
    if parent_id is None:
        return
    parent = db.get(Category, parent_id)
    if not parent or parent.parent_id is not None or parent.restaurant_id != restaurant_id:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "faqat 2 daraja — subkategoriya ichida subkategoriya bo'lmaydi",
        )


@router.post("/categories", response_model=CategoryOut, status_code=201)
def create_category(
    data: CategoryIn,
    store: Restaurant = Depends(current_restaurant),
    db: Session = Depends(get_db),
):
    _check_parent(db, data.parent_id, store.id)
    c = Category(**data.model_dump(), restaurant_id=store.id)
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.put("/categories/{cid}", response_model=CategoryOut)
def update_category(
    cid: int,
    data: CategoryIn,
    store: Restaurant = Depends(current_restaurant),
    db: Session = Depends(get_db),
):
    c = db.get(Category, cid)
    if not c or c.restaurant_id != store.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    _check_parent(db, data.parent_id, store.id)
    for k, v in data.model_dump().items():
        setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return c


@router.delete("/categories/{cid}", status_code=204)
def delete_category(
    cid: int, store: Restaurant = Depends(current_restaurant), db: Session = Depends(get_db)
):
    c = db.get(Category, cid)
    if c and c.restaurant_id == store.id:
        db.delete(c)
        db.commit()


# ── Products ─────────────────────────────────────────────────────
@router.get("/restaurants/{rid}/products", response_model=list[ProductOut])
def list_products(
    rid: int, store: Restaurant = Depends(current_restaurant), db: Session = Depends(get_db)
):
    if rid != store.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your store")
    return db.scalars(
        select(Product).where(Product.restaurant_id == rid).order_by(Product.sort_order)
    ).all()


def _check_subcategory(db: Session, category_id: int, restaurant_id: int) -> None:
    category = db.get(Category, category_id)
    if not category or category.parent_id is None or category.restaurant_id != restaurant_id:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Mahsulot faqat subkategoriyaga biriktirilishi mumkin",
        )


@router.post("/products", response_model=ProductOut, status_code=201)
def create_product(
    data: ProductIn,
    store: Restaurant = Depends(current_restaurant),
    db: Session = Depends(get_db),
):
    _check_subcategory(db, data.category_id, store.id)
    p = Product(**data.model_dump(), restaurant_id=store.id)
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.put("/products/{pid}", response_model=ProductOut)
def update_product(
    pid: int,
    data: ProductIn,
    store: Restaurant = Depends(current_restaurant),
    db: Session = Depends(get_db),
):
    p = db.get(Product, pid)
    if not p or p.restaurant_id != store.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    _check_subcategory(db, data.category_id, store.id)
    for k, v in data.model_dump().items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return p


@router.delete("/products/{pid}", status_code=204)
def delete_product(
    pid: int, store: Restaurant = Depends(current_restaurant), db: Session = Depends(get_db)
):
    p = db.get(Product, pid)
    if p and p.restaurant_id == store.id:
        db.delete(p)
        db.commit()


# ── Warehouse / stock (ombor) ────────────────────────────────────
@router.patch("/products/{pid}/stock", response_model=ProductOut)
def update_stock(
    pid: int,
    data: StockUpdate,
    store: Restaurant = Depends(current_restaurant),
    db: Session = Depends(get_db),
):
    p = db.get(Product, pid)
    if not p or p.restaurant_id != store.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    p.stock = data.stock
    if data.low_stock_threshold is not None:
        p.low_stock_threshold = data.low_stock_threshold
    db.commit()
    db.refresh(p)
    return p
```

**Note:** `admin/src` (the existing PWA) sends `restaurant_id` in category/product create bodies today. Pydantic ignores unknown body fields by default, so the extra field is harmless and the PWA keeps working — but the PWA must now also pass `?restaurant_id=` when acting as a businessman. Staff tokens don't need it. Task 11 covers the PWA side.

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_admin_scoping.py -v`
Expected: 10 passed (5 from Task 4 + 5 new)

Run: `pytest -q`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add app/api/routes/admin.py app/schemas/catalog.py tests/test_admin_scoping.py
git commit -m "feat: scope category and product endpoints to a restaurant"
```

---

### Task 6: Scope orders, notifications, supplies

**Files:**
- Modify: `app/api/routes/admin.py`
- Test: `tests/test_admin_scoping.py`

- [ ] **Step 1: Write the failing test**

First add an order-seeding helper to `tests/conftest.py`:

```python
def make_order(db_session, tenant, total: int = 10_000):
    """A delivered order belonging to `tenant`'s store, from a fresh customer."""
    from app.models import Order, User
    from app.models.enums import OrderStatus, PaymentMethod, PaymentStatus

    user = User(telegram_id=abs(hash(f"{tenant.restaurant_id}-{total}")) % 10**9, language="uz")
    db_session.add(user)
    db_session.commit()

    order = Order(
        user_id=user.id,
        restaurant_id=tenant.restaurant_id,
        number=f"ORD-{tenant.restaurant_id}-{total}",
        status=OrderStatus.delivered,
        payment_method=PaymentMethod.cash,
        payment_status=PaymentStatus.paid,
        subtotal=total, delivery_fee=0, total=total,
        address_line="Test manzil",
    )
    db_session.add(order)
    db_session.commit()
    return order
```

**Before writing this helper, read `app/models/order.py`'s `Order` class** and adjust the constructor kwargs to match its actual non-nullable columns — the list above is the expected shape but verify each field name and drop/add as needed.

Then append to `tests/test_admin_scoping.py`:

```python
from tests.conftest import auth, make_order


def test_orders_list_is_scoped(client, db_session, tenant_a, tenant_b):
    make_order(db_session, tenant_a, total=5_000)
    make_order(db_session, tenant_b, total=7_000)

    resp = client.get(
        f"/api/admin/orders?restaurant_id={tenant_a.restaurant_id}",
        headers=auth(tenant_a.business_token),
    )
    assert resp.status_code == 200
    totals = [o["total"] for o in resp.json()]
    assert totals == [5_000]


def test_notifications_are_scoped(client, db_session, tenant_a, tenant_b):
    make_order(db_session, tenant_a, total=5_000)
    make_order(db_session, tenant_b, total=7_000)

    resp = client.get(
        f"/api/admin/notifications?restaurant_id={tenant_a.restaurant_id}",
        headers=auth(tenant_a.business_token),
    )
    assert resp.status_code == 200
    assert all(e["total"] == 5_000 for e in resp.json())


def test_business_cannot_cancel_other_stores_order(client, db_session, tenant_a, tenant_b):
    order_b = make_order(db_session, tenant_b, total=7_000)

    resp = client.patch(
        f"/api/admin/orders/{order_b.id}?restaurant_id={tenant_a.restaurant_id}",
        json={"status": "cancelled"},
        headers=auth(tenant_a.business_token),
    )
    assert resp.status_code == 404
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_admin_scoping.py -k "orders_list or notifications or cancel_other" -v`
Expected: FAIL — `test_orders_list_is_scoped` returns both orders (`[5000, 7000]`), because `/admin/orders`'s `restaurant_id` is still a plain optional filter, not a scope.

- [ ] **Step 3: Scope the three endpoints**

In `app/api/routes/admin.py`:

```python
# ── Orders board ─────────────────────────────────────────────────
@router.get("/orders", response_model=list[OrderOut])
def admin_orders(
    store: Restaurant = Depends(current_restaurant),
    db: Session = Depends(get_db),
    status_filter: OrderStatus | None = None,
    limit: int = 100,
    offset: int = 0,
):
    limit = max(1, min(limit, 200))
    stmt = (
        select(Order)
        .where(Order.restaurant_id == store.id)
        .order_by(Order.created_at.desc())
        .options(selectinload(Order.items))
    )
    if status_filter:
        stmt = stmt.where(Order.status == status_filter)
    stmt = stmt.limit(limit).offset(max(0, offset))
    return db.scalars(stmt).all()


@router.patch("/orders/{order_id}", response_model=OrderOut)
def update_order_status(
    order_id: int,
    data: OrderStatusUpdate,
    background: BackgroundTasks,
    store: Restaurant = Depends(current_restaurant),
    db: Session = Depends(get_db),
):
    """Admin faqat kuzatib boradi va buyurtmani bekor qila oladi — qabul qilish
    va kuryer biriktirish kuryerning o'zi tomonidan amalga oshiriladi."""
    order = db.get(Order, order_id)
    if not order or order.restaurant_id != store.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    if data.status != OrderStatus.cancelled:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Admin faqat buyurtmani bekor qila oladi",
        )

    ensure_transition(order.status, data.status)
    order.status = data.status

    db.commit()
    db.refresh(order)
    background.add_task(notify_status_change, order, order.user.telegram_id)
    return order
```

Notifications — add the store filter:

```python
@router.get("/notifications", response_model=list[NotificationEvent])
def list_notifications(
    store: Restaurant = Depends(current_restaurant), db: Session = Depends(get_db)
):
    orders = db.scalars(
        select(Order)
        .where(Order.restaurant_id == store.id)
        .order_by(Order.created_at.desc())
        .limit(50)
    ).all()
    # ... rest of the function body is unchanged ...
```

Supplies — scope via the product's store:

```python
@router.get("/supplies", response_model=list[SupplyRecordOut])
def list_supplies(
    store: Restaurant = Depends(current_restaurant),
    db: Session = Depends(get_db),
    product_id: int | None = None,
    limit: int = 100,
):
    stmt = (
        select(SupplyRecord)
        .join(Product, Product.id == SupplyRecord.product_id)
        .where(Product.restaurant_id == store.id)
        .options(selectinload(SupplyRecord.product))
        .order_by(SupplyRecord.supply_date.desc(), SupplyRecord.created_at.desc())
        .limit(limit)
    )
    if product_id:
        stmt = stmt.where(SupplyRecord.product_id == product_id)
    return [_supply_out(s) for s in db.scalars(stmt).all()]


@router.post("/supplies", response_model=SupplyRecordOut, status_code=201)
def create_supply(
    data: SupplyRecordIn,
    store: Restaurant = Depends(current_restaurant),
    db: Session = Depends(get_db),
):
    prod = db.get(Product, data.product_id)
    if not prod or prod.restaurant_id != store.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    total = int(data.quantity * data.cost_per_unit)
    s = SupplyRecord(**data.model_dump(), total_cost=total)
    db.add(s)
    prod.stock += int(data.quantity)
    db.commit()
    db.refresh(s)
    db.refresh(s, ["product"])
    return _supply_out(s)


@router.delete("/supplies/{sid}", status_code=204)
def delete_supply(
    sid: int, store: Restaurant = Depends(current_restaurant), db: Session = Depends(get_db)
):
    s = db.get(SupplyRecord, sid)
    if not s:
        return
    prod = db.get(Product, s.product_id)
    if not prod or prod.restaurant_id != store.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    prod.stock = max(0, prod.stock - int(s.quantity))
    db.delete(s)
    db.commit()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_admin_scoping.py -v`
Expected: 13 passed

Run: `pytest -q`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add app/api/routes/admin.py tests/conftest.py tests/test_admin_scoping.py
git commit -m "feat: scope orders, notifications and supplies to a restaurant"
```

---

### Task 7: Staff-only endpoints — delivery-zone, couriers, courier-accounts, push

These stay staff-only (businessman gets 403), and now scope to the staff member's own store via the new `restaurant_id` columns from Task 3.

**Files:**
- Modify: `app/api/routes/admin.py`
- Test: `tests/test_admin_scoping.py`

- [ ] **Step 1: Write the failing test**

Append to `tests/test_admin_scoping.py`:

```python
def test_businessman_blocked_from_delivery_zone(client, tenant_a):
    resp = client.get(
        f"/api/admin/delivery-zone?restaurant_id={tenant_a.restaurant_id}",
        headers=auth(tenant_a.business_token),
    )
    assert resp.status_code == 403


def test_businessman_blocked_from_couriers(client, tenant_a):
    resp = client.get(
        f"/api/admin/couriers?restaurant_id={tenant_a.restaurant_id}",
        headers=auth(tenant_a.business_token),
    )
    assert resp.status_code == 403


def test_staff_courier_list_is_scoped(client, db_session, tenant_a, tenant_b):
    from app.models import Courier

    db_session.add(Courier(name="A kuryer", restaurant_id=tenant_a.restaurant_id))
    db_session.add(Courier(name="B kuryer", restaurant_id=tenant_b.restaurant_id))
    db_session.commit()

    resp = client.get("/api/admin/couriers", headers=auth(tenant_a.staff_token))
    assert resp.status_code == 200
    assert [c["name"] for c in resp.json()] == ["A kuryer"]


def test_staff_delivery_zone_is_scoped(client, db_session, tenant_a, tenant_b):
    from app.models import DeliveryZone

    db_session.add(DeliveryZone(name="B zona", restaurant_id=tenant_b.restaurant_id))
    db_session.commit()

    # Tenant A has no zone of their own — must get null, not tenant B's.
    resp = client.get("/api/admin/delivery-zone", headers=auth(tenant_a.staff_token))
    assert resp.status_code == 200
    assert resp.json() is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_admin_scoping.py -k "delivery_zone or courier" -v`
Expected: FAIL — businessman gets 200 (not 403) on both, and `test_staff_delivery_zone_is_scoped` returns tenant B's zone.

- [ ] **Step 3: Add `require_staff` + scoping to these endpoints**

In `app/api/routes/admin.py`:

```python
# ── Delivery zone (yetkazish hududi, doira) — faqat do'kon xodimi ─
@router.get("/delivery-zone", response_model=DeliveryZoneOut | None)
def get_delivery_zone(
    _: AdminUser = Depends(require_staff),
    store: Restaurant = Depends(current_restaurant),
    db: Session = Depends(get_db),
):
    return db.scalar(
        select(DeliveryZone)
        .where(DeliveryZone.restaurant_id == store.id)
        .order_by(DeliveryZone.id)
        .limit(1)
    )


@router.put("/delivery-zone", response_model=DeliveryZoneOut)
def set_delivery_zone(
    data: DeliveryZoneIn,
    _: AdminUser = Depends(require_staff),
    store: Restaurant = Depends(current_restaurant),
    db: Session = Depends(get_db),
):
    zone = db.scalar(
        select(DeliveryZone)
        .where(DeliveryZone.restaurant_id == store.id)
        .order_by(DeliveryZone.id)
        .limit(1)
    )
    if zone:
        for k, v in data.model_dump().items():
            setattr(zone, k, v)
    else:
        zone = DeliveryZone(**data.model_dump(), restaurant_id=store.id)
        db.add(zone)
    db.commit()
    db.refresh(zone)
    return zone


# ── Courier accounts (biriktirish uchun) — faqat do'kon xodimi ───
@router.get("/courier-accounts", response_model=list[AdminUserOut])
def list_courier_accounts(
    _: AdminUser = Depends(require_staff),
    store: Restaurant = Depends(current_restaurant),
    db: Session = Depends(get_db),
):
    return db.scalars(
        select(AdminUser)
        .where(
            AdminUser.role == AdminRole.courier,
            AdminUser.is_active.is_(True),
            AdminUser.restaurant_id == store.id,
        )
        .order_by(AdminUser.username)
    ).all()
```

Push endpoints — add `_: AdminUser = Depends(require_staff)` to `push_public_key`, `push_subscribe`, and `push_test` (they're tied to `admin_user_id`, meaningless for a businessman).

Courier CRUD — staff-only + scoped:

```python
@router.get("/couriers", response_model=list[CourierOut])
def list_couriers(
    _: AdminUser = Depends(require_staff),
    store: Restaurant = Depends(current_restaurant),
    db: Session = Depends(get_db),
):
    return db.scalars(
        select(Courier).where(Courier.restaurant_id == store.id).order_by(Courier.id)
    ).all()


@router.post("/couriers", response_model=CourierOut, status_code=201)
def create_courier(
    data: CourierIn,
    _: AdminUser = Depends(require_staff),
    store: Restaurant = Depends(current_restaurant),
    db: Session = Depends(get_db),
):
    c = Courier(**data.model_dump(), restaurant_id=store.id)
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.put("/couriers/{cid}", response_model=CourierOut)
def update_courier(
    cid: int,
    data: CourierIn,
    _: AdminUser = Depends(require_staff),
    store: Restaurant = Depends(current_restaurant),
    db: Session = Depends(get_db),
):
    c = db.get(Courier, cid)
    if not c or c.restaurant_id != store.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Courier not found")
    for k, v in data.model_dump().items():
        setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return c


@router.delete("/couriers/{cid}", status_code=204)
def delete_courier(
    cid: int,
    _: AdminUser = Depends(require_staff),
    store: Restaurant = Depends(current_restaurant),
    db: Session = Depends(get_db),
):
    c = db.get(Courier, cid)
    if c and c.restaurant_id == store.id:
        db.delete(c)
        db.commit()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_admin_scoping.py -v`
Expected: 17 passed

Run: `pytest -q`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add app/api/routes/admin.py tests/test_admin_scoping.py
git commit -m "feat: staff-only + scope delivery-zone, couriers, push"
```

---

### Task 8: Scope `GET /users` to the store's customers; scope `/admin-users`

**Files:**
- Modify: `app/api/routes/admin.py`
- Test: `tests/test_admin_scoping.py`

- [ ] **Step 1: Write the failing test**

Append to `tests/test_admin_scoping.py`:

```python
def test_users_list_only_shows_store_customers(client, db_session, tenant_a, tenant_b):
    order_a = make_order(db_session, tenant_a, total=5_000)
    make_order(db_session, tenant_b, total=7_000)

    resp = client.get(
        f"/api/admin/users?restaurant_id={tenant_a.restaurant_id}",
        headers=auth(tenant_a.business_token),
    )
    assert resp.status_code == 200
    ids = [u["id"] for u in resp.json()]
    assert ids == [order_a.user_id]


def test_admin_users_list_is_scoped(client, tenant_a, tenant_b):
    resp = client.get(
        f"/api/admin/admin-users?restaurant_id={tenant_a.restaurant_id}",
        headers=auth(tenant_a.business_token),
    )
    assert resp.status_code == 200
    usernames = [u["username"] for u in resp.json()]
    assert "staff_a" in usernames
    assert "staff_b" not in usernames


def test_business_creates_staff_in_own_store(client, db_session, tenant_a):
    resp = client.post(
        f"/api/admin/admin-users?restaurant_id={tenant_a.restaurant_id}",
        json={"username": "yangi_manager", "password": "pw123456", "role": "manager"},
        headers=auth(tenant_a.business_token),
    )
    assert resp.status_code == 201
    assert resp.json()["restaurant_id"] == tenant_a.restaurant_id


def test_business_cannot_delete_other_stores_staff(client, tenant_a, tenant_b):
    resp = client.delete(
        f"/api/admin/admin-users/{tenant_b.staff_id}?restaurant_id={tenant_a.restaurant_id}",
        headers=auth(tenant_a.business_token),
    )
    assert resp.status_code == 404
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_admin_scoping.py -k "users_list or admin_users or creates_staff or delete_other" -v`
Expected: FAIL — `/users` returns both customers; `/admin-users` 403s a businessman (still `require_superadmin`).

- [ ] **Step 3: Scope both**

In `app/api/routes/admin.py`:

```python
# ── Users (read-only list) — do'kon mijozlari ───────────────────
@router.get("/users")
def list_users(
    store: Restaurant = Depends(current_restaurant),
    db: Session = Depends(get_db),
    limit: int = 100,
    offset: int = 0,
):
    """Faqat shu do'kondan buyurtma bergan mijozlar."""
    rows = db.scalars(
        select(User)
        .where(User.id.in_(select(Order.user_id).where(Order.restaurant_id == store.id)))
        .order_by(User.created_at.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return [_user_dict(u) for u in rows]
```

**Delete** `set_user_blocked` and `delete_user` from `admin.py` entirely (they move to the platform router in Task 9), and delete the now-unused `UserBlockIn` class from this file. Keep `_user_dict` — `list_users` still uses it. Move `_user_dict`'s definition above `list_users` so it's defined before use.

Admin-users — swap `require_superadmin` for `require_store_admin_or_business` and scope everything to `current_restaurant`:

```python
@router.get("/admin-users", response_model=list[AdminUserOut])
def list_admin_users(
    principal = Depends(require_store_admin_or_business),
    store: Restaurant = Depends(current_restaurant),
    db: Session = Depends(get_db),
):
    stmt = select(AdminUser).where(AdminUser.restaurant_id == store.id)
    if isinstance(principal, AdminUser):
        stmt = stmt.where(AdminUser.id != principal.id)
    return db.scalars(stmt.order_by(AdminUser.created_at.desc())).all()


@router.post("/admin-users", response_model=AdminUserOut, status_code=201)
def create_admin_user(
    data: _AdminUserCreateIn,
    _principal = Depends(require_store_admin_or_business),
    store: Restaurant = Depends(current_restaurant),
    db: Session = Depends(get_db),
):
    if db.scalar(select(AdminUser).where(AdminUser.username == data.username)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Username already taken")
    u = AdminUser(
        username=data.username,
        hashed_password=hash_password(data.password),
        role=data.role,
        restaurant_id=store.id,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@router.patch("/admin-users/{uid}/toggle", response_model=AdminUserOut)
def toggle_admin_user(
    uid: int,
    _principal = Depends(require_store_admin_or_business),
    store: Restaurant = Depends(current_restaurant),
    db: Session = Depends(get_db),
):
    u = db.get(AdminUser, uid)
    if not u or u.restaurant_id != store.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    u.is_active = not u.is_active
    db.commit()
    db.refresh(u)
    return u


@router.delete("/admin-users/{uid}", status_code=204)
def delete_admin_user(
    uid: int,
    principal = Depends(require_store_admin_or_business),
    store: Restaurant = Depends(current_restaurant),
    db: Session = Depends(get_db),
):
    u = db.get(AdminUser, uid)
    if not u or u.restaurant_id != store.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    if isinstance(principal, AdminUser) and u.id == principal.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "O'zingizni o'chira olmaysiz")
    db.delete(u)
    db.commit()
```

Import `require_store_admin_or_business` at the top of the file alongside the other deps.

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_admin_scoping.py -v`
Expected: 21 passed

Run: `pytest -q`
Expected: all pass. **The announcement endpoints in `admin.py` still reference `require_superadmin` at this point — that's fine, Task 9 removes them.**

- [ ] **Step 5: Commit**

```bash
git add app/api/routes/admin.py tests/test_admin_scoping.py
git commit -m "feat: scope /users to store customers, /admin-users to store staff"
```

---

### Task 9: Move announcements + user block/delete to a new `/platform` router

**Files:**
- Create: `app/api/routes/platform.py`
- Modify: `app/api/routes/admin.py`
- Modify: `app/main.py`
- Test: `tests/test_platform_routes.py`

- [ ] **Step 1: Write the failing test**

Create `tests/test_platform_routes.py`:

```python
import pytest

from app.core.security import create_access_token, hash_password
from app.models import PlatformAdmin
from tests.conftest import auth, make_order


@pytest.fixture
def platform_token(db_session) -> str:
    admin = PlatformAdmin(username="plat_routes", hashed_password=hash_password("pw"))
    db_session.add(admin)
    db_session.commit()
    return create_access_token(subject=str(admin.id), role="platform_superadmin")


def test_platform_admin_can_list_announcements(client, platform_token):
    resp = client.get("/api/platform/announcements", headers=auth(platform_token))
    assert resp.status_code == 200
    assert resp.json() == []


def test_business_cannot_reach_platform_announcements(client, tenant_a):
    resp = client.get("/api/platform/announcements", headers=auth(tenant_a.business_token))
    assert resp.status_code == 401


def test_staff_cannot_reach_platform_announcements(client, tenant_a):
    resp = client.get("/api/platform/announcements", headers=auth(tenant_a.staff_token))
    assert resp.status_code == 401


def test_announcements_gone_from_admin_router(client, tenant_a):
    resp = client.get(
        f"/api/admin/announcements?restaurant_id={tenant_a.restaurant_id}",
        headers=auth(tenant_a.business_token),
    )
    assert resp.status_code == 404


def test_platform_admin_can_block_user(client, db_session, platform_token, tenant_a):
    order = make_order(db_session, tenant_a, total=5_000)
    resp = client.patch(
        f"/api/platform/users/{order.user_id}/block",
        json={"blocked": True},
        headers=auth(platform_token),
    )
    assert resp.status_code == 200
    assert resp.json()["is_blocked"] is True


def test_staff_cannot_block_user(client, db_session, tenant_a):
    order = make_order(db_session, tenant_a, total=5_000)
    resp = client.patch(
        f"/api/admin/users/{order.user_id}/block",
        json={"blocked": True},
        headers=auth(tenant_a.staff_token),
    )
    assert resp.status_code == 404
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_platform_routes.py -v`
Expected: FAIL with 404 on `/api/platform/announcements` (the router doesn't exist).

- [ ] **Step 3: Create the platform router and strip those endpoints from admin.py**

Create `app/api/routes/platform.py`:

```python
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_platform_admin
from app.core.db import get_db
from app.models import Announcement, Order, OrderItem, User
from app.schemas.admin import AnnouncementIn, AnnouncementOut
from app.services.announcements import broadcast

# Butun platforma ustidan boshqaruv — faqat platform superadmin.
router = APIRouter(
    prefix="/platform", tags=["platform"],
    dependencies=[Depends(require_platform_admin)],
)


def _user_dict(u: User) -> dict:
    return {
        "id": u.id,
        "telegram_id": u.telegram_id,
        "username": u.username,
        "first_name": u.first_name,
        "phone": u.phone,
        "language": u.language,
        "is_blocked": u.is_blocked,
        "created_at": u.created_at,
    }


class UserBlockIn(BaseModel):
    blocked: bool


# ── Users — bloklash / o'chirish (platforma darajasidagi amal) ───
@router.patch("/users/{uid}/block")
def set_user_blocked(uid: int, data: UserBlockIn, db: Session = Depends(get_db)):
    user = db.get(User, uid)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    user.is_blocked = data.blocked
    db.commit()
    db.refresh(user)
    return _user_dict(user)


@router.delete("/users/{uid}", status_code=204)
def delete_user(uid: int, db: Session = Depends(get_db)):
    """Hard delete: foydalanuvchi + buyurtmalari + adreslari butunlay o'chadi.

    Order.user_id da ondelete yo'q, shuning uchun buyurtma satrlari va
    buyurtmalarni qo'lda o'chiramiz; adreslar User cascade orqali ketadi.
    """
    user = db.get(User, uid)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    order_ids = db.scalars(select(Order.id).where(Order.user_id == uid)).all()
    if order_ids:
        db.query(OrderItem).filter(OrderItem.order_id.in_(order_ids)).delete(
            synchronize_session=False
        )
        db.query(Order).filter(Order.id.in_(order_ids)).delete(synchronize_session=False)
    db.delete(user)  # addresses cascade via relationship
    db.commit()


# ── Announcements (Elon) — barcha bot foydalanuvchilariga tarqatish ─
@router.get("/announcements", response_model=list[AnnouncementOut])
def list_announcements(db: Session = Depends(get_db)):
    return db.scalars(select(Announcement).order_by(Announcement.created_at.desc())).all()


@router.post("/announcements", response_model=AnnouncementOut, status_code=201)
def create_announcement(
    data: AnnouncementIn, background: BackgroundTasks, db: Session = Depends(get_db)
):
    ann = Announcement(**data.model_dump())
    db.add(ann)
    db.commit()
    db.refresh(ann)
    background.add_task(broadcast, ann.id)
    return ann


@router.post("/announcements/{aid}/resend", response_model=AnnouncementOut, status_code=201)
def resend_announcement(
    aid: int, background: BackgroundTasks, db: Session = Depends(get_db)
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

In `app/api/routes/admin.py`, **delete**: the three announcement endpoints, the `require_superadmin` import (now unused), the `Announcement` model import, the `broadcast` service import, and the `AnnouncementIn`/`AnnouncementOut` schema imports. Run `python -c "import app.main"` to catch any leftover unused-name errors.

In `app/main.py`, register the new router:

```python
from app.api.routes import (
    addresses, admin, admin_auth, auth, business_auth, catalog, courier, orders,
    platform, platform_auth, uploads,
)
```
```python
api.include_router(platform.router)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_platform_routes.py -v`
Expected: 6 passed

Run: `pytest -q`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add app/api/routes/platform.py app/api/routes/admin.py app/main.py tests/test_platform_routes.py
git commit -m "feat: move announcements and user block/delete to /platform router"
```

---

### Task 10: New `/business/*` router — stores CRUD + cross-store stats

**Files:**
- Create: `app/api/routes/business.py`
- Modify: `app/schemas/business.py`
- Modify: `app/api/routes/uploads.py`
- Modify: `app/main.py`
- Test: `tests/test_business_routes.py`

- [ ] **Step 1: Write the failing test**

Create `tests/test_business_routes.py`:

```python
from tests.conftest import auth, make_order


def test_stores_list_only_shows_own_stores(client, tenant_a, tenant_b):
    resp = client.get("/api/business/stores", headers=auth(tenant_a.business_token))
    assert resp.status_code == 200
    ids = [s["id"] for s in resp.json()]
    assert ids == [tenant_a.restaurant_id]


def test_business_creates_store(client, tenant_a):
    resp = client.post(
        "/api/business/stores",
        json={"name": "Ikkinchi do'kon"},
        headers=auth(tenant_a.business_token),
    )
    assert resp.status_code == 201
    assert resp.json()["name"] == "Ikkinchi do'kon"

    listed = client.get("/api/business/stores", headers=auth(tenant_a.business_token))
    assert len(listed.json()) == 2


def test_business_cannot_update_other_store(client, tenant_a, tenant_b):
    resp = client.put(
        f"/api/business/stores/{tenant_b.restaurant_id}",
        json={"name": "O'g'irlangan"},
        headers=auth(tenant_a.business_token),
    )
    assert resp.status_code == 404


def test_store_with_orders_cannot_be_deleted(client, db_session, tenant_a):
    make_order(db_session, tenant_a, total=5_000)
    resp = client.delete(
        f"/api/business/stores/{tenant_a.restaurant_id}",
        headers=auth(tenant_a.business_token),
    )
    assert resp.status_code == 409


def test_empty_store_can_be_deleted(client, tenant_a):
    created = client.post(
        "/api/business/stores",
        json={"name": "Bo'sh do'kon"},
        headers=auth(tenant_a.business_token),
    ).json()
    resp = client.delete(
        f"/api/business/stores/{created['id']}", headers=auth(tenant_a.business_token)
    )
    assert resp.status_code == 204


def test_business_stats_breaks_down_by_store(client, db_session, tenant_a, tenant_b):
    make_order(db_session, tenant_a, total=5_000)
    make_order(db_session, tenant_b, total=7_000)

    resp = client.get(
        "/api/business/stats?period=all", headers=auth(tenant_a.business_token)
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["total_revenue"] == 5_000  # tenant B's 7_000 must not leak in
    assert len(body["stores"]) == 1
    assert body["stores"][0]["restaurant_id"] == tenant_a.restaurant_id
    assert body["stores"][0]["revenue"] == 5_000


def test_staff_token_rejected_by_business_router(client, tenant_a):
    resp = client.get("/api/business/stores", headers=auth(tenant_a.staff_token))
    assert resp.status_code == 401
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_business_routes.py -v`
Expected: FAIL with 404 (the `/business/stores` route doesn't exist).

- [ ] **Step 3: Build the router**

Add to `app/schemas/business.py`:

```python
class StoreCreateIn(BaseModel):
    name: str
    description_uz: str | None = None
    description_ru: str | None = None
    logo_url: str | None = None
    cover_url: str | None = None
    address: str | None = None
    owner_name: str | None = None
    phones: list[str] = []
    socials: dict[str, str] = {}
    lat: float | None = None
    lng: float | None = None
    delivery_fee: int = 0
    min_order: int = 0
    avg_delivery_minutes: int = 40
    is_active: bool = True
    is_open: bool = True


class StoreBreakdown(BaseModel):
    restaurant_id: int
    name: str
    orders: int
    revenue: int   # aylanma
    cost: int      # harajat (tannarx)
    profit: int


class BusinessStatsOut(BaseModel):
    total_orders: int
    total_revenue: int
    total_cost: int
    total_profit: int
    stores: list[StoreBreakdown]
```

Create `app/api/routes/business.py`:

```python
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_business
from app.core.db import get_db
from app.models import Business, Order, Restaurant
from app.schemas.business import BusinessStatsOut, StoreBreakdown, StoreCreateIn
from app.schemas.catalog import RestaurantOut

# Tadbirkorning biznes bo'ylab amallari (bitta do'kondan yuqori daraja).
router = APIRouter(prefix="/business", tags=["business"])

_PERIOD_DAYS = {"today": 0, "week": 7, "month": 30}


def _period_start(period: str) -> datetime | None:
    """`all` uchun None (butun tarix), aks holda bugundan orqaga sanaladi."""
    if period == "all":
        return None
    days = _PERIOD_DAYS.get(period)
    if days is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "period: today|week|month|all")
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    return today - timedelta(days=days)


def _own_store(rid: int, business: Business, db: Session) -> Restaurant:
    store = db.get(Restaurant, rid)
    if not store or store.business_id != business.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Store not found")
    return store


@router.get("/stores", response_model=list[RestaurantOut])
def list_stores(
    business: Business = Depends(get_current_business), db: Session = Depends(get_db)
):
    return db.scalars(
        select(Restaurant).where(Restaurant.business_id == business.id).order_by(Restaurant.id)
    ).all()


@router.post("/stores", response_model=RestaurantOut, status_code=201)
def create_store(
    data: StoreCreateIn,
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    store = Restaurant(**data.model_dump(), business_id=business.id)
    db.add(store)
    db.commit()
    db.refresh(store)
    return store


@router.put("/stores/{rid}", response_model=RestaurantOut)
def update_store(
    rid: int,
    data: StoreCreateIn,
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    store = _own_store(rid, business, db)
    for k, v in data.model_dump().items():
        setattr(store, k, v)
    db.commit()
    db.refresh(store)
    return store


@router.delete("/stores/{rid}", status_code=204)
def delete_store(
    rid: int,
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    """Do'konni o'chirish. Buyurtma tarixi bor do'kon o'chirilmaydi (409) —
    aks holda cascade uning buyurtmalarini ham olib ketardi."""
    store = _own_store(rid, business, db)
    has_orders = db.scalar(
        select(func.count(Order.id)).where(Order.restaurant_id == store.id)
    )
    if has_orders:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Buyurtma tarixi bor do'konni o'chirib bo'lmaydi"
        )
    db.delete(store)
    db.commit()


@router.get("/stats", response_model=BusinessStatsOut)
def business_stats(
    period: str = "month",
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    """Har bir do'kon kesimida va umumiy: buyurtma, aylanma, harajat, foyda."""
    from app.api.routes.admin import _agg

    start = _period_start(period)
    stores = db.scalars(
        select(Restaurant).where(Restaurant.business_id == business.id).order_by(Restaurant.id)
    ).all()

    breakdown: list[StoreBreakdown] = []
    for store in stores:
        orders, revenue, profit = _agg(db, store.id, start)
        breakdown.append(StoreBreakdown(
            restaurant_id=store.id, name=store.name,
            orders=orders, revenue=revenue, cost=revenue - profit, profit=profit,
        ))

    return BusinessStatsOut(
        total_orders=sum(s.orders for s in breakdown),
        total_revenue=sum(s.revenue for s in breakdown),
        total_cost=sum(s.cost for s in breakdown),
        total_profit=sum(s.profit for s in breakdown),
        stores=breakdown,
    )
```

In `app/api/routes/uploads.py`, swap the router guard so a businessman can upload product images:

```python
from app.api.deps import get_current_staff_or_business

router = APIRouter(
    prefix="/admin", tags=["uploads"],
    dependencies=[Depends(get_current_staff_or_business)],
)
```

In `app/main.py`:
```python
from app.api.routes import (
    addresses, admin, admin_auth, auth, business, business_auth, catalog, courier,
    orders, platform, platform_auth, uploads,
)
```
```python
api.include_router(business.router)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_business_routes.py -v`
Expected: 7 passed

Run: `pytest -q`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add app/api/routes/business.py app/api/routes/uploads.py app/schemas/business.py app/main.py tests/test_business_routes.py
git commit -m "feat: add /business stores CRUD and cross-store stats"
```

---

### Task 11: Update the existing `admin` PWA for the removed endpoints

The admin PWA still calls endpoints that moved or now 403. Without this, its Users and Announcements pages break.

**Files:**
- Modify: `admin/src/pages/UsersPage.tsx`
- Modify: `admin/src/components/Layout.tsx`
- Modify: `admin/src/App.tsx`
- Delete: `admin/src/pages/AnnouncementsPage.tsx`

**Work from the outer repo** (`/Users/user/Desktop/All Foods/admin`), not the backend worktree. Note `admin/` is its own git repo — commit there.

- [ ] **Step 1: Strip block/delete from UsersPage**

In `admin/src/pages/UsersPage.tsx`: remove the `toggleBlock` and `remove` handlers, the `confirm` import, the `del`/`patch` imports (keep `get`), the `Ban`/`ShieldCheck`/`Trash2` icon imports, the `busy` state, and the entire "Amallar" table column (both its `<th>` and each row's `<td>`). Keep the read-only table (name, username, phone, language, created_at) and the "Bloklangan" badge — `is_blocked` is still returned by the API, just no longer editable here.

- [ ] **Step 2: Remove the Announcements page**

Delete `admin/src/pages/AnnouncementsPage.tsx`.

In `admin/src/components/Layout.tsx`, remove the `/announcements` nav entry and its now-unused `Megaphone` icon import.

In `admin/src/App.tsx`, remove the `AnnouncementsPage` import and its `<Route>`.

- [ ] **Step 3: Verify the build**

```bash
cd "/Users/user/Desktop/All Foods/admin"
npm run build
```
Expected: build succeeds with no TypeScript errors (no unused imports, no references to the deleted page).

- [ ] **Step 4: Commit (in the admin repo)**

```bash
cd "/Users/user/Desktop/All Foods/admin"
git add src/pages/UsersPage.tsx src/components/Layout.tsx src/App.tsx
git rm src/pages/AnnouncementsPage.tsx
git commit -m "refactor: drop user block/delete and announcements (moved to platform admin)"
```

---

### Task 12: Full-stack verification against the local-test stack

Exercises the real migration + the real API, not just the pytest fixture DB.

- [ ] **Step 1: Bring up a clean local-test stack**

```bash
cd "/Users/user/Desktop/All Foods"
docker compose -p allfoods-test -f docker-compose.local-test.yml down -v
docker compose -p allfoods-test -f docker-compose.local-test.yml up -d --build
```

**Always pass `-p allfoods-test`.** Without it, docker-compose derives the project name from the directory and will stop the user's main `allfoods` stack.

- [ ] **Step 2: Confirm the backend started clean**

```bash
docker compose -p allfoods-test -f docker-compose.local-test.yml logs backend | tail -20
```
Expected: `Tables created / verified.`, store/superadmin seed lines, no tracebacks.

- [ ] **Step 3: Confirm the existing store-staff login still works**

```bash
curl -s -X POST http://localhost:8010/api/admin/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin12345"}'
```
Expected: a token (or 401 if `FIRST_ADMIN_PASSWORD` differs in `.env` — either way, no 500).

- [ ] **Step 4: Confirm `delivery_zones`/`couriers` got their new column**

```bash
docker compose -p allfoods-test -f docker-compose.local-test.yml exec postgres \
  psql -U allfoods -d allfoods \
  -c "SELECT id, restaurant_id FROM delivery_zones;" \
  -c "SELECT id, restaurant_id FROM couriers;" \
  -c "SELECT id, name, business_id FROM restaurants;"
```
Expected: no NULL `restaurant_id` / `business_id` anywhere.

- [ ] **Step 5: Tear down**

```bash
docker compose -p allfoods-test -f docker-compose.local-test.yml down -v
```
