# TMA Subcategories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `Category` a self-referential `parent_id` so a top-level category (e.g. "Mevalar va rezavorlar") can hold named subcategories (e.g. "Olma", "Banan"), each of which holds products. Admin gets a nested category UI to create/manage subcategories; TMA renders each top-level category page as grouped subcategory sections instead of one flat product grid.

**Architecture:** Two-level hierarchy only (`parent_id IS NULL` = top-level, `parent_id` set = subcategory; subcategory-of-a-subcategory rejected server-side). `Product.category_id` must always point at a subcategory — never a top-level category — enforced with a 400 on create/update. No data migration/backfill: existing products keep pointing at their current (top-level) category and simply stop appearing in TMA until an admin creates subcategories and reassigns them (explicit user choice, see spec).

**Tech Stack:** FastAPI + SQLAlchemy 2.0 + Pydantic (backend), React + TS + Vite (admin, tma).

**Full design spec:** `docs/superpowers/specs/2026-07-01-tma-subcategories-design.md` (this repo) — read it first if anything below is ambiguous.

**Repos involved (each is its own git repo, checked out as a sibling directory):**
- `/Users/user/Desktop/All Foods/backend` — data model, API
- `/Users/user/Desktop/All Foods/admin` — admin panel UI
- `/Users/user/Desktop/All Foods/tma` — customer Telegram Mini App

Do the tasks in order — backend (1-5), then admin (6-7), then tma (8-12). Each task's working directory is called out explicitly since these are three separate repos.

---

### Task 1: Backend — `Category.parent_id` model field

**Files:**
- Modify: `backend/app/models/restaurant.py:39-50`

- [ ] **Step 1: Add the field and self-referential relationships**

Replace the `Category` class body:

```python
class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    restaurant_id: Mapped[int] = mapped_column(ForeignKey("restaurants.id", ondelete="CASCADE"), index=True)
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id", ondelete="CASCADE"), index=True
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

- [ ] **Step 2: Verify it imports cleanly**

Run (from `backend/`): `python -c "import app.models"`
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
cd "/Users/user/Desktop/All Foods/backend"
git add app/models/restaurant.py
git commit -m "feat(catalog): add Category.parent_id self-reference for subcategories"
```

---

### Task 2: Backend — DB migration

**Files:**
- Modify: `backend/app/initdb.py:21-23`

- [ ] **Step 1: Add the idempotent ALTER to `_CATEGORY_COLUMNS`**

```python
# Kategoriyalarga rasm (kartochka foni) + subkategoriya uchun parent_id — idempotent.
_CATEGORY_COLUMNS = (
    "ALTER TABLE categories ADD COLUMN IF NOT EXISTS image_url VARCHAR(512)",
    "ALTER TABLE categories ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES categories(id) ON DELETE CASCADE",
)
```

- [ ] **Step 2: Verify the migration runs cleanly**

Run (from `backend/`, needs `DATABASE_URL`/Postgres reachable — use the local docker Postgres): `python -m app.initdb`
Expected: prints `Tables created / verified.` with no errors. If no local DB is reachable, at minimum run `python -c "import app.initdb"` to confirm it imports.

- [ ] **Step 3: Commit**

```bash
cd "/Users/user/Desktop/All Foods/backend"
git add app/initdb.py
git commit -m "feat(catalog): migrate categories.parent_id column"
```

---

### Task 3: Backend — schemas

**Files:**
- Modify: `backend/app/schemas/catalog.py`

- [ ] **Step 1: Add `parent_id` to `CategoryOut`/`CategoryIn`, replace the nesting shape**

Replace lines 24-37 (`CategoryOut` through `CategoryWithProducts`):

```python
class CategoryOut(BaseModel):
    id: int
    parent_id: int | None = None
    name_uz: str
    name_ru: str
    image_url: str | None = None
    sort_order: int

    class Config:
        from_attributes = True


class SubcategoryOut(CategoryOut):
    products: list[ProductOut] = []


class CategoryWithSubcategories(CategoryOut):
    subcategories: list[SubcategoryOut] = []
```

Replace line 79 (`RestaurantDetail.categories`):

```python
class RestaurantDetail(RestaurantOut):
    categories: list[CategoryWithSubcategories] = []
```

