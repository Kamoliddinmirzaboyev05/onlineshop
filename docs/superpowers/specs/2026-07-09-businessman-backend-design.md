# Businessman backend (sub-loyiha 2a) — design

## Context

[Faza 1a](2026-07-09-multi-tenant-foundation-design.md) tugadi: `businesses` va `platform_admins` jadvallari, `restaurants.business_id`, `admin_users.restaurant_id` (NOT NULL), hamda `/business/auth/login` va `/platform/auth/login` endpointlari mavjud. Businessman login qila oladi va `/business/auth/me` orqali o'zini biladi — lekin boshqa hech narsa qila olmaydi.

Bu sub-loyiha businessman'ga **o'z do'konlarini boshqarish** imkonini beruvchi backendni quradi. Frontend (React+TS PWA) — alohida sub-loyiha 2b.

**Asosiy qaror (foydalanuvchi tasdiqlagan):** businessman uchun parallel endpoint to'plami yozilmaydi. Mavjud `/admin/*` endpointlari qayta ishlatiladi, ular `restaurant_id` bo'yicha cheklanadi va businessman tokeni ham ularga kira oladi (faqat o'ziga tegishli do'konlar bilan). Bu bir vaqtning o'zida Faza 1b (scoping xavfsizlik tuzatuvi) ishini ham bajaradi.

## Bugungi holat — qaysi modellarda `restaurant_id` bor

| Model | `restaurant_id` | Izoh |
|---|---|---|
| `Order` | bor | to'g'ridan-to'g'ri cheklanadi |
| `Category`, `Product` | bor | to'g'ridan-to'g'ri |
| `AdminUser` | bor (Faza 1a) | to'g'ridan-to'g'ri |
| `OrderItem` | yo'q | `Order` orqali |
| `SupplyRecord` | yo'q | `Product` orqali |
| `DeliveryZone` | **yo'q** | global — quyida hal qilinadi |
| `Courier` | **yo'q** | global — quyida hal qilinadi |
| `User` | yo'q | platforma darajasidagi bot foydalanuvchisi, do'konga tegishli emas |
| `Announcement` | yo'q | platforma darajasida tarqatiladi |
| `PushSubscription` | yo'q | `admin_user_id` orqali bog'langan |

### Cross-tenant xavfsizlik: `DeliveryZone` va `Courier`

Ikkalasi ham hozir bitta global yozuv. Bitta biznes bo'lganda bu bilinmaydi, lekin ikkinchi tadbirkor qo'shilishi bilanoq A biznesning xodimi tahrirlagan yetkazish zonasi B biznesning do'konlariga ham ta'sir qiladi, va kuryerlar ro'yxatini hamma ko'radi. Bu tenant izolyatsiyasining buzilishi, "keyinroq" qoldirib bo'lmaydi.

