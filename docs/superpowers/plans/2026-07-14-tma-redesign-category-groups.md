# tma Redesign + Category Groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional "category group" layer (home-page section headers, e.g. "Meva va sabzavotlar") that categories can belong to, and redesign tma's Home/Cart/Profile pages to a modern pastel-card look, matching the reference screenshots.

**Architecture:** New `category_groups` table + nullable `Category.group_id` FK — fully additive, existing categories default to ungrouped (rendered exactly as today, no header). Group CRUD is added to the existing `/admin/categories` router (`admin.py`), which businessman already calls via `?restaurant_id=` — no separate `/business/*` router needed. tma's `HomePage` groups categories client-side using `RestaurantDetail.category_groups`. `CartPage` and `ProfilePage` are restyled in place; `ProfilePage` also gains inline-editable name/phone (new `PATCH /auth/me`), an address/language expandable rows, and static support/offer rows.

**Tech Stack:** FastAPI + SQLAlchemy + pytest (backend), React + TS + Tailwind + Vite (admin, businessman, tma).

---

## Backend

### Task 1: `CategoryGroup` model + `Category.group_id` column

**Files:**
- Modify: `backend/app/models/restaurant.py:42-58` (add `CategoryGroup` class, add `group_id` to `Category`)
- Modify: `backend/app/models/__init__.py`
- Modify: `backend/app/initdb.py:24-28` (`_CATEGORY_COLUMNS`)

- [ ] **Step 1: Add the `CategoryGroup` model and `Category.group_id` column**

In `backend/app/models/restaurant.py`, insert a new class right before `class Category(Base):` (currently line 42), and add one field inside `Category`:

```python
class CategoryGroup(Base):
    """Bosh sahifadagi kategoriya bo'limi sarlavhasi (masalan 'Meva va sabzavotlar').

    Faqat vizual guruhlash — mahsulot qo'shishda tanlanmaydi.
    """
    __tablename__ = "category_groups"

    id: Mapped[int] = mapped_column(primary_key=True)
    restaurant_id: Mapped[int] = mapped_column(ForeignKey("restaurants.id", ondelete="CASCADE"), index=True)
    name_uz: Mapped[str] = mapped_column(String(128))
    name_ru: Mapped[str] = mapped_column(String(128))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    restaurant_id: Mapped[int] = mapped_column(ForeignKey("restaurants.id", ondelete="CASCADE"), index=True)
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id", ondelete="CASCADE"), index=True
    )
    # Faqat top-level (parent_id IS NULL) qatorlarda ma'noli — Home sahifada
    # qaysi bo'lim ostida ko'rsatilishini belgilaydi. NULL = guruhsiz (sarlavhasiz).
    group_id: Mapped[int | None] = mapped_column(
        ForeignKey("category_groups.id", ondelete="SET NULL"), index=True
    )
    name_uz: Mapped[str] = mapped_column(String(128))
    name_ru: Mapped[str] = mapped_column(String(128))
    image_url: Mapped[str | None] = mapped_column(String(512))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    restaurant = relationship("Restaurant", back_populates="categories")
    parent = relationship("Category", remote_side=[id], back_populates="children")
    children = relationship("Category", back_populates="parent", cascade="all, delete-orphan")
    products = relationship("Product", back_populates="category", cascade="all, delete-orphan")
```

- [ ] **Step 2: Register `CategoryGroup` in `app/models/__init__.py`**

Change the restaurant import line and `__all__`:

```python
from app.models.restaurant import Category, CategoryGroup, Product, Restaurant
```

Add `"CategoryGroup",` to `__all__` (next to `"Category",`).

- [ ] **Step 3: Idempotent prod migration for `categories.group_id`**

In `backend/app/initdb.py`, `_CATEGORY_COLUMNS` (currently lines 25-28) becomes:

```python
_CATEGORY_COLUMNS = (
    "ALTER TABLE categories ADD COLUMN IF NOT EXISTS image_url VARCHAR(512)",
    "ALTER TABLE categories ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES categories(id) ON DELETE CASCADE",
    # Yangi: bo'lim sarlavhasi (category_groups) — create_all yangi jadvalni
    # (category_groups) allaqachon yaratgan bo'ladi, shu ALTER undan keyin ishlaydi.
    "ALTER TABLE categories ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES category_groups(id) ON DELETE SET NULL",
)
```

No other initdb changes needed — `Base.metadata.create_all(bind=engine)` (line 110) creates the new `category_groups` table automatically since it's registered on `Base.metadata` via Step 2.

- [ ] **Step 4: Verify import + migration runs cleanly**

Run: `cd backend && python -c "import app.models; from app.models import CategoryGroup; print(CategoryGroup.__tablename__)"`
Expected: `category_groups`

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/restaurant.py backend/app/models/__init__.py backend/app/initdb.py
git commit -m "feat: add CategoryGroup model + Category.group_id column"
```

---

### Task 2: Schemas — `CategoryGroupOut`/`In`, `Category.group_id`, `RestaurantDetail.category_groups`

**Files:**
- Modify: `backend/app/schemas/catalog.py`

- [ ] **Step 1: Add group schemas and wire `group_id` / `category_groups`**

In `backend/app/schemas/catalog.py`, add after the `ProductOut` class and before `class CategoryOut`:

```python
class CategoryGroupOut(BaseModel):
    id: int
    name_uz: str
    name_ru: str
    sort_order: int

    class Config:
        from_attributes = True


class CategoryGroupIn(BaseModel):
    name_uz: str
    name_ru: str
    sort_order: int = 0
```

Modify `CategoryOut` to add `group_id`:

```python
class CategoryOut(BaseModel):
    id: int
    parent_id: int | None = None
    group_id: int | None = None
    name_uz: str
    name_ru: str
    image_url: str | None = None
    sort_order: int

    class Config:
        from_attributes = True
```

Modify `RestaurantDetail` to add `category_groups`:

```python
class RestaurantDetail(RestaurantOut):
    categories: list[CategoryWithSubcategories] = []
    category_groups: list[CategoryGroupOut] = []
```

Modify `CategoryIn` (admin write schema) to add `group_id`:

```python
class CategoryIn(BaseModel):
    parent_id: int | None = None
    group_id: int | None = None
    name_uz: str
    name_ru: str
    image_url: str | None = None
    sort_order: int = 0
```

- [ ] **Step 2: Verify it imports**

Run: `cd backend && python -c "from app.schemas.catalog import CategoryGroupOut, CategoryGroupIn, RestaurantDetail; print('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add backend/app/schemas/catalog.py
git commit -m "feat: add CategoryGroup schemas, wire group_id into Category/RestaurantDetail"
```

---

### Task 3: Wire `category_groups` into `_build_detail` (public catalog)

**Files:**
- Modify: `backend/app/api/routes/catalog.py:1-53`
- Test: `backend/tests/test_category_groups.py` (new)

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_category_groups.py`:

```python
from tests.conftest import auth


def test_restaurant_detail_includes_category_groups(client, tenant_a, db_session):
    from app.models import Category, CategoryGroup

    group = CategoryGroup(restaurant_id=tenant_a.restaurant_id, name_uz="Meva", name_ru="Meva", sort_order=0)
    db_session.add(group)
    db_session.commit()

    top = Category(
        restaurant_id=tenant_a.restaurant_id, parent_id=None, group_id=group.id,
        name_uz="Mevalar", name_ru="Mevalar", sort_order=0,
    )
    db_session.add(top)
    db_session.commit()

    resp = client.get(f"/api/restaurants/{tenant_a.restaurant_id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["category_groups"] == [
        {"id": group.id, "name_uz": "Meva", "name_ru": "Meva", "sort_order": 0}
    ]
    assert body["categories"][0]["group_id"] == group.id


def test_ungrouped_category_has_null_group_id(client, tenant_a, db_session):
    from app.models import Category

    top = Category(
        restaurant_id=tenant_a.restaurant_id, parent_id=None,
        name_uz="Sut", name_ru="Sut", sort_order=0,
    )
    db_session.add(top)
    db_session.commit()

    resp = client.get(f"/api/restaurants/{tenant_a.restaurant_id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["category_groups"] == []
    assert body["categories"][0]["group_id"] is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_category_groups.py -v`
Expected: FAIL — `category_groups` key missing from response (or `KeyError`/assertion mismatch).

- [ ] **Step 3: Wire groups into `_build_detail`**

In `backend/app/api/routes/catalog.py`, change the imports (currently lines 6-13):

```python
from app.core.db import get_db
from app.models import Category, CategoryGroup, Product, Restaurant
from app.schemas.catalog import (
    CategoryGroupOut,
    CategoryWithSubcategories,
    ProductOut,
    RestaurantDetail,
    RestaurantOut,
    SubcategoryOut,
)
```

Change `_build_detail` (currently lines 27-53) to also fetch and attach groups:

```python
def _build_detail(restaurant: Restaurant, db: Session) -> RestaurantDetail:
    groups = db.scalars(
        select(CategoryGroup)
        .where(CategoryGroup.restaurant_id == restaurant.id)
        .order_by(CategoryGroup.sort_order)
    ).all()

    top_categories = db.scalars(
        select(Category)
        .where(Category.restaurant_id == restaurant.id, Category.parent_id.is_(None))
        .order_by(Category.sort_order)
        .options(selectinload(Category.children).selectinload(Category.products))
    ).all()

    cat_out = []
    for top in top_categories:
        sub_out = []
        for sub in sorted(top.children, key=lambda x: x.sort_order):
            products = [
                ProductOut.model_validate(p)
                for p in sorted(sub.products, key=lambda x: x.sort_order)
                if p.is_available
            ]
            sw = SubcategoryOut.model_validate(sub)
            sw.products = products
            sub_out.append(sw)
        cw = CategoryWithSubcategories.model_validate(top)
        cw.subcategories = sub_out
        cat_out.append(cw)

    detail = RestaurantDetail.model_validate(restaurant)
    detail.categories = cat_out
    detail.category_groups = [CategoryGroupOut.model_validate(g) for g in groups]
    return detail
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pytest tests/test_category_groups.py -v`
Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/routes/catalog.py backend/tests/test_category_groups.py
git commit -m "feat: include category_groups in restaurant detail response"
```

---

### Task 4: `/admin/category-groups` CRUD (used by both admin + businessman)

**Files:**
- Modify: `backend/app/api/routes/admin.py:14-26` (imports), insert new routes after line 353 (end of `delete_category`)
- Test: `backend/tests/test_category_groups.py` (append)

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_category_groups.py`:

```python
def _make_group(client, tenant, name="Meva va sabzavotlar"):
    return client.post(
        f"/api/admin/category-groups?restaurant_id={tenant.restaurant_id}",
        json={"name_uz": name, "name_ru": name, "sort_order": 0},
        headers=auth(tenant.business_token),
    )


def test_business_creates_category_group(client, tenant_a):
    resp = _make_group(client, tenant_a)
    assert resp.status_code == 201
    assert resp.json()["name_uz"] == "Meva va sabzavotlar"


def test_category_group_list_is_scoped(client, tenant_a, tenant_b):
    _make_group(client, tenant_a, "A guruh")
    _make_group(client, tenant_b, "B guruh")

    resp = client.get(
        f"/api/admin/category-groups?restaurant_id={tenant_a.restaurant_id}",
        headers=auth(tenant_a.business_token),
    )
    assert resp.status_code == 200
    names = [g["name_uz"] for g in resp.json()]
    assert names == ["A guruh"]


def test_business_cannot_update_other_stores_group(client, tenant_a, tenant_b):
    group_id = _make_group(client, tenant_b, "B guruh").json()["id"]
    resp = client.put(
        f"/api/admin/category-groups/{group_id}?restaurant_id={tenant_a.restaurant_id}",
        json={"name_uz": "O'g'irlangan", "name_ru": "O'g'irlangan", "sort_order": 0},
        headers=auth(tenant_a.business_token),
    )
    assert resp.status_code == 404


def test_delete_group_nulls_category_group_id(client, tenant_a, db_session):
    from app.models import Category

    group_id = _make_group(client, tenant_a).json()["id"]
    cat = Category(
        restaurant_id=tenant_a.restaurant_id, parent_id=None, group_id=group_id,
        name_uz="Mevalar", name_ru="Mevalar", sort_order=0,
    )
    db_session.add(cat)
    db_session.commit()
    cat_id = cat.id

    resp = client.delete(
        f"/api/admin/category-groups/{group_id}?restaurant_id={tenant_a.restaurant_id}",
        headers=auth(tenant_a.business_token),
    )
    assert resp.status_code == 204

    db_session.expire_all()
    refreshed = db_session.get(Category, cat_id)
    assert refreshed.group_id is None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && pytest tests/test_category_groups.py -v -k group`
Expected: FAIL — `404 Not Found` (no such route) on all four.

- [ ] **Step 3: Add the routes**

In `backend/app/api/routes/admin.py`, change the model import (currently lines 14-17):

```python
from app.models import (
    AdminUser, Business, Category, CategoryGroup, Order, OrderItem, Product, PushSubscription,
    Restaurant, SupplyRecord, User,
)
```

Change the catalog schema import (currently lines 24-26):

```python
from app.schemas.catalog import (
    CategoryGroupIn, CategoryGroupOut, CategoryIn, CategoryOut, ProductIn, ProductOut,
    RestaurantOut, StoreSettingsIn,
)
```

Insert this block right after `delete_category` (ends at line 353, right before the `# ── Products` comment on line 355):

```python
# ── Category groups (Home sahifadagi bo'lim sarlavhalari) ─────────
@router.get("/category-groups", response_model=list[CategoryGroupOut])
def list_category_groups(
    store: Restaurant = Depends(current_restaurant), db: Session = Depends(get_db)
):
    return db.scalars(
        select(CategoryGroup)
        .where(CategoryGroup.restaurant_id == store.id)
        .order_by(CategoryGroup.sort_order)
    ).all()


@router.post("/category-groups", response_model=CategoryGroupOut, status_code=201)
def create_category_group(
    data: CategoryGroupIn,
    store: Restaurant = Depends(current_restaurant),
    db: Session = Depends(get_db),
):
    g = CategoryGroup(**data.model_dump(), restaurant_id=store.id)
    db.add(g)
    db.commit()
    db.refresh(g)
    return g


@router.put("/category-groups/{gid}", response_model=CategoryGroupOut)
def update_category_group(
    gid: int,
    data: CategoryGroupIn,
    store: Restaurant = Depends(current_restaurant),
    db: Session = Depends(get_db),
):
    g = db.get(CategoryGroup, gid)
    if not g or g.restaurant_id != store.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    for k, v in data.model_dump().items():
        setattr(g, k, v)
    db.commit()
    db.refresh(g)
    return g


@router.delete("/category-groups/{gid}", status_code=204)
def delete_category_group(
    gid: int, store: Restaurant = Depends(current_restaurant), db: Session = Depends(get_db)
):
    g = db.get(CategoryGroup, gid)
    if g and g.restaurant_id == store.id:
        db.delete(g)
        db.commit()

```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && pytest tests/test_category_groups.py -v`
Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/routes/admin.py backend/tests/test_category_groups.py
git commit -m "feat: add /admin/category-groups CRUD (admin + businessman via restaurant_id)"
```