Replace `CategoryIn` (lines 96-101):

```python
class CategoryIn(BaseModel):
    restaurant_id: int
    parent_id: int | None = None
    name_uz: str
    name_ru: str
    image_url: str | None = None
    sort_order: int = 0
```

- [ ] **Step 2: Verify**

Run (from `backend/`): `python -c "import app.schemas.catalog"`
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
cd "/Users/user/Desktop/All Foods/backend"
git add app/schemas/catalog.py
git commit -m "feat(catalog): CategoryOut/In gain parent_id, add Subcategory nesting schema"
```

---

### Task 4: Backend — catalog route builds two-level tree

**Files:**
- Modify: `backend/app/api/routes/catalog.py`

- [ ] **Step 1: Rewrite `_build_detail` to nest by parent, then children, then products**

Replace the whole file's import block and `_build_detail`:

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.db import get_db
from app.models import Category, Product, Restaurant
from app.schemas.catalog import (
    CategoryWithSubcategories,
    ProductOut,
    RestaurantDetail,
    RestaurantOut,
    SubcategoryOut,
)

router = APIRouter(prefix="/restaurants", tags=["catalog"])


@router.get("", response_model=list[RestaurantOut])
def list_restaurants(db: Session = Depends(get_db), q: str | None = None):
    stmt = select(Restaurant).where(Restaurant.is_active.is_(True)).order_by(Restaurant.rating.desc())
    if q:
        stmt = stmt.where(Restaurant.name.ilike(f"%{q}%"))
    return db.scalars(stmt).all()


def _build_detail(restaurant: Restaurant, db: Session) -> RestaurantDetail:
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
    return detail


# Yagona do'kon — admin default_store bilan bir xil (eng kichik id).
# Param route (/{restaurant_id}) dan OLDIN turishi shart.
@router.get("/default", response_model=RestaurantDetail)
def get_default_store(db: Session = Depends(get_db)):
    restaurant = db.scalar(
        select(Restaurant).where(Restaurant.is_active.is_(True)).order_by(Restaurant.id).limit(1)
    )
    if not restaurant:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No store")
    return _build_detail(restaurant, db)


@router.get("/{restaurant_id}", response_model=RestaurantDetail)
def get_restaurant(restaurant_id: int, db: Session = Depends(get_db)):
    restaurant = db.get(Restaurant, restaurant_id)
    if not restaurant or not restaurant.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Restaurant not found")
    return _build_detail(restaurant, db)
```

- [ ] **Step 2: Verify**

Run (from `backend/`): `python -c "import app.main"`
Expected: no output, exit code 0 (this imports the whole route tree, catching wiring errors that a single-module import misses).

- [ ] **Step 3: Commit**

```bash
cd "/Users/user/Desktop/All Foods/backend"
git add app/api/routes/catalog.py
git commit -m "feat(catalog): render category tree as top-level > subcategory > products"
```

---

### Task 5: Backend — admin route validation

**Files:**
- Modify: `backend/app/api/routes/admin.py:254-317` (category/product create/update)

- [ ] **Step 1: Reject subcategory-of-a-subcategory in `create_category`/`update_category`**

Replace `create_category` and `update_category`:

```python
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
def create_category(data: CategoryIn, db: Session = Depends(get_db)):
    _check_parent(db, data.parent_id, data.restaurant_id)
    c = Category(**data.model_dump())
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.put("/categories/{cid}", response_model=CategoryOut)
def update_category(cid: int, data: CategoryIn, db: Session = Depends(get_db)):
    c = db.get(Category, cid)
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    _check_parent(db, data.parent_id, data.restaurant_id)
    for k, v in data.model_dump().items():
        setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return c
```

Place `_check_parent` directly above `create_category`, replacing the existing `create_category`/`update_category` pair — do not touch `list_categories` or `delete_category` above/below them.

`_check_parent` now also rejects a `parent_id` pointing at a category belonging to a *different* restaurant (`parent.restaurant_id != restaurant_id`) — this closes a cross-restaurant data leak the Task 4 code reviewer flagged: without it, a misconfigured `parent_id` could make one restaurant's subcategory render under another restaurant's storefront page, since the customer-facing query (`app/api/routes/catalog.py`, Task 4) loads `children` purely by FK membership with no restaurant re-check at that level.