Shuning uchun bu sub-loyihada ikkalasiga ham `restaurant_id` (NOT NULL, `ondelete="CASCADE"`) qo'shiladi, aynan `admin_users.restaurant_id` bilan bir xil naqsh bo'yicha (ORM ustuni + `initdb.py`da idempotent `ADD COLUMN IF NOT EXISTS` + backfill + `SET NOT NULL`, retrofit SQL'da `ON DELETE CASCADE` bilan).

`Courier` modeli (`app/models/order.py`) `AdminUser(role=courier)` dan alohida ekanini eslatib o'tamiz — ikkita turli "kuryer" tushunchasi mavjud (biri buyurtmaga biriktiriladigan yozuv, ikkinchisi login qiladigan akkaunt). Bu chalkashlik shu sub-loyihada tuzatilmaydi (alohida ish), ikkalasi ham shunchaki `restaurant_id` oladi.

## Auth: bitta endpoint, ikki xil principal

Yangi dependency `app/api/deps.py`da:

```python
def get_current_staff_or_business(...) -> AdminUser | Business:
    """Tokendan rolga qarab AdminUser (superadmin/manager) yoki Business qaytaradi.
    Kuryer (AdminRole.courier) bu yerga kira olmaydi — unda alohida /courier router bor."""
```

va scope'ni hal qiluvchi dependency:

```python
def current_restaurant(
    restaurant_id: int | None = None,     # query param — faqat businessman uchun
    principal: AdminUser | Business = Depends(get_current_staff_or_business),
    db: Session = Depends(get_db),
) -> Restaurant:
    """Amal qilinayotgan do'konni aniqlaydi va egalikni tekshiradi.

    - AdminUser (do'kon xodimi): har doim o'z `admin.restaurant_id`si. Query param
      berilsa ham e'tiborga olinmaydi (xodim boshqa do'konni so'ray olmaydi).
    - Business (tadbirkor): `restaurant_id` query param MAJBURIY. Do'kon
      `business_id == business.id` bo'lishi shart, aks holda 403.
    """
```

Bu `admin.py`dagi mavjud `default_store(db)` funksiyasining o'rnini bosadi (u "birinchi topilgan restoran"ni qaytarardi — ko'p do'konli dunyoda noto'g'ri).

## `/admin/*` endpointlarining yangi holati

Har biri `Depends(current_restaurant)` orqali cheklanadi. Kim kira olishi:

| Endpoint | Do'kon xodimi | Businessman | Izoh |
|---|---|---|---|
| `GET/PUT /store` | ✅ | ✅ | scope'dagi do'kon |
| `GET /stats`, `GET /reports` | ✅ | ✅ | scope bo'yicha agregatsiya |
| `GET /delivery-stats` | ✅ | ✅ | scope |
| `GET /restaurants/{rid}/categories`, `.../products` | ✅ | ✅ | `rid` scope'ga mos kelishi tekshiriladi |
| `POST/PUT/DELETE /categories`, `/products` | ✅ | ✅ | `restaurant_id` scope'dan olinadi, body'dan emas |
| `PATCH /products/{pid}/stock` | ✅ | ✅ | mahsulotning do'koni scope'da ekani tekshiriladi |
| `GET /orders`, `PATCH /orders/{id}` | ✅ | ✅ | scope |
| `GET/POST/DELETE /supplies` | ✅ | ✅ | `Product` orqali scope |
| `GET /notifications` | ✅ | ✅ | scope'dagi buyurtmalar |
| `GET /users` | ✅ | ✅ | **o'zgaradi**: faqat scope'dagi do'kondan buyurtma bergan mijozlar |
| `GET/POST/PATCH/DELETE /admin-users` | ✅ (superadmin) | ✅ | scope'dagi xodimlar |
| `GET/PUT /delivery-zone` | ✅ | ❌ | scope (yangi `restaurant_id`) |
| `GET/POST/PUT/DELETE /couriers` | ✅ | ❌ | scope (yangi `restaurant_id`) |
| `GET /courier-accounts` | ✅ | ❌ | scope |
| `POST /push/*` | ✅ | ❌ | `admin_user_id`ga bog'langan |
| `PATCH /users/{uid}/block`, `DELETE /users/{uid}` | ❌ | ❌ | **ko'chiriladi** → platform superadmin |
| `GET/POST /announcements`, `/resend` | ❌ | ❌ | **ko'chiriladi** → platform superadmin |
| `POST /admin/upload` (`uploads.py`) | ✅ | ✅ | **o'zgaradi**: hozir `require_staff` bilan qulflangan, businessman mahsulot rasmini yuklay olishi uchun ochiladi |

### Ataylab qilinadigan buzuvchi o'zgarishlar (mavjud `admin` PWA'ga)

Bular hozir ishlab turgan admin panelning xatti-harakatini o'zgartiradi, shuning uchun `admin/src` ham yangilanishi kerak:

1. **`GET /users`** endi faqat shu do'kondan buyurtma bergan mijozlarni qaytaradi (avval barcha bot foydalanuvchilarini). Bu tuzatuv, chunki avvalgi holat ko'p-tenant dunyoda ma'lumot sizishi.
2. **Mijozni bloklash/o'chirish** endi do'kon xodimida yo'q → `admin/src/pages/UsersPage.tsx`dagi tugmalar olib tashlanadi (aks holda 403 oladi).
3. **E'lonlar (Announcements)** endi do'kon xodimida yo'q → `admin/src`dan `AnnouncementsPage` va uning navbar havolasi olib tashlanadi.

Bu uchtasi platform superadmin PWA'siga (sub-loyiha 3) ko'chadi. Ular hozir `require_superadmin` bilan himoyalangan (do'kon darajasidagi superadmin), endi `require_platform_admin` bilan himoyalangan yangi `/platform/*` routerga o'tadi.

## Yangi `/business/*` endpointlar

Do'kon darajasidan yuqoridagi, biznes bo'ylab ishlaydigan narsalar — bular `/admin/*`ga sig'maydi:

- **`GET /business/stores`** → businessman'ning barcha do'konlari (`RestaurantOut` ro'yxati)
- **`POST /business/stores`** → yangi do'kon yaratish (`business_id` tokendan olinadi)
- **`PUT /business/stores/{rid}`** → do'kon sozlamalari (egalik tekshiriladi)
- **`DELETE /business/stores/{rid}`** → do'konni o'chirish. **Diqqat:** cascade orqali uning kategoriya/mahsulot/xodim/kuryer/zona yozuvlari ham o'chadi. Endpoint tasdiqlash talab qiladi (frontendda) va buyurtmalari bor do'konni o'chirishga yo'l qo'ymaydi (409).
- **`GET /business/stats`** → barcha do'konlar bo'yicha umumiy + har bir do'kon kesimida: buyurtmalar soni, tushum (aylanma), tannarx (harajat), foyda. Bu `admin.py`dagi mavjud `_agg()` yordamchisini `restaurant_id` filtri bilan qayta ishlatadi.

`/business/stats` javob sxemasi:

```python
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

Davr filtri: `?period=today|week|month|all` (default `month`), `admin.py`dagi mavjud `_agg(db, start)` naqshiga mos.

## Qamrovdan tashqarida (keyingi sub-loyihalar)

- **Maosh (salary)** — butunlay yangi domen, alohida sub-loyiha.
- **Businessman PWA (React+TS)** — sub-loyiha 2b.
- **Platform superadmin backend + PWA** — sub-loyiha 3 (bloklash/o'chirish/e'lonlar shu yerga ko'chadi; ular ko'chgunicha `admin.py`da `require_platform_admin` bilan vaqtincha qoladi).
- **`Courier` va `AdminUser(role=courier)` chalkashligini tuzatish** — alohida ish.

## Testing

- `current_restaurant` uchun: do'kon xodimi query paramda boshqa `restaurant_id` bersa ham o'z do'konini olishini; businessman o'ziga tegishli bo'lmagan `restaurant_id` so'rasa 403 olishini; businessman `restaurant_id`siz so'rasa 400 olishini.
- Har bir scoped endpoint uchun: ikkita biznes × ikkita do'kon fixture'i yaratib, A biznesning tokeni B biznesning ma'lumotini (mahsulot, buyurtma, mijoz, xodim) **ko'ra olmasligini** tekshiruvchi test.
- `GET /users` scoping uchun: ikkita do'kondan buyurtma bergan mijozlar aralashmasligini.
- `DELETE /business/stores/{rid}` uchun: buyurtmasi bor do'kon o'chmasligini (409), bo'sh do'kon o'chishini.
- `initdb.py` retrofit uchun: `delivery_zones`/`couriers` legacy qatorlari `restaurant_id` bilan to'ldirilishini va FK'da `ON DELETE CASCADE` borligini (Faza 1a'dagi `test_initdb_retrofits_legacy_rows_missing_tenant_columns` naqshi bo'yicha).
