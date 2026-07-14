# tma — Yangi dizayn + "Asosiy category" (kategoriya guruhlari)

**Sana:** 2026-07-14

## Maqsad
tma (Telegram Mini App) ko'rinishini zamonaviy/pastel uslubga o'tkazish (referens
skrinshotlar bo'yicha: Home, Savat, Profil). Shu bilan birga do'kon egasiga
kategoriyalarni bosh sahifada sarlavhali guruhlarga ("Meva va sabzavotlar",
"Sut mahsulotlari" kabi) bo'lish imkonini berish — bu guruhlar faqat vizual
bo'lim sifatida ishlaydi, mahsulot qo'shishda tanlanmaydi.

## Qarorlar
- Yangi jadval **`category_groups`** (id, restaurant_id, name_uz, name_ru,
  sort_order). `Category`ga ixtiyoriy **`group_id`** FK (faqat top-level,
  `parent_id IS NULL` qatorlarda ma'noli).
- To'liq **additive**: mavjud kategoriyalar `group_id = NULL` bilan qoladi —
  hozirgidek "guruhsiz" ko'rinadi, migratsiya xavfsiz, backfill shart emas.
- Muqobil variant (Category'ni o'z-o'ziga 3-qatlamgacha re-parent qilish) rad
  etildi — `_build_detail`, admin selektor, CategoryPage kabi depth-bog'liq
  kodni buzadi va real ma'lumot migratsiyasi talab qiladi.
- Mahsulot `category_id`si hamon faqat subkategoriyani ko'rsatadi — guruh u yerda
  ko'rinmaydi ham, tanlanmaydi ham.
- Kartochka foni: **avtomatik aylanma pastel palitra** (kodda belgilangan 6-8
  rang, indeks bo'yicha), admin panelda rang maydoni yo'q.
- Guruh CRUD: admin va businessman panelning ikkalasida ham (hozirgi kategoriya
  CRUD joylashgan joyda — `ProductsPage.tsx` ichida), chunki ikkalasida ham
  kategoriya boshqaruvi allaqachon dublikat holda mavjud.
- Profil sahifasi **to'liq qayta quriladi** (faqat dizayn emas): Ism/Telefon
  tahrirlanadigan bo'ladi, Qo'llab-quvvatlash va Ommaviy oferta qatorlari, ro'yxatdan
  o'tgan sana qo'shiladi. Manzil — mavjud multi-address funksiyasi saqlanadi (qator
  bosilsa ro'yxat ochiladi), mockup'dagi bitta-manzil ko'rinishiga soddalashtirilmaydi.
- Qo'llab-quvvatlash qatori: do'konning `phones[0]` bo'lsa `tel:` havola, bo'lmasa
  statik "Tez orada" matni — alohida support-CMS kiritilmaydi.
- Ommaviy oferta: statik matn (i18n ichida uz/ru), backend/CMS shart emas.
- CategoryPage (subkategoriya/mahsulot ro'yxati sahifasi) — **o'zgarmaydi**.

## Backend
- `backend/app/models/restaurant.py`: `CategoryGroup` model; `Category.group_id`
  (nullable FK → `category_groups.id`, `ondelete="SET NULL"`).
- `backend/app/schemas/catalog.py`: `CategoryGroupOut`/`CategoryGroupIn`;
  `CategoryOut`/`CategoryIn`ga `group_id`; `RestaurantDetail`ga
  `category_groups: list[CategoryGroupOut]`.
- `backend/app/api/routes/catalog.py`: `_build_detail` `category_groups`ni ham
  qaytaradi (restaurant bo'yicha, sort_order tartibida).
- Admin/business category CRUD routerlarida (`admin.py`/`business.py`):
  `/admin/category-groups` va `/business/category-groups` — GET/POST/PUT/DELETE
  (mavjud category CRUD pattern bo'yicha, restaurant-scoped).
- `backend/app/schemas/auth.py`: `UserOut`ga `created_at: datetime`.
- `backend/app/api/routes/auth.py`: yangi `PATCH /auth/me` — `first_name`,
  `phone` yangilash (`UserUpdateIn` schema, ikkalasi ham ixtiyoriy).

## Frontend — admin & businessman (`ProductsPage.tsx`, ikkalasida bir xil)
- "Guruhlar" mini-boshqaruvi (qo'shish/tahrirlash/o'chirish, faqat nom+tartib).
- Top-kategoriya tahrirlash modalida "Guruh" dropdown (ixtiyoriy, default
  "Guruhsiz").
- `types.ts`ga `CategoryGroup` turi, `Category.group_id`.

## Frontend — tma
- **HomePage**: `store.category_groups` bo'yicha guruhlash (client-side,
  `categories[].group_id` orqali) — har guruh: qalin sarlavha + 2 ustunli grid;
  guruhsiz kategoriyalar oxirida sarlavhasiz xuddi shu grid uslubida. Kartochka:
  pastel fon (aylanma palitra), rasm `object-contain`, matn tepada quyuq rangda —
  hozirgi to'liq-kenglik dark-overlay kartochka o'rniga.
- **CartPage**: qatorlar orasida nozik chiziq (alohida "card" shell o'rniga),
  qator o'ng-yuqorisida chelak ikonkasi, pastda sticky bar — "Mahsulotlar" +
  jami narx (katta) + qorong'i pill tugma "Buyurtma berish →".
- **ProfilePage**: doira avatar (bosh harflar), tepada ism+telefon; qator-ro'yxat:
  Ism (tahrir), Telefon (tahrir), Manzil (mavjud ro'yxat, pastga ochiladi/subsahifa),
  Til (mavjud toggle, endi qator-chevron uslubida), Qo'llab-quvvatlash, Ommaviy
  oferta, Ro'yxatdan o'tgan (sana, `user.created_at`).
- `api/client.ts`: `updateMe(data)` → `PATCH /auth/me`.
- `api/types.ts`: `User.created_at`, `RestaurantDetail.category_groups`,
  `Category.group_id`.
- `i18n.ts`: yangi kalitlar (support, oferta matni, "Ro'yxatdan o'tgan" va h.k.,
  uz+ru).

## Tekshiruv
- Backend: import/route smoke (`category-groups` CRUD, `PATCH /auth/me`),
  mavjud restoran (guruhsiz kategoriyalar) uchun `/restaurants/nearest` va
  `/restaurants/default` javobi buzilmasligini tekshirish.
- Frontend: `tsc -b` (tma, admin, businessman). tma'da browser orqali: Home
  (guruhli+guruhsiz aralash holat), Savat, Profil (ism/telefon tahrir, til
  almashtirish, manzil pastga ochilishi) qo'lda sinaladi.