- [ ] **Step 2: Reject products attached to a top-level category in `create_product`/`update_product`**

Replace `create_product` and `update_product`:

```python
def _check_subcategory(db: Session, category_id: int) -> None:
    category = db.get(Category, category_id)
    if not category or category.parent_id is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Mahsulot faqat subkategoriyaga biriktirilishi mumkin",
        )


@router.post("/products", response_model=ProductOut, status_code=201)
def create_product(data: ProductIn, db: Session = Depends(get_db)):
    _check_subcategory(db, data.category_id)
    p = Product(**data.model_dump())
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.put("/products/{pid}", response_model=ProductOut)
def update_product(pid: int, data: ProductIn, db: Session = Depends(get_db)):
    p = db.get(Product, pid)
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    _check_subcategory(db, data.category_id)
    for k, v in data.model_dump().items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return p
```

Place `_check_subcategory` directly above `create_product`. `list_categories`, `delete_category`, `list_products`, `delete_product`, and everything else in the file stays as-is.

- [ ] **Step 3: Verify**

Run (from `backend/`): `python -c "import app.main"`
Expected: no output, exit code 0.

- [ ] **Step 4: Commit**

```bash
cd "/Users/user/Desktop/All Foods/backend"
git add app/api/routes/admin.py
git commit -m "feat(catalog): validate 2-level category depth and subcategory-only products"
```

---

### Task 6: Admin — `Category` type gains `parent_id`

**Files:**
- Modify: `admin/src/types.ts:20-26`

- [ ] **Step 1: Add the field**

```typescript
export interface Category {
  id: number;
  parent_id?: number | null;
  name_uz: string;
  name_ru: string;
  image_url?: string | null;
  sort_order: number;
}
```

- [ ] **Step 2: Commit**

```bash
cd "/Users/user/Desktop/All Foods/admin"
git add src/types.ts
git commit -m "feat(catalog): Category type gains parent_id"
```

(No standalone build check here — Task 7 touches the only consumer and is verified together.)

---

### Task 7: Admin — nested categories UI, grouped product select, category path column

**Files:**
- Modify: `admin/src/pages/ProductsPage.tsx`

- [ ] **Step 1: Add `topCategories`/`subcategories` derived lists and a `catPath` helper**

Replace the `catName`/`margin` line (currently line 160-161):

```typescript
  const topCategories = categories.filter((c) => c.parent_id == null);
  const subcategories = categories.filter((c) => c.parent_id != null);
  const catPath = (id: number) => {
    const c = categories.find((x) => x.id === id);
    if (!c) return "—";
    const parent = categories.find((x) => x.id === c.parent_id);
    return parent ? `${parent.name_uz} > ${c.name_uz}` : c.name_uz;
  };
  const margin = (p: Product) => (p.price > 0 ? Math.round(((p.price - p.cost) / p.price) * 100) : 0);
```

- [ ] **Step 2: Product creation button — default/require a subcategory, not any category**

Replace the products-tab "add" button (lines 182-191):

```tsx
          <div className="flex justify-end mb-4">
            <button
              className="btn"
              disabled={subcategories.length === 0}
              title={subcategories.length === 0 ? "Avval subkategoriya qo'shing" : ""}
              onClick={() => setEditing({ category_id: subcategories[0]?.id, is_available: true, price: 0, cost: 0, stock: 0, unit: "dona", low_stock_threshold: 10 })}
            >
              <Plus size={18} /> Mahsulot qo'shish
            </button>
          </div>
```

- [ ] **Step 3: Products table — show full path, and fix the empty-state hint**

Replace `<td className="td">{catName(p.category_id)}</td>` (line 218) with:

```tsx
                    <td className="td">{catPath(p.category_id)}</td>
```

Replace the empty-state row (lines 241-245):

```tsx
                {products.length === 0 && (
                  <tr><td colSpan={7} className="td text-center text-slate-400 py-10">
                    {subcategories.length === 0 ? "Avval subkategoriya qo'shing" : "Mahsulot yo'q"}
                  </td></tr>
                )}
```

- [ ] **Step 4: Categories tab — nested groups instead of a flat table**

