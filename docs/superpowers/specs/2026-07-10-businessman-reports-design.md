# Businessman — Hisobotlar sahifasi

**Sana:** 2026-07-10

## Maqsad
Biznes egasi (businessman panel) uchun chart'li "Hisobotlar" sahifasi: savdo,
foyda, harajat (tannarx), buyurtmalar va mahsulotlar — do'konlar kesimida.

## Qarorlar
- Panel: **businessman**. Mavjud `Umumiy` dashboard tegilmaydi; `Hisobotlar` — alohida sahifa.
- "Harajat" = **tannarx (COGS)** = tushum − foyda. Alohida xarajat jadvali kiritilmaydi.
- Chart'lar **kutubxonasiz** — Tailwind bar/progress + toza SVG donut (admin `ReportsPage` uslubi).

## Backend
Yordamchilar `_agg` / `_series` / `_top_products` (admin.py) `restaurant_id == x`
o'rniga `restaurant_id IN (rids)` qabul qiladi. Admin chaqiruvlari `[rid]` uzatadi.

Yangi `GET /business/reports` → `BusinessReportsOut`:
```
daily/weekly/monthly : PeriodPoint[]    # biznes bo'ylab (30 kun / 12 hafta / 365 kun)
top_products         : TopProduct[]     # biznes bo'ylab top-20
stores               : StoreBreakdown[] # so'nggi 30 kun, do'kon kesimi
```
Sxemalar `PeriodPoint`/`TopProduct` (schemas/admin.py), `StoreBreakdown` (schemas/business.py) qayta ishlatiladi.

## Frontend (businessman/src)
- `pages/ReportsPage.tsx` — davr tab'lari, KPI kartalar, savdo dinamikasi bar-chart,
  **Do'konlar kesimida** (gorizontal bar + ulush donut + jadval), mahsulot reytingi.
- `App.tsx` — `/reports` route. `Layout.tsx` — "Hisobotlar" nav (BarChart3).
- `types.ts` — `PeriodPoint`, `TopProduct`, `BusinessReports`.

## Tekshiruv
`tsc -b` (frontend), backend import/route smoke. Bo'sh biznes (do'konsiz) → bo'sh payload.
