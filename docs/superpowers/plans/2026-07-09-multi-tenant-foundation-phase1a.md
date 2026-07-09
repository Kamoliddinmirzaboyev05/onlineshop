# Multi-tenant Foundation — Phase 1a (Data Model + Auth) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the data model and auth endpoints for two new account types — `Business` (tadbirkor/businessman) and `PlatformAdmin` (platform superadmin) — and give every existing store-staff `AdminUser` a mandatory `restaurant_id`, without breaking the currently-running single-store `admin` app.

**Architecture:** New `businesses` and `platform_admins` tables (own login, own JWT `role` string, mirroring the existing `AdminUser`/`admin_auth.py` pattern in `app/api/deps.py` + `app/core/security.py`). `restaurants.business_id` and `admin_users.restaurant_id` become mandatory foreign keys. Schema changes follow this repo's existing convention: **not Alembic** (configured but unused) — idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements in `backend/app/initdb.py`, run at container start (see `docker-compose.yml`'s `backend` command).

**Tech Stack:** FastAPI, SQLAlchemy 2.0 (declarative `Mapped`), Postgres, `python-jose` JWT, `passlib`/bcrypt. Tests: `pytest` (new dependency) against a real Postgres instance — reuses the existing `docker-compose.local-test.yml` Postgres (port 5433), since the models use Postgres-only types (JSONB) elsewhere in the app and won't run on SQLite.

**Repo note:** `backend/` is its own git repo (separate remote, branch `master`) — all file paths below are relative to `backend/`, and all commits happen inside `backend/`.