Replace the entire `{/* ── CATEGORIES ───────────────────────────────────── */}` block (lines 253-300):

```tsx
      {/* ── CATEGORIES ───────────────────────────────────── */}
      {tab === "categories" && (
        <>
          <div className="flex justify-end mb-4">
            <button className="btn" onClick={() => setEditCat({})}><Plus size={18} /> Kategoriya qo'shish</button>
          </div>

          {err ? <ErrorRetry onRetry={reload} /> : loading ? <TableSkeleton cols={3} /> : (
          <div className="space-y-4">
            {topCategories.map((top) => {
              const children = categories.filter((c) => c.parent_id === top.id);
              return (
              <div key={top.id} className="card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    {top.image_url
                      ? <img src={top.image_url} alt="" className="h-9 w-12 rounded-lg object-cover bg-slate-100" />
                      : <span className="h-9 w-12 rounded-lg bg-slate-100" />}
                    <div>
                      <div className="font-semibold text-slate-900">{top.name_uz}</div>
                      <div className="text-xs text-slate-400">{top.name_ru}</div>
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-1">
                    <button className="icon-btn" title="Tahrirlash" onClick={() => setEditCat(top)}><Pencil size={16} /></button>
                    <button className="icon-btn hover:text-red-600" title="O'chirish" onClick={() => removeCat(top)}><Trash2 size={16} /></button>
                    <button className="btn-ghost text-xs" onClick={() => setEditCat({ parent_id: top.id })}>
                      <Plus size={14} /> Subkategoriya
                    </button>
                  </div>
                </div>
                {children.length === 0 ? (
                  <div className="px-4 py-6 text-center text-slate-400 text-sm">Subkategoriya yo'q</div>
                ) : (
                  <table className="w-full">
                    <tbody>
                      {children.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50/60">
                          <td className="td pl-8 font-medium text-slate-900">
                            <div className="flex items-center gap-3">
                              {c.image_url
                                ? <img src={c.image_url} alt="" className="h-9 w-12 rounded-lg object-cover bg-slate-100" />
                                : <span className="h-9 w-12 rounded-lg bg-slate-100" />}
                              {c.name_uz}
                            </div>
                          </td>
                          <td className="td">{c.name_ru}</td>
                          <td className="td">{products.filter((p) => p.category_id === c.id).length}</td>
                          <td className="td text-right">
                            <div className="inline-flex items-center gap-1">
                              <button className="icon-btn" title="Tahrirlash" onClick={() => setEditCat(c)}><Pencil size={16} /></button>
                              <button className="icon-btn hover:text-red-600" title="O'chirish" onClick={() => removeCat(c)}><Trash2 size={16} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              );
            })}
            {topCategories.length === 0 && (
              <div className="card p-10 text-center text-slate-400">Kategoriya yo'q — "Qo'shish" bilan qo'shing</div>
            )}
          </div>
          )}
        </>
      )}
```

- [ ] **Step 5: `saveCat` must send `parent_id`**

Replace the `body` object inside `saveCat` (lines 119-125):

```typescript
      const body = {
        restaurant_id: storeId,
        parent_id: editCat.parent_id ?? null,
        name_uz: editCat.name_uz,
        name_ru: editCat.name_ru || editCat.name_uz,
        image_url: editCat.image_url ?? null,
        sort_order: editCat.sort_order ?? categories.length,
      };
```

- [ ] **Step 6: Category modal title — distinguish top-level vs subcategory**

Replace the modal header (line 439):

```tsx
              <h2 className="font-bold text-xl">
                {editCat.id ? "Kategoriyani tahrirlash" : editCat.parent_id ? "Yangi subkategoriya" : "Yangi kategoriya"}
              </h2>
```

- [ ] **Step 7: Product modal's category `<select>` — group by parent, subcategories only**

Replace the "Kategoriya" block in the product modal (lines 313-319):

```tsx
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Kategoriya</label>
                <select className="input" value={editing.category_id}
                  onChange={(e) => setEditing({ ...editing, category_id: +e.target.value })}>
                  {topCategories.map((top) => (
                    <optgroup key={top.id} label={top.name_uz}>
                      {categories.filter((c) => c.parent_id === top.id).map((c) => (
                        <option key={c.id} value={c.id}>{c.name_uz}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
```