---

### Task 5: `PATCH /auth/me` + `UserOut.created_at`

**Files:**
- Modify: `backend/app/schemas/auth.py`
- Modify: `backend/app/api/routes/auth.py`
- Test: `backend/tests/test_user_profile.py` (new)

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_user_profile.py`:

```python
from tests.conftest import auth
from app.core.security import create_access_token
from app.models import User


def _make_user(db_session, telegram_id=555) -> User:
    user = User(telegram_id=telegram_id, first_name="Eski Ism", phone=None, language="uz")
    db_session.add(user)
    db_session.commit()
    return user


def test_me_includes_created_at(client, db_session):
    user = _make_user(db_session)
    token = create_access_token(subject=str(user.id), role="user")
    resp = client.get("/api/auth/me", headers=auth(token))
    assert resp.status_code == 200
    assert resp.json()["created_at"] is not None


def test_patch_me_updates_name_and_phone(client, db_session):
    user = _make_user(db_session)
    token = create_access_token(subject=str(user.id), role="user")

    resp = client.patch(
        "/api/auth/me",
        json={"first_name": "Yangi Ism", "phone": "+998901234567"},
        headers=auth(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["first_name"] == "Yangi Ism"
    assert body["phone"] == "+998901234567"


def test_patch_me_partial_update_keeps_other_field(client, db_session):
    user = _make_user(db_session)
    token = create_access_token(subject=str(user.id), role="user")

    resp = client.patch("/api/auth/me", json={"phone": "+998901234567"}, headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["first_name"] == "Eski Ism"
    assert body["phone"] == "+998901234567"


def test_patch_me_requires_auth(client, db_session):
    resp = client.patch("/api/auth/me", json={"first_name": "X"})
    assert resp.status_code == 401
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && pytest tests/test_user_profile.py -v`
Expected: FAIL — `created_at` missing / `405 Method Not Allowed` on PATCH.

- [ ] **Step 3: Add `created_at` to `UserOut` and `UserUpdateIn` schema**

In `backend/app/schemas/auth.py`, add `from datetime import datetime` at the top, and change `UserOut` (currently lines 18-28):

```python
from datetime import datetime

from pydantic import BaseModel
```

```python
class UserOut(BaseModel):
    id: int
    telegram_id: int
    username: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    language: str
    created_at: datetime

    class Config:
        from_attributes = True


class UserUpdateIn(BaseModel):
    first_name: str | None = None
    phone: str | None = None
```

- [ ] **Step 4: Add the `PATCH /auth/me` route**

In `backend/app/api/routes/auth.py`, change the schema import (currently line 10):

```python
from app.schemas.auth import AuthResult, TelegramAuthIn, TokenOut, UserOut, UserUpdateIn
```

Append after the existing `me` route (currently lines 44-46):

```python
@router.patch("/me", response_model=UserOut)
def update_me(
    data: UserUpdateIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    if data.first_name is not None:
        user.first_name = data.first_name
    if data.phone is not None:
        user.phone = data.phone
    db.commit()
    db.refresh(user)
    return user
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && pytest tests/test_user_profile.py -v`
Expected: 4 passed

- [ ] **Step 6: Run the full backend suite to check nothing broke**

Run: `cd backend && pytest -q`
Expected: all pass (no regressions from the `UserOut.created_at` addition — check `test_multi_tenant_auth.py` and any other `UserOut`/`AuthResult` consumers still pass; `created_at` is a required field added to an output-only schema, so no caller needs to change).

- [ ] **Step 7: Commit**

```bash
git add backend/app/schemas/auth.py backend/app/api/routes/auth.py backend/tests/test_user_profile.py
git commit -m "feat: add PATCH /auth/me (name/phone) and UserOut.created_at"
```

---

## Admin panel

### Task 6: `admin/src/types.ts` — `CategoryGroup` type

**Files:**
- Modify: `admin/src/types.ts:20-27`

- [ ] **Step 1: Add the type and `group_id` field**

```typescript
export interface CategoryGroup {
  id: number;
  name_uz: string;
  name_ru: string;
  sort_order: number;
}

export interface Category {
  id: number;
  parent_id?: number | null;
  group_id?: number | null;
  name_uz: string;
  name_ru: string;
  image_url?: string | null;
  sort_order: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add admin/src/types.ts
git commit -m "feat: add CategoryGroup type to admin"
```

---

### Task 7: Admin `ProductsPage.tsx` — group management + assignment

**Files:**
- Modify: `admin/src/pages/ProductsPage.tsx`

- [ ] **Step 1: Import `CategoryGroup` type and add group state**

Change the type import (line 8):

```typescript
import type { Category, CategoryGroup, Product, Restaurant } from "../types";
```

Add a `groups` state next to `categories` (after line 40):

```typescript
  const [categories, setCategories] = useState<Category[]>([]);
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
```

Add `editGroup` state next to `editCat` (after line 43):

```typescript
  const [editCat, setEditCat] = useState<Partial<Category> | null>(null);
  const [editGroup, setEditGroup] = useState<Partial<CategoryGroup> | null>(null);
```

- [ ] **Step 2: Load groups alongside categories**

Change `loadData` (currently lines 55-65):

```typescript
  const loadData = async (sid: number) => {
    setErr(false);
    try {
      setCategories(await get<Category[]>(`/admin/restaurants/${sid}/categories`));
      setProducts(await get<Product[]>(`/admin/restaurants/${sid}/products`));
      setGroups(await get<CategoryGroup[]>(`/admin/category-groups?restaurant_id=${sid}`));
    } catch {
      setErr(true);
    } finally {
      setLoading(false);
    }
  };
```

- [ ] **Step 3: Add `saveGroup`/`removeGroup` handlers**

Insert after `saveCat` (ends at line 151, right before `const saveSubcat`):

```typescript
  const saveGroup = async () => {
    if (!editGroup || !storeId || !editGroup.name_uz?.trim() || saving) return;
    setSaving(true);
    try {
      const body = {
        name_uz: editGroup.name_uz,
        name_ru: editGroup.name_ru || editGroup.name_uz,
        sort_order: editGroup.sort_order ?? groups.length,
      };
      if (editGroup.id) await put(`/admin/category-groups/${editGroup.id}?restaurant_id=${storeId}`, body);
      else await post(`/admin/category-groups?restaurant_id=${storeId}`, body);
      const isEdit = !!editGroup.id;
      setEditGroup(null);
      await loadData(storeId);
      toast.success(isEdit ? "Guruh yangilandi" : "Guruh qo'shildi");
    } catch {
      toast.error("Saqlab bo'lmadi");
    } finally {
      setSaving(false);
    }
  };

  const removeGroup = async (g: CategoryGroup) => {
    if (!storeId) return;
    const count = categories.filter((c) => c.group_id === g.id).length;
    const ok = await confirm({
      title: `"${g.name_uz}" guruhi o'chirilsinmi?`,
      message: count ? `Bu guruhda ${count} ta kategoriya bor — ular guruhsiz qoladi.` : undefined,
      confirmText: "O'chirish",
      danger: true,
    });
    if (!ok) return;
    try {
      await del(`/admin/category-groups/${g.id}?restaurant_id=${storeId}`);
      await loadData(storeId);
      toast.success("Guruh o'chirildi");
    } catch {
      toast.error("O'chirib bo'lmadi");
    }
  };
```

- [ ] **Step 4: Add "Guruhlar" tab button**

`Tab` type (line 10) becomes:

```typescript
type Tab = "products" | "subcategories" | "categories" | "groups";
```

After the "Kategoriyalar" tab button (ends at line 263, right before the closing `</div>` of the tab bar at line 264), add:

```typescript
        <button
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${tab === "groups" ? "bg-brand text-white shadow-sm" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
          onClick={() => setTab("groups")}
        ><Tags size={16} /> Guruhlar</button>
```

- [ ] **Step 5: Add the "Guruhlar" tab body**

Insert a new tab section right after the `{/* ── CATEGORIES ───────────────────────────────────── */}` block closes (currently ends at line 466, right before `{/* ── PRODUCT MODAL */}`):

```typescript
      {/* ── GROUPS ───────────────────────────────────────── */}
      {tab === "groups" && (
        <>
          <div className="flex justify-end mb-4">
            <button className="btn" onClick={() => setEditGroup({})}><Plus size={18} /> Guruh qo'shish</button>
          </div>

          {err ? <ErrorRetry onRetry={reload} /> : loading ? <TableSkeleton cols={3} /> : (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50">
                  <th className="th">Nomi (uz)</th>
                  <th className="th">Название (ru)</th>
                  <th className="th">Kategoriyalar</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.id} className="hover:bg-slate-50/60">
                    <td className="td font-medium text-slate-900">{g.name_uz}</td>
                    <td className="td">{g.name_ru}</td>
                    <td className="td">{categories.filter((c) => c.group_id === g.id).length}</td>
                    <td className="td text-right">
                      <div className="inline-flex items-center gap-1">
                        <button className="icon-btn" title="Tahrirlash" onClick={() => setEditGroup(g)}><Pencil size={16} /></button>
                        <button className="icon-btn hover:text-red-600" title="O'chirish" onClick={() => removeGroup(g)}><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {groups.length === 0 && (
                  <tr><td colSpan={4} className="td text-center text-slate-400 py-10">
                    Guruh yo'q — Bosh sahifada kategoriyalar sarlavhasiz ko'rinadi
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
          )}
        </>
      )}

```

- [ ] **Step 6: Add the group edit modal**

Insert right after the CATEGORY MODAL block closes (currently ends at line 709, right before `{/* ── SUBCATEGORY MODAL */}`):

```typescript
      {/* ── GROUP MODAL ──────────────────────────────────── */}
      {editGroup && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="card w-full max-w-lg">
            <div className="px-7 pt-7 pb-4 border-b border-slate-100">
              <h2 className="font-bold text-xl">{editGroup.id ? "Guruhni tahrirlash" : "Yangi guruh"}</h2>
              <p className="text-sm text-slate-400 mt-0.5">Bosh sahifada bo'lim sarlavhasi sifatida ko'rinadi</p>
            </div>
            <div className="px-7 py-5 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Nomi (uz)</label>
                <input className="input" placeholder="Masalan: Meva va sabzavotlar" value={editGroup.name_uz ?? ""}
                  onChange={(e) => setEditGroup({ ...editGroup, name_uz: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Название (ru)</label>
                <input className="input" placeholder="Например: Фрукты и овощи" value={editGroup.name_ru ?? ""}
                  onChange={(e) => setEditGroup({ ...editGroup, name_ru: e.target.value })} />
              </div>
            </div>
            <div className="px-7 py-4 border-t border-slate-100 flex gap-3 justify-end bg-slate-50/60 rounded-b-2xl">
              <button className="btn-ghost" onClick={() => setEditGroup(null)} disabled={saving}><CircleX size={16} /> Bekor</button>
              <button className="btn px-6" onClick={saveGroup} disabled={saving || !editGroup.name_uz?.trim()}>
                <CircleCheck size={16} /> {saving ? "Saqlanmoqda..." : "Saqlash"}
              </button>
            </div>
          </div>
        </div>
      )}
```

- [ ] **Step 7: Add the "Guruh" dropdown to the category (top-level) edit modal**

In the CATEGORY MODAL body (currently lines 678-699 inside `{editCat && ...}`), add a dropdown after the name fields grid and before the image upload block:

```typescript
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Guruh (ixtiyoriy)</label>
                <select className="input" value={editCat.group_id ?? ""}
                  onChange={(e) => setEditCat({ ...editCat, group_id: e.target.value ? +e.target.value : null })}>
                  <option value="">Guruhsiz</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name_uz}</option>
                  ))}
                </select>
              </div>
```

- [ ] **Step 8: Include `group_id` when saving a top-level category**

In `saveCat` (currently lines 128-151), the `body` object needs `group_id`:

```typescript
      const body = {
        restaurant_id: storeId,
        parent_id: null,
        group_id: editCat.group_id ?? null,
        name_uz: editCat.name_uz,
        name_ru: editCat.name_ru || editCat.name_uz,
        image_url: editCat.image_url ?? null,
        sort_order: editCat.sort_order ?? topCategories.length,
      };
```

- [ ] **Step 9: Type-check**

Run: `cd admin && npx tsc -b`
Expected: no errors

- [ ] **Step 10: Commit**

```bash
git add admin/src/pages/ProductsPage.tsx
git commit -m "feat: add category group management to admin ProductsPage"
```

---

## Businessman panel

### Task 8: `businessman/src/types.ts` — `CategoryGroup` type

**Files:**
- Modify: `businessman/src/types.ts:63-70`

- [ ] **Step 1: Add the type and `group_id` field** (identical to Task 6)

```typescript
export interface CategoryGroup {
  id: number;
  name_uz: string;
  name_ru: string;
  sort_order: number;
}

export interface Category {
  id: number;
  parent_id?: number | null;
  group_id?: number | null;
  name_uz: string;
  name_ru: string;
  image_url?: string | null;
  sort_order: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add businessman/src/types.ts
git commit -m "feat: add CategoryGroup type to businessman"
```

---

### Task 9: Businessman `ProductsPage.tsx` — group management + assignment

**Files:**
- Modify: `businessman/src/pages/ProductsPage.tsx`

Same shape as Task 7, but every request goes through `withStore(path, storeId)` and `storeId` can be `null` (see the existing empty-store guard at line 245).

- [ ] **Step 1: Import type + add state**

Change line 9:

```typescript
import type { Category, CategoryGroup, Product } from "../types";
```

Add after line 41 (`const [categories, setCategories] = useState<Category[]>([]);`):

```typescript
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
```

Add after line 44 (`const [editCat, setEditCat] = useState<Partial<Category> | null>(null);`):

```typescript
  const [editGroup, setEditGroup] = useState<Partial<CategoryGroup> | null>(null);
```

- [ ] **Step 2: Load groups in `loadData`**

Change `loadData` (currently lines 56-66):

```typescript
  const loadData = async (sid: number) => {
    setErr(false);
    try {
      setCategories(await get<Category[]>(withStore(`/admin/restaurants/${sid}/categories`, sid)));
      setProducts(await get<Product[]>(withStore(`/admin/restaurants/${sid}/products`, sid)));
      setGroups(await get<CategoryGroup[]>(withStore("/admin/category-groups", sid)));
    } catch {
      setErr(true);
    } finally {
      setLoading(false);
    }
  };
```

- [ ] **Step 3: Add `saveGroup`/`removeGroup` handlers**

Insert after `saveCat` (ends at line 152, before `const saveSubcat`):

```typescript
  const saveGroup = async () => {
    if (!editGroup || storeId == null || !editGroup.name_uz?.trim() || saving) return;
    setSaving(true);
    try {
      const body = {
        name_uz: editGroup.name_uz,
        name_ru: editGroup.name_ru || editGroup.name_uz,
        sort_order: editGroup.sort_order ?? groups.length,
      };
      if (editGroup.id) await put(withStore(`/admin/category-groups/${editGroup.id}`, storeId), body);
      else await post(withStore("/admin/category-groups", storeId), body);
      const isEdit = !!editGroup.id;
      setEditGroup(null);
      await loadData(storeId);
      toast.success(isEdit ? "Guruh yangilandi" : "Guruh qo'shildi");
    } catch {
      toast.error("Saqlab bo'lmadi");
    } finally {
      setSaving(false);
    }
  };

  const removeGroup = async (g: CategoryGroup) => {
    if (storeId == null) return;
    const count = categories.filter((c) => c.group_id === g.id).length;
    const ok = await confirm({
      title: `"${g.name_uz}" guruhi o'chirilsinmi?`,
      message: count ? `Bu guruhda ${count} ta kategoriya bor — ular guruhsiz qoladi.` : undefined,
      confirmText: "O'chirish",
      danger: true,
    });
    if (!ok) return;
    try {
      await del(withStore(`/admin/category-groups/${g.id}`, storeId));
      await loadData(storeId);
      toast.success("Guruh o'chirildi");
    } catch {
      toast.error("O'chirib bo'lmadi");
    }
  };
```

- [ ] **Step 4: Add "Guruhlar" tab button**

`Tab` type (currently line 11) becomes:

```typescript
type Tab = "products" | "subcategories" | "categories" | "groups";
```

After the "Kategoriyalar" tab button (ends at line 274, right before the closing `</div>` of the tab bar at line 275), add:

```typescript
        <button
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${tab === "groups" ? "bg-brand text-white shadow-sm" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
          onClick={() => setTab("groups")}
        ><Tags size={16} /> Guruhlar</button>
```

- [ ] **Step 5: Add the "Guruhlar" tab body**

Insert right after the `{/* ── CATEGORIES ───────────────────────────────────── */}` block closes (currently ends at line 477, right before `{/* ── PRODUCT MODAL */}`):

```typescript
      {/* ── GROUPS ───────────────────────────────────────── */}
      {tab === "groups" && (
        <>
          <div className="flex justify-end mb-4">
            <button className="btn" onClick={() => setEditGroup({})}><Plus size={18} /> Guruh qo'shish</button>
          </div>

          {err ? <ErrorRetry onRetry={reload} /> : loading ? <TableSkeleton cols={3} /> : (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50">
                  <th className="th">Nomi (uz)</th>
                  <th className="th">Название (ru)</th>
                  <th className="th">Kategoriyalar</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.id} className="hover:bg-slate-50/60">
                    <td className="td font-medium text-slate-900">{g.name_uz}</td>
                    <td className="td">{g.name_ru}</td>
                    <td className="td">{categories.filter((c) => c.group_id === g.id).length}</td>
                    <td className="td text-right">
                      <div className="inline-flex items-center gap-1">
                        <button className="icon-btn" title="Tahrirlash" onClick={() => setEditGroup(g)}><Pencil size={16} /></button>
                        <button className="icon-btn hover:text-red-600" title="O'chirish" onClick={() => removeGroup(g)}><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {groups.length === 0 && (
                  <tr><td colSpan={4} className="td text-center text-slate-400 py-10">
                    Guruh yo'q — Bosh sahifada kategoriyalar sarlavhasiz ko'rinadi
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
          )}
        </>
      )}

```

- [ ] **Step 6: Add the group edit modal**

Insert right after the CATEGORY MODAL block closes (currently ends at line 720, right before `{/* ── SUBCATEGORY MODAL */}`):

```typescript
      {/* ── GROUP MODAL ──────────────────────────────────── */}
      {editGroup && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="card w-full max-w-lg">
            <div className="px-7 pt-7 pb-4 border-b border-slate-100">
              <h2 className="font-bold text-xl">{editGroup.id ? "Guruhni tahrirlash" : "Yangi guruh"}</h2>
              <p className="text-sm text-slate-400 mt-0.5">Bosh sahifada bo'lim sarlavhasi sifatida ko'rinadi</p>
            </div>
            <div className="px-7 py-5 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Nomi (uz)</label>
                <input className="input" placeholder="Masalan: Meva va sabzavotlar" value={editGroup.name_uz ?? ""}
                  onChange={(e) => setEditGroup({ ...editGroup, name_uz: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Название (ru)</label>
                <input className="input" placeholder="Например: Фрукты и овощи" value={editGroup.name_ru ?? ""}
                  onChange={(e) => setEditGroup({ ...editGroup, name_ru: e.target.value })} />
              </div>
            </div>
            <div className="px-7 py-4 border-t border-slate-100 flex gap-3 justify-end bg-slate-50/60 rounded-b-2xl">
              <button className="btn-ghost" onClick={() => setEditGroup(null)} disabled={saving}><CircleX size={16} /> Bekor</button>
              <button className="btn px-6" onClick={saveGroup} disabled={saving || !editGroup.name_uz?.trim()}>
                <CircleCheck size={16} /> {saving ? "Saqlanmoqda..." : "Saqlash"}
              </button>
            </div>
          </div>
        </div>
      )}
```

- [ ] **Step 7: Add "Guruh" dropdown to the category (top-level) edit modal**

In the CATEGORY MODAL body (currently lines 689-711 inside `{editCat && ...}`), add a dropdown after the name fields grid and before the image upload block:

```typescript
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Guruh (ixtiyoriy)</label>
                <select className="input" value={editCat.group_id ?? ""}
                  onChange={(e) => setEditCat({ ...editCat, group_id: e.target.value ? +e.target.value : null })}>
                  <option value="">Guruhsiz</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name_uz}</option>
                  ))}
                </select>
              </div>
```

- [ ] **Step 8: Include `group_id` when saving a top-level category**

In `saveCat` (currently lines 130-152), the `body` object needs `group_id` (note: no `restaurant_id` key here — `withStore` carries it via query param):

```typescript
      const body = {
        parent_id: null,
        group_id: editCat.group_id ?? null,
        name_uz: editCat.name_uz,
        name_ru: editCat.name_ru || editCat.name_uz,
        image_url: editCat.image_url ?? null,
        sort_order: editCat.sort_order ?? topCategories.length,
      };
```

- [ ] **Step 9: Type-check**

Run: `cd businessman && npx tsc -b`
Expected: no errors

- [ ] **Step 10: Commit**

```bash
git add businessman/src/pages/ProductsPage.tsx
git commit -m "feat: add category group management to businessman ProductsPage"
```

---

## tma

### Task 10: `tma/src/api/types.ts` — new fields

**Files:**
- Modify: `tma/src/api/types.ts`

- [ ] **Step 1: Add `CategoryGroup`, `Category.group_id`, `RestaurantDetail.category_groups`, `User.created_at`**

Add before `export interface Category` (currently line 24):

```typescript
export interface CategoryGroup {
  id: number;
  name_uz: string;
  name_ru: string;
  sort_order: number;
}
```

Change `Category` (currently lines 24-31):

```typescript
export interface Category {
  id: number;
  group_id?: number | null;
  name_uz: string;
  name_ru: string;
  image_url?: string | null;
  sort_order: number;
  subcategories: Subcategory[];
}
```

Change `RestaurantDetail` (currently lines 52-54):

```typescript
export interface RestaurantDetail extends Restaurant {
  categories: Category[];
  category_groups: CategoryGroup[];
}
```

Change `User` (currently lines 106-113):

```typescript
export interface User {
  id: number;
  telegram_id: number;
  username?: string | null;
  first_name?: string | null;
  phone?: string | null;
  language: string;
  created_at: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add tma/src/api/types.ts
git commit -m "feat: add CategoryGroup, group_id, created_at to tma types"
```

---

### Task 11: `tma/src/api/client.ts` — `updateMe`

**Files:**
- Modify: `tma/src/api/client.ts`

- [ ] **Step 1: Add `updateMe` to the `api` object**

Insert after the `authTelegram` entry (currently lines 55-59):

```typescript
  updateMe: (data: { first_name?: string; phone?: string }) =>
    req<User>("/auth/me", { method: "PATCH", body: JSON.stringify(data) }),
```

- [ ] **Step 2: Commit**

```bash
git add tma/src/api/client.ts
git commit -m "feat: add api.updateMe (PATCH /auth/me)"
```

---

### Task 12: `tma/src/store/auth.ts` — `setUser` action

**Files:**
- Modify: `tma/src/store/auth.ts`

- [ ] **Step 1: Add `setUser` to the store**

Change the interface and store body:

```typescript
interface AuthState {
  user: User | null;
  ready: boolean;
  error: string | null;
  login: () => Promise<void>;
  setUser: (user: User) => void;
}
```

```typescript
export const useAuth = create<AuthState>((set) => ({
  user: null,
  ready: false,
  error: null,
  setUser: (user) => set({ user }),
  login: async () => {
    if (authInFlight) return;
    const initData = getInitData();
    if (!initData) {
      set({ ready: true, error: "Telegram konteksti topilmadi (brauzer rejimi)" });
      return;
    }
    authInFlight = true;
    try {
      const res = await api.authTelegram(initData);
      setToken(res.token.access_token);
      set({ user: res.user, ready: true, error: null });
    } catch (e) {
      set({ ready: true, error: String(e) });
    } finally {
      authInFlight = false;
    }
  },
}));
```

- [ ] **Step 2: Commit**

```bash
git add tma/src/store/auth.ts
git commit -m "feat: add setUser action to tma auth store"
```

---

### Task 13: `tma/src/i18n.ts` — new keys

**Files:**
- Modify: `tma/src/i18n.ts`

- [ ] **Step 1: Add new keys to the `uz` dict**

Insert after `close: "Yopish",` (currently line 61, last key before the closing brace):

```typescript
    profile_name: "Ism",
    not_entered: "Kiritilmagan",
    language: "Til",
    support: "Qo'llab-quvvatlash",
    support_soon: "Tez orada",
    offer: "Ommaviy oferta",
    offer_text:
      "Ushbu ommaviy oferta AllFoods xizmatidan foydalanish shartlarini belgilaydi. " +
      "Xizmatdan foydalanish orqali siz ushbu shartlarga rozilik bildirasiz.",
    registered_at: "Ro'yxatdan o'tgan",
```

- [ ] **Step 2: Add the matching Russian keys**

Insert after `close: "Закрыть",` (currently line 117, last key before the closing brace):

```typescript
    profile_name: "Имя",
    not_entered: "Не указано",
    language: "Язык",
    support: "Поддержка",
    support_soon: "Скоро",
    offer: "Публичная оферта",
    offer_text:
      "Данная публичная оферта определяет условия использования сервиса AllFoods. " +
      "Используя сервис, вы соглашаетесь с настоящими условиями.",
    registered_at: "Дата регистрации",
```

- [ ] **Step 3: Commit**

```bash
git add tma/src/i18n.ts
git commit -m "feat: add profile/support/offer i18n keys"
```

---

### Task 14: `tma/src/pages/HomePage.tsx` — grouped pastel-card redesign

**Files:**
- Modify: `tma/src/pages/HomePage.tsx` (full rewrite)

- [ ] **Step 1: Replace the file**

```tsx
import { motion } from "framer-motion";
import { Search, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { Category, RestaurantDetail } from "../api/types";
import CartPill from "../components/CartPill";
import { StoreListSkeleton } from "../components/Skeleton";
import ErrorState from "../components/ErrorState";
import { loc, useI18n } from "../i18n";
import { useCart } from "../store/cart";
import { haptic } from "../telegram";

// Kartochka foni — rasm/rang admin panelda tanlanmaydi, indeks bo'yicha
// aylanadigan pastel palitra barcha kategoriyalarni bir xil uslubda ajratadi.
const PALETTE = [
  "bg-emerald-100", "bg-sky-100", "bg-amber-100",
  "bg-rose-100", "bg-violet-100", "bg-lime-100",
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};
const card = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 260, damping: 24 } },
};

export default function HomePage() {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const [store, setStore] = useState<RestaurantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const cart = useCart();

  const load = () => {
    setLoading(true);
    setError(false);
    api
      .store()
      .then((s) => {
        setStore(s);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  };

  useEffect(() => {
    load();
  }, []);

  const cats = store?.categories ?? [];
  const groups = [...(store?.category_groups ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const ungrouped = cats.filter((c) => c.group_id == null);
  const title = store?.name && store.name !== "Do'kon" ? store.name : "AllFoods";

  const open = (c: Category) => {
    haptic("light");
    nav(`/category/${c.id}`);
  };

  const renderCard = (c: Category, i: number) => (
    <motion.button
      key={c.id}
      variants={card}
      whileTap={{ scale: 0.97 }}
      onClick={() => open(c)}
      className={`relative h-36 rounded-3xl overflow-hidden text-left p-4 flex flex-col justify-between ${PALETTE[i % PALETTE.length]}`}
    >
      <h3 className="font-bold text-slate-900 text-base leading-tight pr-16 relative z-10">
        {loc(c, "name", lang)}
      </h3>
      {c.image_url && (
        <img
          src={c.image_url}
          alt=""
          className="absolute bottom-1 right-1 h-24 w-24 object-contain drop-shadow-md"
        />
      )}
    </motion.button>
  );

  return (
    <div className="min-h-full bg-tg-bg">
      {/* ── Sticky header: brand + search ──────────────────────── */}
      <div className="sticky top-0 z-20 bg-tg-bg px-3 pt-2 pb-3 shadow-sm shadow-black/5">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative bg-gradient-to-r from-brand to-brand-dark text-white rounded-2xl py-3.5 px-4 shadow-md shadow-brand/30"
        >
          <h1 className="text-center text-2xl font-extrabold tracking-tight">{title}</h1>
          <button
            onClick={() => nav("/cart")}
            className="absolute top-1/2 -translate-y-1/2 right-3 h-9 w-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center active:scale-90 transition"
          >
            <ShoppingBag size={18} />
            {cart.count() > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-white text-brand text-[10px] font-bold flex items-center justify-center">
                {cart.count()}
              </span>
            )}
          </button>
        </motion.div>

        <button
          onClick={() => nav("/search")}
          className="mt-2.5 w-full flex items-center gap-2 bg-tg-card rounded-xl px-3.5 py-2.5 text-tg-hint active:scale-[0.99] transition"
        >
          <Search size={18} />
          <span className="text-sm">{t.search}</span>
        </button>
      </div>

      {/* ── Category groups ─────────────────────────────────────── */}
      <div className="px-3 pb-4 pt-1">
        {error ? (
          <ErrorState onRetry={load} />
        ) : loading ? (
          <StoreListSkeleton />
        ) : cats.length === 0 ? (
          <p className="text-center text-tg-hint py-16">{t.no_categories}</p>
        ) : (
          <>
            {groups.map((g) => {
              const groupCats = cats.filter((c) => c.group_id === g.id);
              if (groupCats.length === 0) return null;
              return (
                <div key={g.id} className="mb-6">
                  <h2 className="text-lg font-extrabold px-1 mb-3">{loc(g, "name", lang)}</h2>
                  <motion.div
                    variants={container}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-2 gap-3"
                  >
                    {groupCats.map((c, i) => renderCard(c, i))}
                  </motion.div>
                </div>
              );
            })}

            {ungrouped.length > 0 && (
              <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="grid grid-cols-2 gap-3"
              >
                {ungrouped.map((c, i) => renderCard(c, i))}
              </motion.div>
            )}
          </>
        )}
      </div>

      <CartPill />
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd tma && npx tsc -b`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add tma/src/pages/HomePage.tsx
git commit -m "redesign: grouped pastel-card Home layout"
```

---

### Task 15: `tma/src/pages/CartPage.tsx` — redesign

**Files:**
- Modify: `tma/src/pages/CartPage.tsx` (full rewrite)

- [ ] **Step 1: Replace the file**

```tsx
import { Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { loc, useI18n } from "../i18n";
import { money, qtyUnit } from "../lib/format";
import { useCart } from "../store/cart";

export default function CartPage() {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const cart = useCart();
  const lines = Object.values(cart.lines);

  if (lines.length === 0) {
    return (
      <div className="p-10 text-center text-tg-hint">
        <div className="text-5xl mb-3">🛒</div>
        {t.cart_empty}
      </div>
    );
  }

  return (
    <div className="pb-32">
      <h1 className="text-2xl font-bold px-4 pt-4 mb-1">{t.cart}</h1>
      <div className="px-4 divide-y divide-tg-card">
        {lines.map(({ product, quantity }) => (
          <div key={product.id} className="py-3 flex items-center gap-3">
            <div className="h-14 w-14 shrink-0 rounded-xl bg-brand-light flex items-center justify-center overflow-hidden text-2xl">
              {product.image_url ? (
                <img src={product.image_url} alt="" className="h-full w-full object-cover" />
              ) : (
                "🛒"
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium line-clamp-1">{loc(product, "name", lang)}</h3>
                <button
                  onClick={() => cart.setQty(product.id, 0)}
                  className="shrink-0 text-tg-hint active:scale-90 transition"
                >
                  <Trash2 size={17} />
                </button>
              </div>
              <p className="text-sm text-tg-hint">{qtyUnit(quantity, product.unit, lang)}</p>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="font-semibold text-sm">
                  {money(product.price * quantity)} {t.sum}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => cart.setQty(product.id, quantity - 1)}
                    className="w-8 h-8 rounded-full bg-tg-bg border text-lg active:scale-90 transition"
                  >
                    −
                  </button>
                  <span className="w-6 text-center font-semibold">{quantity}</span>
                  <button
                    onClick={() => cart.setQty(product.id, quantity + 1)}
                    className="w-8 h-8 rounded-full bg-brand text-white text-lg active:scale-90 transition"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="fixed bottom-20 left-0 right-0 px-4">
        <div className="bg-slate-900 rounded-2xl pl-5 pr-2 py-2 flex items-center justify-between shadow-lg">
          <div>
            <p className="text-white/60 text-xs">{t.items_label}</p>
            <p className="text-white font-bold text-lg">{money(cart.total())} {t.sum}</p>
          </div>
          <button
            onClick={() => nav("/checkout")}
            className="bg-brand text-white rounded-full px-5 py-2.5 font-semibold text-sm active:scale-95 transition"
          >
            {t.place_order} →
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd tma && npx tsc -b`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add tma/src/pages/CartPage.tsx
git commit -m "redesign: list-row CartPage with sticky checkout bar"
```

---

### Task 16: `tma/src/pages/OfferPage.tsx` — new static page

**Files:**
- Create: `tma/src/pages/OfferPage.tsx`
- Modify: `tma/src/App.tsx`

- [ ] **Step 1: Create the page**

```tsx
import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../i18n";

export default function OfferPage() {
  const nav = useNavigate();
  const { t } = useI18n();

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => nav(-1)}
          className="h-9 w-9 rounded-full bg-tg-card flex items-center justify-center active:scale-95 transition"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-xl font-bold">{t.offer}</h1>
      </div>
      <p className="text-sm text-tg-hint leading-relaxed whitespace-pre-line">{t.offer_text}</p>
    </div>
  );
}
```

- [ ] **Step 2: Add the route**

In `tma/src/App.tsx`, add the import next to `OrdersPage` (currently line 11):

```tsx
import OfferPage from "./pages/OfferPage";
```

Add the route next to `/orders` (currently line 34):

```tsx
            <Route path="/oferta" element={<OfferPage />} />
```

- [ ] **Step 3: Type-check**

Run: `cd tma && npx tsc -b`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add tma/src/pages/OfferPage.tsx tma/src/App.tsx
git commit -m "feat: add static /oferta page"
```

---

### Task 17: `tma/src/pages/ProfilePage.tsx` — full rebuild

**Files:**
- Modify: `tma/src/pages/ProfilePage.tsx` (full rewrite)

- [ ] **Step 1: Replace the file**

```tsx
import {
  Calendar, Check, ChevronRight, FileText, Globe, Headphones,
  MapPin, Phone, Trash2, User as UserIcon, X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { Address } from "../api/types";
import { formatUzPhone } from "../lib/format";
import { useI18n, type Lang } from "../i18n";
import { useAuth } from "../store/auth";

function initials(name?: string | null): string {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

function Row({
  icon, label, value, onClick, showChevron = true,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onClick?: () => void;
  showChevron?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className="w-full flex items-center gap-3 py-3.5 px-4 text-left active:bg-tg-bg/60 transition disabled:active:bg-transparent"
    >
      <span className="text-tg-hint">{icon}</span>
      <span className="flex-1 text-sm font-medium">{label}</span>
      {value && <span className="text-tg-hint text-sm truncate max-w-[45%]">{value}</span>}
      {showChevron && <ChevronRight size={16} className="text-tg-hint shrink-0" />}
    </button>
  );
}

export default function ProfilePage() {
  const { t, lang, setLang } = useI18n();
  const nav = useNavigate();
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [newAddr, setNewAddr] = useState("");
  const [supportPhone, setSupportPhone] = useState<string | null>(null);
  const [open, setOpen] = useState<"address" | "lang" | null>(null);
  const [editField, setEditField] = useState<"name" | "phone" | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => api.addresses().then(setAddresses).catch(() => setAddresses([]));
  useEffect(() => {
    load();
    api.store().then((s) => setSupportPhone(s?.phones?.[0] ?? null)).catch(() => {});
  }, []);

  const addAddress = async () => {
    if (!newAddr.trim()) return;
    await api.createAddress({ label: "Uy", address_line: newAddr });
    setNewAddr("");
    load();
  };

  const startEdit = (field: "name" | "phone") => {
    setEditField(field);
    setDraft(field === "name" ? user?.first_name ?? "" : user?.phone ?? "");
  };

  const saveEdit = async () => {
    if (!editField || saving) return;
    setSaving(true);
    try {
      const patch = editField === "name" ? { first_name: draft.trim() } : { phone: draft.trim() };
      const updated = await api.updateMe(patch);
      setUser(updated);
      setEditField(null);
    } finally {
      setSaving(false);
    }
  };

  const displayName = user?.first_name ?? "—";
  const registeredAt = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(lang === "ru" ? "ru-RU" : "uz-UZ", {
        day: "numeric", month: "long", year: "numeric",
      })
    : "—";

  return (
    <div className="pb-6">
      <div className="px-4 pt-6 pb-5 flex flex-col items-center">
        <div className="h-16 w-16 rounded-full bg-tg-text text-tg-bg flex items-center justify-center text-lg font-bold">
          {initials(user?.first_name)}
        </div>
        <p className="mt-3 font-bold text-lg">{displayName}</p>
        <p className="text-tg-hint text-sm">{user?.phone ? formatUzPhone(user.phone) : "—"}</p>
      </div>

      <div className="mx-3 rounded-2xl bg-tg-card divide-y divide-tg-bg overflow-hidden">
        {editField === "name" ? (
          <div className="flex items-center gap-2 py-2.5 px-4">
            <input
              autoFocus
              className="flex-1 bg-transparent outline-none text-sm"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button onClick={saveEdit} disabled={saving} className="text-brand"><Check size={18} /></button>
            <button onClick={() => setEditField(null)} className="text-tg-hint"><X size={18} /></button>
          </div>
        ) : (
          <Row icon={<UserIcon size={18} />} label={t.profile_name} value={displayName} onClick={() => startEdit("name")} />
        )}

        {editField === "phone" ? (
          <div className="flex items-center gap-2 py-2.5 px-4">
            <input
              autoFocus
              className="flex-1 bg-transparent outline-none text-sm"
              value={draft}
              onChange={(e) => setDraft(formatUzPhone(e.target.value))}
              placeholder="+998 __ ___ __ __"
            />
            <button onClick={saveEdit} disabled={saving} className="text-brand"><Check size={18} /></button>
            <button onClick={() => setEditField(null)} className="text-tg-hint"><X size={18} /></button>
          </div>
        ) : (
          <Row
            icon={<Phone size={18} />}
            label={t.phone}
            value={user?.phone ? formatUzPhone(user.phone) : t.not_entered}
            onClick={() => startEdit("phone")}
          />
        )}

        <Row
          icon={<MapPin size={18} />}
          label={t.address}
          value={addresses[0]?.address_line ?? t.not_entered}
          onClick={() => setOpen(open === "address" ? null : "address")}
        />
        {open === "address" && (
          <div className="px-4 pb-3 space-y-2">
            {addresses.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-2 bg-tg-bg rounded-xl px-3 py-2">
                <span className="text-sm">{a.address_line}</span>
                <button onClick={() => api.deleteAddress(a.id).then(load)} className="text-tg-hint">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                value={newAddr}
                onChange={(e) => setNewAddr(e.target.value)}
                placeholder={t.address_ph}
                className="flex-1 rounded-xl bg-tg-bg px-3 py-2 text-sm outline-none"
              />
              <button onClick={addAddress} className="btn-brand px-4 text-sm">{t.add}</button>
            </div>
          </div>
        )}

        <Row
          icon={<Globe size={18} />}
          label={t.language}
          value={lang === "uz" ? "O'zbekcha" : "Русский"}
          onClick={() => setOpen(open === "lang" ? null : "lang")}
        />
        {open === "lang" && (
          <div className="px-4 pb-3 flex gap-2">
            {(["uz", "ru"] as Lang[]).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`flex-1 py-2 rounded-xl text-sm ${lang === l ? "bg-brand text-white" : "bg-tg-bg"}`}
              >
                {l === "uz" ? "🇺🇿 O'zbek" : "🇷🇺 Русский"}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mx-3 mt-3 rounded-2xl bg-tg-card divide-y divide-tg-bg overflow-hidden">
        <Row
          icon={<Headphones size={18} />}
          label={t.support}
          value={supportPhone ? formatUzPhone(supportPhone) : t.support_soon}
          showChevron={!!supportPhone}
          onClick={supportPhone ? () => { window.location.href = `tel:${supportPhone}`; } : undefined}
        />
        <Row icon={<FileText size={18} />} label={t.offer} onClick={() => nav("/oferta")} />
        <Row icon={<Calendar size={18} />} label={t.registered_at} value={registeredAt} showChevron={false} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd tma && npx tsc -b`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add tma/src/pages/ProfilePage.tsx
git commit -m "redesign: rebuild ProfilePage with editable name/phone, support/offer rows"
```

---

## Final verification

### Task 18: Full-stack smoke check

**Files:** none (verification only)

- [ ] **Step 1: Backend full suite**

Run: `cd backend && pytest -q`
Expected: all pass, no regressions.

- [ ] **Step 2: All three frontends type-check**

Run:
```bash
cd admin && npx tsc -b
cd ../businessman && npx tsc -b
cd ../tma && npx tsc -b
```
Expected: no errors in any of the three.

- [ ] **Step 3: Manual smoke test (tma, in browser or Telegram)**

Per the spec's "Tekshiruv" section — start the dev stack (`docker compose up backend tma` or local dev servers) and, in the tma app:
1. Home: a store with no groups yet renders exactly like before (ungrouped 2-col cards, no header) — confirms the additive migration didn't break existing stores.
2. In admin or businessman, create a group ("Meva va sabzavotlar"), assign an existing top-level category to it via the category edit modal — reload tma Home, confirm the section header + card appear.
3. Cart: add 2+ products, verify quantity stepper, trash icon, and the sticky bottom bar total/"Buyurtma berish →" all work.
4. Profile: edit Ism and Telefon (verify persisted after reload), expand Manzil (add/delete an address), expand Til (switch uz/ru), tap Ommaviy oferta (navigates to `/oferta` and back), confirm Ro'yxatdan o'tgan shows a date.

- [ ] **Step 4: Report results to the user** (no commit — this task is verification only)
