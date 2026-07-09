
## Scope

This spec covers the fourth and largest of four TMA improvements requested in one session. The other three (splash screen, compact cart pill, removing the per-product note input) were small enough to implement directly and are already committed. This document covers only the subcategory feature: `backend/`, `admin/`, and `tma/`.

## Problem

`Category` is currently flat: a top-level category (e.g. "Mevalar va rezavorlar") holds products directly. In practice many products come in variants that should be grouped under a named subcategory (e.g. "Mevalar" → "Olma" → {Olma Mavsumiy, Olma Semerenko, ...}; "Un va don mahsulotlari" → "Guruch" → {rice variants}). There is no way to express this today — every product sits directly under one flat category with no grouping.

## Data model

`Category` gains a self-referential `parent_id`:

- `parent_id IS NULL` → top-level category (shown on the TMA home page, e.g. "Mevalar va rezavorlar").
- `parent_id` set → subcategory (shown as a named section header within its parent's page, e.g. "Olma").
- Exactly two levels are allowed: a category whose `parent_id` already points to a category that itself has a non-null `parent_id` is rejected (no subcategory-of-a-subcategory).
- `Product.category_id` must always reference a subcategory (a category with `parent_id` set) — never a top-level category. Enforced server-side: creating/updating a product with a top-level `category_id` is rejected with 400. This was an explicit choice (confirmed with the user) over allowing products directly under top-level categories, to keep the TMA rendering logic uniform (a top-level category page always renders "list of subcategory sections", never a mixed list of loose products + subcategories).

No data migration/backfill is performed. Existing products keep pointing at their current (top-level) category, which means they stop appearing in TMA until an admin manually creates the appropriate subcategories and reassigns them — this was explicitly chosen by the user over an automatic best-guess migration.

## Backend changes (`backend/`)

### `app/models/catalog.py`
Add to `Category`:
```python
parent_id: Mapped[int | None] = mapped_column(
    ForeignKey("categories.id", ondelete="CASCADE"), index=True, nullable=True
)
parent = relationship("Category", remote_side="Category.id", back_populates="children")
children = relationship("Category", back_populates="parent", cascade="all, delete-orphan")
```
(Deleting a top-level category cascades to its subcategories via `parent_id`'s `ON DELETE CASCADE`, and each subcategory's products cascade via the existing `Product.category_id` `ON DELETE CASCADE` — no new app-level delete logic needed.)

### `app/initdb.py`
Additive migration, following this file's existing idempotent-ALTER convention:
```python
"ALTER TABLE categories ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES categories(id) ON DELETE CASCADE",
```

### `app/schemas/catalog.py`
- `CategoryOut` and `CategoryIn` both gain `parent_id: int | None = None`.
- Replace the nesting shape used by `RestaurantDetail`:
```python
class SubcategoryOut(CategoryOut):
    products: list[ProductOut] = []

class CategoryWithSubcategories(CategoryOut):
    subcategories: list[SubcategoryOut] = []
```
`RestaurantDetail.categories: list[CategoryWithSubcategories]` (was `list[CategoryWithProducts]`; `CategoryWithProducts` is removed — nothing else references it after this change).

### `app/api/routes/catalog.py`
`_build_detail` changes from flat "load each category's products" to two-level: for each top-level category (`parent_id IS NULL`), load its `children` (subcategories) each with their own `products` (available + sorted). Only top-level categories go into `RestaurantDetail.categories`; each carries its `subcategories`, each of which carries its `products`.

### `app/api/routes/admin.py`
- `create_category` / `update_category`: if `data.parent_id` is set, look up that category; if it doesn't exist or its own `parent_id` is not `None`, reject with 400 ("faqat 2 daraja — subkategoriya ichida subkategoriya bo'lmaydi").
- `create_product` / `update_product`: look up `data.category_id`'s category; if `parent_id is None` (top-level), reject with 400 ("Mahsulot faqat subkategoriyaga biriktirilishi mumkin").
- `list_categories` (`GET /admin/restaurants/{rid}/categories`) is unchanged — it already returns every `Category` row flat (now including `parent_id`); the admin frontend builds the tree client-side.

## Admin panel changes (`admin/src/pages/ProductsPage.tsx`)

- **Categories tab**: replace the flat table with a nested view — each top-level category (`parent_id == null`) as a group heading, its subcategories listed underneath (indented), each showing its own product count. Each top-level group gets a "+ Subkategoriya" action that opens the existing category modal with `parent_id` pre-set to that group's id (no parent picker needed in the modal — the entry point already determines it). The existing top "+ Kategoriya qo'shish" button continues to create top-level categories (`parent_id: null`).
- **Product modal**'s "Kategoriya" `<select>`: only lists subcategories (`categories.filter(c => c.parent_id != null)`), grouped with `<optgroup label="{parent name}">` per top-level parent.
- **Products table**'s "Kategoriya" column: show `"{parent name} > {subcategory name}"` instead of just the category name, so it's clear which subcategory a product belongs to.

## TMA changes (`tma/`)

### `src/api/types.ts`
```typescript
export interface Category {
  id: number;
  name_uz: string;
  name_ru: string;
  image_url?: string | null;
  sort_order: number;
  subcategories: Subcategory[];
}

export interface Subcategory {
  id: number;
  name_uz: string;
  name_ru: string;
  image_url?: string | null;
  sort_order: number;
  products: Product[];
}
```
(`Category.products` is removed — replaced by `subcategories`.)

### `src/pages/CategoryPage.tsx`
Currently renders `cat.products` as one flat grid. Changes to render `cat.subcategories`, each as its own section: a bold header (subcategory name) followed by that subcategory's products in the existing 2-column grid. Matches the reference screenshots exactly (e.g. "Banan" header with its one product, "Olma" header with its several variants below it).

### `src/pages/HomePage.tsx` and `src/pages/SearchPage.tsx`
Both compute a flat product list from `store.categories` for counts/search (`c.products.length`, `flatMap(c => c.products)`). Update to go through subcategories: `c.subcategories.flatMap(sc => sc.products)` (and category card's product count becomes the sum across its subcategories).

### Dead code removal
`src/pages/RestaurantPage.tsx` and the `/restaurant/:id` route in `App.tsx` are unreachable today (no in-app link navigates there — confirmed by grep) and directly render `category.products`, which no longer exists on the type. Since fixing an unreachable page is wasted work, delete the page and its route (approved by user). `api/client.ts`'s `restaurant()` and `restaurants()` methods are left as-is (out of scope — not broken by this change, just already-unused surface predating this feature).

## Testing

No automated test infra exists for `backend/`, `admin/`, or `tma/` beyond `courier/`'s vitest suite (unrelated app). Verification is manual:
1. Backend: `python -c "import app.main"` after each file change to catch import/syntax errors; `python -m app.initdb` to confirm the migration runs cleanly.
2. Admin: `npm run build` (tsc + vite) after the `ProductsPage.tsx` rewrite; manually create a top-level category, a subcategory under it, and a product under the subcategory through the UI.
3. TMA: `npm run build` after each changed file; manually browse a category with subcategories and confirm the grouped-header layout renders like the reference screenshots.