- [ ] **Step 8: Build check**

Run (from `admin/`): `npx tsc --noEmit -p .`
Expected: exit code 0, no errors.

- [ ] **Step 9: Commit**

```bash
cd "/Users/user/Desktop/All Foods/admin"
git add src/pages/ProductsPage.tsx
git commit -m "feat(catalog): nested category management, subcategory-only product assignment"
```

- [ ] **Step 10: Manual check**

`npm run dev`, open Mahsulotlar → Kategoriyalar tab: create a top-level category, click "+ Subkategoriya" on it, create a subcategory, then switch to Mahsulotlar tab and confirm the product's category `<select>` only lists that subcategory (grouped under the top-level name) and the table shows `Top > Sub`.

---

### Task 8: TMA — `Category`/`Subcategory` types

**Files:**
- Modify: `tma/src/api/types.ts:15-22`

- [ ] **Step 1: Replace the flat `Category` with the nested shape**

```typescript
export interface Subcategory {
  id: number;
  name_uz: string;
  name_ru: string;
  image_url?: string | null;
  sort_order: number;
  products: Product[];
}

export interface Category {
  id: number;
  name_uz: string;
  name_ru: string;
  image_url?: string | null;
  sort_order: number;
  subcategories: Subcategory[];
}
```

(`Subcategory` must be declared above `Category` since nothing here forward-references, but declare it right before `Category`, after `Product`.)

- [ ] **Step 2: Commit**

```bash
cd "/Users/user/Desktop/All Foods/tma"
git add src/api/types.ts
git commit -m "feat(catalog): Category type nests Subcategory instead of flat products"
```