**Out of scope (deferred):** Enforcing that existing store-staff endpoints (`admin.py`'s categories/products/orders/delivery-zone/store-settings) only see their *own* store's data — that's Phase 1b, a separate plan, because it changes behavior of the currently-live admin app and needs its own careful review. This plan only touches the two write paths that would otherwise immediately break once `admin_users.restaurant_id` becomes `NOT NULL` (Task 7) — it does not add read-side scoping.

---

### Task 1: pytest test infrastructure

**Files:**
- Modify: `requirements.txt`
- Create: `pytest.ini`
- Create: `tests/conftest.py`

- [ ] **Step 1: Add pytest to requirements**

Add this line to `requirements.txt`:

```
pytest==8.3.4
```

- [ ] **Step 2: Create pytest config**

Create `pytest.ini`:

```ini
[pytest]
testpaths = tests
```

- [ ] **Step 3: Create conftest.py with a real-Postgres test engine**

Create `tests/conftest.py`:

```python
import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+psycopg://allfoods:allfoods@localhost:5433/allfoods",
)


@pytest.fixture(scope="session")
def engine():
    from app.core.db import Base
    import app.models  # noqa: F401 — register all models on Base.metadata

    eng = create_engine(TEST_DATABASE_URL)
    Base.metadata.create_all(bind=eng)
    yield eng
    Base.metadata.drop_all(bind=eng)
    eng.dispose()


@pytest.fixture
def db_session(engine):
    from app.core.db import Base

    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.rollback()
    for table in reversed(Base.metadata.sorted_tables):
        session.execute(table.delete())
    session.commit()
    session.close()


@pytest.fixture
def client(db_session):
    from app.core.db import get_db
    from app.main import app

    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
```

- [ ] **Step 4: Verify pytest runs (no tests yet)**

Start the test Postgres (needed for the `engine` fixture, which will be used starting Task 2):

```bash
docker compose -f ../docker-compose.local-test.yml up -d postgres
```

Run: `pip install -r requirements.txt && pytest --collect-only`
Expected: `no tests ran` (0 collected), no import errors.

- [ ] **Step 5: Commit**

```bash
git add requirements.txt pytest.ini tests/conftest.py
git commit -m "test: add pytest infra against local-test Postgres"
```

---

### Task 2: `Business` and `PlatformAdmin` models

**Files:**
- Create: `app/models/business.py`
- Create: `app/models/platform_admin.py`
- Modify: `app/models/__init__.py`
- Test: `tests/test_multi_tenant_models.py`

- [ ] **Step 1: Write the failing test**

Create `tests/test_multi_tenant_models.py`:

```python
import pytest
from sqlalchemy.exc import IntegrityError

from app.models import Business, PlatformAdmin


def test_business_requires_unique_username(db_session):
    db_session.add(Business(
        name="Test Biznes", username="biz1", hashed_password="x",
    ))
    db_session.commit()

    db_session.add(Business(
        name="Boshqa Biznes", username="biz1", hashed_password="y",
    ))
    with pytest.raises(IntegrityError):
        db_session.commit()


def test_platform_admin_requires_unique_username(db_session):
    db_session.add(PlatformAdmin(username="platform1", hashed_password="x"))
    db_session.commit()

    db_session.add(PlatformAdmin(username="platform1", hashed_password="y"))
    with pytest.raises(IntegrityError):
        db_session.commit()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_multi_tenant_models.py -v`
Expected: FAIL with `ImportError: cannot import name 'Business' from 'app.models'`

- [ ] **Step 3: Create the models**

Create `app/models/business.py`:

```python
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Business(Base):
    """Tadbirkor (businessman) akkaunti — bir nechta do'konga (Restaurant) ega."""

    __tablename__ = "businesses"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(128))
    phone: Mapped[str | None] = mapped_column(String(32))
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
```

Create `app/models/platform_admin.py`:

```python
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class PlatformAdmin(Base):
    """Platforma darajasidagi admin (biz) — hech qaysi do'kon/businessga tegishli emas."""

    __tablename__ = "platform_admins"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
```

Modify `app/models/__init__.py` — add the two imports and `__all__` entries:

```python
from app.models.admin import AdminUser
from app.models.announcement import Announcement
from app.models.business import Business
from app.models.enums import AdminRole, AnnouncementStatus, OrderStatus, PaymentMethod, PaymentStatus
from app.models.order import Address, Courier, DeliveryZone, Order, OrderItem
from app.models.platform_admin import PlatformAdmin
from app.models.push import PushSubscription
from app.models.restaurant import Category, Product, Restaurant
from app.models.supply import SupplyRecord
from app.models.user import User

__all__ = [
    "AdminUser",
    "Announcement",
    "Business",
    "PlatformAdmin",
    "PushSubscription",
    "AdminRole",
    "AnnouncementStatus",
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

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_multi_tenant_models.py -v`
Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
git add app/models/business.py app/models/platform_admin.py app/models/__init__.py tests/test_multi_tenant_models.py
git commit -m "feat: add Business and PlatformAdmin models"
```

---

### Task 3: `restaurants.business_id` + `admin_users.restaurant_id` (ORM columns)

**Files:**
- Modify: `app/models/restaurant.py`
- Modify: `app/models/admin.py`
- Modify: `app/schemas/admin.py`
- Test: `tests/test_multi_tenant_models.py`

- [ ] **Step 1: Write the failing test**

Add to `tests/test_multi_tenant_models.py`:

```python
from app.models import AdminUser, Business, Restaurant
from app.models.enums import AdminRole


def test_restaurant_requires_business_id(db_session):
    db_session.add(Restaurant(name="Do'kon 2"))
    with pytest.raises(IntegrityError):
        db_session.commit()


def test_admin_user_requires_restaurant_id(db_session):
    business = Business(name="Biznes", username="biz2", hashed_password="x")
    db_session.add(business)
    db_session.commit()
    restaurant = Restaurant(name="Do'kon 3", business_id=business.id)
    db_session.add(restaurant)
    db_session.commit()

    db_session.add(AdminUser(username="staff1", hashed_password="x", role=AdminRole.manager))
    with pytest.raises(IntegrityError):
        db_session.commit()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_multi_tenant_models.py -v`
Expected: FAIL — `test_restaurant_requires_business_id` and `test_admin_user_requires_restaurant_id` both fail because `business_id`/`restaurant_id` don't exist yet (`TypeError: 'business_id' is an invalid keyword argument for Restaurant`).

- [ ] **Step 3: Add the columns**

In `app/models/restaurant.py`, add to the `Restaurant` class (after `id`):

```python
    business_id: Mapped[int] = mapped_column(
        ForeignKey("businesses.id", ondelete="CASCADE"), index=True
    )
```

In `app/models/admin.py`, add to the `AdminUser` class (after `id`):

```python
    restaurant_id: Mapped[int] = mapped_column(
        ForeignKey("restaurants.id", ondelete="CASCADE"), index=True
    )
```

Update the imports at the top of both files to include `ForeignKey` from `sqlalchemy` (already imported in `restaurant.py`; add it to `admin.py`'s import line: `from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, func`).

In `app/schemas/admin.py`, add `restaurant_id: int` to `AdminUserOut`:

```python
class AdminUserOut(BaseModel):
    id: int
    username: str
    role: AdminRole
    restaurant_id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_multi_tenant_models.py -v`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add app/models/restaurant.py app/models/admin.py app/schemas/admin.py tests/test_multi_tenant_models.py
git commit -m "feat: require business_id on Restaurant and restaurant_id on AdminUser"
```

---

### Task 4: Auth dependencies for `Business` and `PlatformAdmin`

**Files:**
- Modify: `app/api/deps.py`
- Test: `tests/test_multi_tenant_auth.py`

- [ ] **Step 1: Write the failing test**

Create `tests/test_multi_tenant_auth.py`:

```python
import pytest
from fastapi import HTTPException

from app.core.security import create_access_token, hash_password
from app.models import Business, PlatformAdmin


def test_get_current_business_accepts_valid_token(db_session):
    from app.api.deps import get_current_business

    business = Business(
        name="Biznes", username="biz3", hashed_password=hash_password("pw"),
    )
    db_session.add(business)
    db_session.commit()

    token = create_access_token(subject=str(business.id), role="businessman")
    result = get_current_business(authorization=f"Bearer {token}", db=db_session)
    assert result.id == business.id


def test_get_current_business_rejects_wrong_role(db_session):
    from app.api.deps import get_current_business

    token = create_access_token(subject="1", role="platform_superadmin")
    with pytest.raises(HTTPException):
        get_current_business(authorization=f"Bearer {token}", db=db_session)


def test_get_current_platform_admin_accepts_valid_token(db_session):
    from app.api.deps import get_current_platform_admin

    admin = PlatformAdmin(username="plat1", hashed_password=hash_password("pw"))
    db_session.add(admin)
    db_session.commit()

    token = create_access_token(subject=str(admin.id), role="platform_superadmin")
    result = get_current_platform_admin(authorization=f"Bearer {token}", db=db_session)
    assert result.id == admin.id


def test_get_current_platform_admin_rejects_wrong_role(db_session):
    from app.api.deps import get_current_platform_admin

    token = create_access_token(subject="1", role="businessman")
    with pytest.raises(HTTPException):
        get_current_platform_admin(authorization=f"Bearer {token}", db=db_session)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_multi_tenant_auth.py -v`
Expected: FAIL with `ImportError: cannot import name 'get_current_business' from 'app.api.deps'`

- [ ] **Step 3: Add the dependencies**

In `app/api/deps.py`, update the import line to include the new models:

```python
from app.models import AdminUser, Business, PlatformAdmin, User
```

Add at the end of the file:

```python
def get_current_business(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Business:
    payload = decode_token(_bearer(authorization))
    if not payload or payload.get("role") != "businessman":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid business token")
    business = db.get(Business, int(payload["sub"]))
    if not business or not business.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Business not found")
    return business


def require_business(business: Business = Depends(get_current_business)) -> Business:
    return business


def get_current_platform_admin(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> PlatformAdmin:
    payload = decode_token(_bearer(authorization))
    if not payload or payload.get("role") != "platform_superadmin":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid platform token")
    admin = db.get(PlatformAdmin, int(payload["sub"]))
    if not admin or not admin.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Platform admin not found")
    return admin


def require_platform_admin(
    admin: PlatformAdmin = Depends(get_current_platform_admin),
) -> PlatformAdmin:
    return admin
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_multi_tenant_auth.py -v`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add app/api/deps.py tests/test_multi_tenant_auth.py
git commit -m "feat: add get_current_business / get_current_platform_admin deps"
```

---

### Task 5: `/business/auth` and `/platform/auth` login routes

**Files:**
- Create: `app/schemas/business.py`
- Create: `app/api/routes/business_auth.py`
- Create: `app/api/routes/platform_auth.py`
- Modify: `app/main.py`
- Test: `tests/test_multi_tenant_auth.py`

- [ ] **Step 1: Write the failing test**

Add to `tests/test_multi_tenant_auth.py`:

```python
def test_business_login_and_me(client, db_session):
    business = Business(
        name="Biznes Login", username="bizlogin", hashed_password=hash_password("secret123"),
    )
    db_session.add(business)
    db_session.commit()

    resp = client.post("/api/business/auth/login", json={"username": "bizlogin", "password": "secret123"})
    assert resp.status_code == 200
    token = resp.json()["access_token"]

    me = client.get("/api/business/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["username"] == "bizlogin"


def test_business_login_rejects_wrong_password(client, db_session):
    business = Business(
        name="Biznes Login2", username="bizlogin2", hashed_password=hash_password("secret123"),
    )
    db_session.add(business)
    db_session.commit()

    resp = client.post("/api/business/auth/login", json={"username": "bizlogin2", "password": "wrong"})
    assert resp.status_code == 401


def test_platform_login_and_me(client, db_session):
    admin = PlatformAdmin(username="platlogin", hashed_password=hash_password("secret123"))
    db_session.add(admin)
    db_session.commit()

    resp = client.post("/api/platform/auth/login", json={"username": "platlogin", "password": "secret123"})
    assert resp.status_code == 200
    token = resp.json()["access_token"]

    me = client.get("/api/platform/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["username"] == "platlogin"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_multi_tenant_auth.py -v`
Expected: FAIL with `404 Not Found` (routes don't exist yet) on the `/api/business/auth/login` and `/api/platform/auth/login` calls.

- [ ] **Step 3: Add schemas, routes, and wire them up**

Create `app/schemas/business.py`:

```python
from datetime import datetime

from pydantic import BaseModel


class BusinessOut(BaseModel):
    id: int
    name: str
    phone: str | None = None
    username: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class PlatformAdminOut(BaseModel):
    id: int
    username: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True
```

Create `app/api/routes/business_auth.py`:

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_business
from app.core.db import get_db
from app.core.ratelimit import rate_limiter
from app.core.security import create_access_token, verify_password
from app.models import Business
from app.schemas.auth import AdminLoginIn, TokenOut
from app.schemas.business import BusinessOut

router = APIRouter(prefix="/business/auth", tags=["business-auth"])

# IP boshiga 1 daqiqada 10 ta login urinishi.
_login_limit = rate_limiter("business_login", limit=10, window_seconds=60)


@router.post("/login", response_model=TokenOut, dependencies=[Depends(_login_limit)])
def business_login(data: AdminLoginIn, db: Session = Depends(get_db)):
    business = db.scalar(select(Business).where(Business.username == data.username))
    if not business or not business.is_active or not verify_password(data.password, business.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    token = create_access_token(subject=business.id, role="businessman")
    return TokenOut(access_token=token)


@router.get("/me", response_model=BusinessOut)
def business_me(business: Business = Depends(get_current_business)):
    return business
```

Create `app/api/routes/platform_auth.py`:

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_platform_admin
from app.core.db import get_db
from app.core.ratelimit import rate_limiter
from app.core.security import create_access_token, verify_password
from app.models import PlatformAdmin
from app.schemas.auth import AdminLoginIn, TokenOut
from app.schemas.business import PlatformAdminOut

router = APIRouter(prefix="/platform/auth", tags=["platform-auth"])

# IP boshiga 1 daqiqada 10 ta login urinishi.
_login_limit = rate_limiter("platform_login", limit=10, window_seconds=60)


@router.post("/login", response_model=TokenOut, dependencies=[Depends(_login_limit)])
def platform_login(data: AdminLoginIn, db: Session = Depends(get_db)):
    admin = db.scalar(select(PlatformAdmin).where(PlatformAdmin.username == data.username))
    if not admin or not admin.is_active or not verify_password(data.password, admin.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    token = create_access_token(subject=admin.id, role="platform_superadmin")
    return TokenOut(access_token=token)


@router.get("/me", response_model=PlatformAdminOut)
def platform_me(admin: PlatformAdmin = Depends(get_current_platform_admin)):
    return admin
```

In `app/main.py`, update the import and router registration:

```python
from app.api.routes import (
    addresses, admin, admin_auth, auth, business_auth, catalog, courier, orders,
    platform_auth, uploads,
)
```

```python
api = APIRouter(prefix="/api")
api.include_router(auth.router)
api.include_router(catalog.router)
api.include_router(addresses.router)
api.include_router(orders.router)
api.include_router(admin_auth.router)
api.include_router(admin.router)
api.include_router(courier.router)
api.include_router(uploads.router)
api.include_router(business_auth.router)
api.include_router(platform_auth.router)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_multi_tenant_auth.py -v`
Expected: 7 passed

- [ ] **Step 5: Commit**

```bash
git add app/schemas/business.py app/api/routes/business_auth.py app/api/routes/platform_auth.py app/main.py tests/test_multi_tenant_auth.py
git commit -m "feat: add /business/auth and /platform/auth login endpoints"
```

---

### Task 6: Fix the two existing write paths that the new NOT NULL columns would break

**Context:** `admin_users.restaurant_id` and `restaurants.business_id` are now `NOT NULL` in the ORM. Two call sites still `INSERT` without them and would start throwing `IntegrityError` in production the moment this ships:
- `app/api/routes/admin.py:42` — `default_store()`'s on-demand fallback creates a `Restaurant` with no `business_id`.
- `app/api/routes/admin.py:605` — `create_admin_user` creates an `AdminUser` with no `restaurant_id`.

This is *not* Phase 1b's scoping work — it's the minimum needed so the currently-live admin app keeps working after this migration ships.

**Files:**
- Modify: `app/api/routes/admin.py`
- Test: `tests/test_admin_write_paths.py`

- [ ] **Step 1: Write the failing test**

Create `tests/test_admin_write_paths.py`:

```python
from app.core.security import create_access_token, hash_password
from app.models import AdminUser, Business, Restaurant
from app.models.enums import AdminRole


def _superadmin_token(db_session) -> str:
    business = Business(name="Biznes", username="admwrite_biz", hashed_password="x")
    db_session.add(business)
    db_session.commit()
    restaurant = Restaurant(name="Do'kon", business_id=business.id)
    db_session.add(restaurant)
    db_session.commit()
    admin = AdminUser(
        username="admwrite_super", hashed_password=hash_password("pw"),
        role=AdminRole.superadmin, restaurant_id=restaurant.id,
    )
    db_session.add(admin)
    db_session.commit()
    return create_access_token(subject=str(admin.id), role=AdminRole.superadmin.value)


def test_create_admin_user_sets_restaurant_id_from_creator(client, db_session):
    token = _superadmin_token(db_session)
    resp = client.post(
        "/api/admin/admin-users",
        json={"username": "new_courier", "password": "pw12345", "role": "courier"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    created = db_session.query(AdminUser).filter_by(username="new_courier").one()
    assert created.restaurant_id is not None


def test_default_store_creates_restaurant_with_business_id(db_session):
    # No restaurant exists yet in this clean session — default_store() must
    # create one and attach it to the (only) existing Business row.
    business = Business(name="Biznes2", username="admwrite_biz2", hashed_password="x")
    db_session.add(business)
    db_session.commit()
    assert db_session.query(Restaurant).first() is None

    from app.api.routes.admin import default_store
    created = default_store(db_session)
    assert created.business_id == business.id
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_admin_write_paths.py -v`
Expected: FAIL — `test_create_admin_user_sets_restaurant_id_from_creator` fails with a 500 (IntegrityError, `restaurant_id` NOT NULL) or the `created.restaurant_id is not None` assertion fails; `test_default_store_creates_restaurant_with_business_id` fails because `default_store()` doesn't set `business_id`.

- [ ] **Step 3: Fix both call sites**

In `app/api/routes/admin.py`, update `default_store()`:

```python
def default_store(db: Session) -> Restaurant:
    """The single grocery store. Created on demand so categories/products
    always have a home without the admin picking a restaurant."""
    store = db.scalar(select(Restaurant).order_by(Restaurant.id).limit(1))
    if not store:
        business = db.scalar(select(Business).order_by(Business.id).limit(1))
        store = Restaurant(name="Do'kon", is_active=True, is_open=True, business_id=business.id)
        db.add(store)
        db.commit()
        db.refresh(store)
    return store
```

Add `Business` to the imports at the top of `app/api/routes/admin.py`:

```python
from app.models import (
    AdminUser, Announcement, Business, Category, Order, OrderItem, Product, PushSubscription,
    Restaurant, SupplyRecord, User,
)
```

Update `create_admin_user` to use the authenticated superadmin's own `restaurant_id`:

```python
@router.post("/admin-users", response_model=AdminUserOut, status_code=201)
def create_admin_user(
    data: _AdminUserCreateIn,
    admin: AdminUser = Depends(require_superadmin),
    db: Session = Depends(get_db),
):
    if db.scalar(select(AdminUser).where(AdminUser.username == data.username)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Username already taken")
    u = AdminUser(
        username=data.username,
        hashed_password=hash_password(data.password),
        role=data.role,
        restaurant_id=admin.restaurant_id,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_admin_write_paths.py -v`
Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
git add app/api/routes/admin.py tests/test_admin_write_paths.py
git commit -m "fix: set business_id/restaurant_id on the last two admin write paths"
```

---

### Task 7: `initdb.py` migration (existing installs) + `seed.py` (fresh installs)

**Files:**
- Modify: `app/initdb.py`
- Modify: `app/seed.py`
- Test: `tests/test_initdb_migration.py`

- [ ] **Step 1: Write the failing test**

Create `tests/test_initdb_migration.py`:

```python
from sqlalchemy import text


def test_initdb_is_idempotent_and_creates_default_business(engine):
    from app.initdb import main as initdb_main

    initdb_main(engine=engine)
    initdb_main(engine=engine)  # second run must not error (idempotent)

    with engine.connect() as conn:
        business_count = conn.execute(text("SELECT COUNT(*) FROM businesses")).scalar()
        assert business_count >= 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_initdb_migration.py -v`
Expected: FAIL with `TypeError: main() got an unexpected keyword argument 'engine'`

- [ ] **Step 3: Update initdb.py and seed.py**

In `app/initdb.py`, change the `main()` signature to accept an optional engine (default: the module-level one), and add the business/restaurant/admin_user backfill. Replace the existing `def main() -> None:` block with:

```python
def _ensure_default_business(conn) -> int:
    """At least one Business must exist before restaurants.business_id can be
    backfilled. Its login is a random, unusable placeholder password — the
    businessman PWA (a later project) is what lets someone set a real one."""
    row = conn.execute(text("SELECT id FROM businesses ORDER BY id LIMIT 1")).first()
    if row:
        return row[0]
    placeholder_hash = hash_password(secrets.token_urlsafe(32))
    result = conn.execute(
        text(
            "INSERT INTO businesses (name, username, hashed_password, is_active, created_at) "
            "VALUES (:name, :username, :hash, TRUE, now()) RETURNING id"
        ),
        {"name": "Asosiy biznes", "username": "default_business", "hash": placeholder_hash},
    )
    return result.scalar_one()


def main(engine=engine) -> None:
    Base.metadata.create_all(bind=engine)
    # Enum qiymatlari — har birini alohida AUTOCOMMIT bilan (xato bo'lsa o'tkazib yuboramiz,
    # masalan jadval hali yo'q bo'lsa create_all uni endigina yaratgan bo'ladi).
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        for stmt in _ENUM_VALUES:
            try:
                conn.execute(text(stmt))
            except Exception as e:  # noqa: BLE001
                print(f"enum value skip: {e}")
    with engine.begin() as conn:
        for stmt in (
            *_PRODUCT_COLUMNS,
            *_CATEGORY_COLUMNS,
            *_ORDER_ITEM_COLUMNS,
            *_ORDER_COLUMNS,
            *_ZONE_COLUMNS,
            *_PUSH_COLUMNS,
            *_USER_COLUMNS,
            *_STORE_COLUMNS,
        ):
            conn.execute(text(stmt))

        # Multi-tenant foundation: businesses/restaurants/admin_users backfill.
        business_id = _ensure_default_business(conn)
        conn.execute(text(
            "ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS business_id INTEGER "
            "REFERENCES businesses(id)"
        ))
        conn.execute(
            text("UPDATE restaurants SET business_id = :bid WHERE business_id IS NULL"),
            {"bid": business_id},
        )
        conn.execute(text("ALTER TABLE restaurants ALTER COLUMN business_id SET NOT NULL"))

        conn.execute(text(
            "ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS restaurant_id INTEGER "
            "REFERENCES restaurants(id)"
        ))
        first_restaurant = conn.execute(
            text("SELECT id FROM restaurants ORDER BY id LIMIT 1")
        ).first()
        if first_restaurant:
            conn.execute(
                text("UPDATE admin_users SET restaurant_id = :rid WHERE restaurant_id IS NULL"),
                {"rid": first_restaurant[0]},
            )
        conn.execute(text("ALTER TABLE admin_users ALTER COLUMN restaurant_id SET NOT NULL"))
    print("Tables created / verified.")


if __name__ == "__main__":
    main()
```

Add these two imports to the top of `app/initdb.py` (alongside the existing `from sqlalchemy import text`):

```python
import secrets

from app.core.security import hash_password
```

In `app/seed.py`, update to look up the default business (guaranteed to exist because `initdb.py` always runs first) and attach it / the restaurant to the new rows, and reorder so the restaurant is created before the admin user (the admin user now needs `restaurant.id`):

```python
"""Bootstrap the superadmin and a single default store. Idempotent.

No mock catalog — categories and products are added from the admin panel.
"""

from sqlalchemy import select

from app.core.config import settings
from app.core.db import SessionLocal
from app.core.security import hash_password
from app.models import AdminUser, Business, Restaurant
from app.models.enums import AdminRole

DEFAULT_STORE_NAME = "Do'kon"


def seed() -> None:
    with SessionLocal() as db:
        # ── single default store (business_id comes from the default Business
        # row that initdb.py always creates before seed.py runs) ──
        restaurant = db.scalar(select(Restaurant).limit(1))
        if not restaurant:
            business = db.scalar(select(Business).order_by(Business.id).limit(1))
            restaurant = Restaurant(
                name=DEFAULT_STORE_NAME,
                is_active=True, is_open=True,
                delivery_fee=0, min_order=0,
                business_id=business.id,
            )
            db.add(restaurant)
            db.commit()
            db.refresh(restaurant)
            print(f"Created default store '{DEFAULT_STORE_NAME}'.")

        # ── bootstrap superadmin ──
        if not db.scalar(select(AdminUser).where(AdminUser.username == settings.first_admin_username)):
            db.add(AdminUser(
                username=settings.first_admin_username,
                hashed_password=hash_password(settings.first_admin_password),
                role=AdminRole.superadmin,
                restaurant_id=restaurant.id,
            ))
            db.commit()
            print(f"Created superadmin '{settings.first_admin_username}'.")


if __name__ == "__main__":
    seed()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_initdb_migration.py -v`
Expected: 1 passed

Then run the full suite to confirm nothing else broke:

Run: `pytest -v`
Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add app/initdb.py app/seed.py tests/test_initdb_migration.py
git commit -m "feat: backfill business_id/restaurant_id in initdb.py, update seed.py"
```

---

### Task 8: Manual verification against the local-test stack

This exercises the actual migration path (`initdb.py` + `seed.py`) the way it runs in production — against a disposable local Postgres, not the pytest fixture DB.

- [ ] **Step 1: Start a clean local-test stack**

```bash
cd ..  # to the outer "All Foods" repo root
docker compose -f docker-compose.local-test.yml up -d --build
```

- [ ] **Step 2: Confirm the backend came up clean**

```bash
docker compose -f docker-compose.local-test.yml logs backend | tail -20
```

Expected: `Tables created / verified.`, `Created default store 'Do'kon'.`, `Created superadmin 'admin'.` (or your configured `FIRST_ADMIN_USERNAME`), no tracebacks.

- [ ] **Step 3: Confirm the existing admin app still logs in and works**

```bash
curl -s -X POST http://localhost:8010/api/admin/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin12345"}'
```

Expected: `{"access_token": "...", "token_type": "bearer"}` (or a 401 if you changed `FIRST_ADMIN_PASSWORD` in `.env` — either way, no 500).

- [ ] **Step 4: Confirm the new business_id/restaurant_id are actually set**

```bash
docker compose -f docker-compose.local-test.yml exec postgres \
  psql -U allfoods -d allfoods -c "SELECT id, name, business_id FROM restaurants;" \
  -c "SELECT id, username, role, restaurant_id FROM admin_users;"
```

Expected: every row has a non-null `business_id` / `restaurant_id`.

- [ ] **Step 5: Tear down**

```bash
docker compose -f docker-compose.local-test.yml down -v
```