(Build check deferred to Task 12, after all consumers are updated — `tsc` will correctly fail on Tasks 9-11's untouched files until then, which is expected mid-refactor.)

---

### Task 9: TMA — `CategoryPage.tsx` renders subcategory sections

**Files:**
- Modify: `tma/src/pages/CategoryPage.tsx`

- [ ] **Step 1: Replace the flat product grid with per-subcategory sections**

Replace the `{/* ── Products grid ── */}` block (lines 90-164):

```tsx
      {/* ── Subcategory sections ──────────────────────────────── */}
      <div className="px-4 py-4 pb-28">
        {(() => {
          const sections = (cat?.subcategories ?? []).filter((sc) => sc.products.length > 0);
          if (sections.length === 0) {
            return <p className="text-center text-tg-hint py-16">{t.empty_category}</p>;
          }
          return sections.map((sc) => (
            <div key={sc.id} className="mb-6 last:mb-0">
              <h2 className="font-bold text-lg mb-3">{loc(sc, "name", lang)}</h2>
              <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="grid grid-cols-2 gap-3"
              >
                {sc.products.map((p) => (
                  <motion.div key={p.id} variants={item} className="card flex flex-col">
                    <div className="h-28 bg-brand-light flex items-center justify-center text-3xl">
                      {p.image_url ? (
                        <img src={p.image_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        "🛒"
                      )}
                    </div>
                    <div className="p-3 flex flex-col flex-1">
                      <h3 className="font-medium text-sm leading-tight line-clamp-2">
                        {loc(p, "name", lang)}
                      </h3>
                      <div className="mt-auto pt-2 flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm">
                          {money(p.price)} {t.sum}
                          {p.unit ? <span className="text-tg-hint font-normal">/{unitLabel(p.unit, lang)}</span> : null}
                        </span>
                        <AnimatePresence mode="wait" initial={false}>
                          {qtyOf(p) === 0 ? (
                            <motion.button
                              key="add"
                              initial={{ scale: 0.6, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0.6, opacity: 0 }}
                              whileTap={{ scale: 0.85 }}
                              onClick={() => add(p)}
                              className="h-8 w-8 shrink-0 rounded-full bg-brand text-white flex items-center justify-center shadow-sm"
                            >
                              <Plus size={18} />
                            </motion.button>
                          ) : (
                            <motion.div
                              key="step"
                              initial={{ scale: 0.6, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0.6, opacity: 0 }}
                              className="flex items-center gap-1 shrink-0 rounded-full bg-brand-light"
                            >
                              <button
                                onClick={() => dec(p)}
                                className="h-8 w-8 rounded-full text-brand flex items-center justify-center active:scale-90 transition"
                              >
                                <Minus size={16} />
                              </button>
                              <span className="min-w-[1.25rem] text-center text-sm font-bold text-brand">
                                {qtyOf(p)}
                              </span>
                              <button
                                onClick={() => add(p)}
                                className="h-8 w-8 rounded-full bg-brand text-white flex items-center justify-center active:scale-90 transition shadow-sm"
                              >
                                <Plus size={16} />
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          ));
        })()}
      </div>
```

- [ ] **Step 2: Commit**

```bash
cd "/Users/user/Desktop/All Foods/tma"
git add src/pages/CategoryPage.tsx
git commit -m "feat(catalog): render category page as subcategory sections"
```

---

### Task 10: TMA — `HomePage.tsx` product count via subcategories

**Files:**
- Modify: `tma/src/pages/HomePage.tsx`

- [ ] **Step 1: Add a `productCount` helper and use it**

Add above the `open` function (around line 63):

```typescript
  const productCount = (c: Category) =>
    c.subcategories.reduce((sum, sc) => sum + sc.products.length, 0);
```

Replace the count badge (lines 135-139):

```tsx
                  {productCount(c) > 0 && (
                    <span className="absolute top-3 left-3 rounded-full bg-white/20 backdrop-blur-md text-white text-xs font-semibold px-2.5 py-1">
                      {productCount(c)} {t.products_n}
                    </span>
                  )}
```

- [ ] **Step 2: Commit**

```bash
cd "/Users/user/Desktop/All Foods/tma"
git add src/pages/HomePage.tsx
git commit -m "feat(catalog): category card product count sums across subcategories"
```

---

### Task 11: TMA — `SearchPage.tsx` flattens through subcategories

**Files:**
- Modify: `tma/src/pages/SearchPage.tsx:32-35`

- [ ] **Step 1: Update the flat product list**

```typescript
  const all: Product[] = useMemo(
    () => (store?.categories ?? []).flatMap((c) => c.subcategories.flatMap((sc) => sc.products)),
    [store],
  );
```

- [ ] **Step 2: Commit**

```bash
cd "/Users/user/Desktop/All Foods/tma"
git add src/pages/SearchPage.tsx
git commit -m "feat(catalog): search flattens products through subcategories"
```

---

### Task 12: TMA — delete unreachable `RestaurantPage`, verify build

**Files:**
- Delete: `tma/src/pages/RestaurantPage.tsx`
- Modify: `tma/src/App.tsx:13,33`

- [ ] **Step 1: Remove the route and import**

In `App.tsx`, delete line 13 (`import RestaurantPage from "./pages/RestaurantPage";`) and line 33 (`<Route path="/restaurant/:id" element={<RestaurantPage />} />`).

- [ ] **Step 2: Delete the page file**

```bash
cd "/Users/user/Desktop/All Foods/tma"
rm src/pages/RestaurantPage.tsx
```

- [ ] **Step 3: Build check — this is the real verification for the whole tma refactor (Tasks 8-12)**

Run (from `tma/`): `npx tsc --noEmit -p . && npx vite build`
Expected: exit code 0, no type errors (this is the point where `Category.products` removal in Task 8 finally has zero remaining references — if it fails, grep the error output for the offending file and fix it before continuing).

- [ ] **Step 4: Commit**

```bash
cd "/Users/user/Desktop/All Foods/tma"
git add -A
git commit -m "chore(catalog): drop unreachable RestaurantPage (unused since nav never links to it)"
```

- [ ] **Step 5: Manual check**

`npm run dev`, open the TMA: home page category cards show correct counts, opening a category with subcategories shows grouped sections matching the design spec's reference screenshots, search still returns products.

---

## Post-implementation note

No data migration is performed (by design, see spec). Immediately after deploying, every existing product will disappear from the TMA home/category/search pages because its `category_id` still points at a top-level category, which the storefront query (Task 4) no longer walks into directly. This is expected — the very next step after this plan ships is: log into the admin panel, create subcategories under each existing top-level category, and re-save each product with the new subcategory. Flag this to the user before deploying so it isn't mistaken for a bug.
