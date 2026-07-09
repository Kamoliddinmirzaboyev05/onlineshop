# Multi-tenant foundation (businessman + platform superadmin) — design

## Context

Bugungi holat:
- `Restaurant` modeli allaqachon ko'p-restoranli (bir nechta qator bo'lishi mumkin), lekin uni egasi (tadbirkor) tushunchasi yo'q.
- `AdminUser` (do'kon xodimlari: hozirgi `admin` PWA login qiladigan jadval) hech qanday `restaurant_id`ga bog'lanmagan. `admin.py` route'lari `restaurant_id`ni ixtiyoriy query-param sifatida qabul qiladi — demak har qanday admin xodim istalgan do'konning ma'lumotini so'rasa oladi. Bu real xavfsizlik teshigi.
- `AdminRole` enumi: `superadmin`, `manager`, `courier` — **barchasi do'kon darajasidagi rollar**. `superadmin` platforma darajasi emas, balki bitta do'kon ichida to'liq huquq (frontendda `admin/src/components/Layout.tsx`: Reports/Announcements/Users/Couriers/Settings sahifalari faqat shu rolga ochiq — `CouriersPage.tsx` xuddi shu rol nomini "Superadmin" deb ko'rsatadi). Bu ma'no o'zgartirilmaydi — faqat scoping (restaurant_id) yetishmaydi.

Kelajakdagi maqsad — 3 ta alohida app/rol darajasi:
```
Platform Superadmin (biz)         — yangi PWA (sub-loyiha 3)
  └── Businessman (tadbirkor)     — yangi PWA (sub-loyiha 2), bir nechta do'konga ega
         └── Do'kon xodimlari     — mavjud `admin` PWA, bitta do'konga cheklangan
```

Ushbu sub-loyiha faqat **backend fundamentini** qamrab oladi: yangi ikkala PWA ham shunga tayanadi. Yangi frontend, yangi dashboard endpointlari (statistika, mijozlar ro'yxati va h.k.) — bu yerga kirmaydi, sub-loyiha 2/3ga qoldiriladi.

**Ikki fazaga bo'lingan (alohida implementatsiya reja):**
- **1a — Data model + auth** (xavfsiz, qo'shimcha, hozirgi admin app xatti-harakatini o'zgartirmaydi): `businesses`, `platform_admins` jadvallari, `restaurants.business_id`, `admin_users.restaurant_id`, yangi `/business/auth/login` va `/platform/auth/login`.
- **1b — Mavjud `admin.py` endpointlarini restaurant_id bo'yicha cheklash** (production'da ishlayotgan xatti-harakatni o'zgartiradi — `default_store()`, category/product yaratish, buyurtmalar ro'yxati, admin-user yaratish va h.k. — alohida diqqat va test talab qiladi). Bu faza 1a tugagach, alohida reja bilan boshlanadi.

## Data model o'zgarishlari

### Yangi jadval: `businesses` (tadbirkor akkaunti)

```python
class Business(Base):
    __tablename__ = "businesses"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(128))
    phone: Mapped[str | None] = mapped_column(String(32))
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    restaurants = relationship("Restaurant", back_populates="business")
```

### `Restaurant` o'zgarishi

- `business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id"), index=True)` — majburiy (NOT NULL).
- `business = relationship("Business", back_populates="restaurants")`

### `AdminUser` o'zgarishi

- `restaurant_id: Mapped[int] = mapped_column(ForeignKey("restaurants.id"), index=True)` — **majburiy** (NOT NULL). `superadmin`, `manager`, `courier` — uchalasi ham do'kon darajasida bo'lgani uchun barchasi restaurant_id talab qiladi.

### `AdminRole` enum — o'zgarishsiz qoladi

Rename qilinmaydi. `superadmin`/`manager`/`courier` semantikasi bugungidek qoladi (do'kon darajasi), faqat endi hammasi `restaurant_id`ga ega.

### Yangi jadval: `platform_admins` (platforma darajasi — biz)

Businessman kabi alohida, kichik jadval (odatda 1-2 qator, faqat bizning jamoa uchun):

```python
class PlatformAdmin(Base):
    __tablename__ = "platform_admins"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
```

Na `restaurant_id`, na `business_id` — platforma admin butun tizimni ko'radi, hech qaysi do'kon/businessga tegishli emas.

## Migratsiya / backfill

Loyihada Alembic sozlangan-u, lekin amalda ishlatilmaydi — schema o'zgarishlari `backend/app/initdb.py`da idempotent SQL orqali qilinadi (`Base.metadata.create_all` yangi jadval yaratadi, keyin `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` mavjud jadvallarga ustun qo'shadi; docker-compose'da container start'da ishga tushadi). Shu patternga amal qilamiz, yangi Alembic revision yozmaymiz.

Ketma-ket bosqichlar (barchasi `initdb.py` ichida, idempotent):
1. `businesses` jadvalini yaratish.
2. Mavjud har bir `Restaurant` qatoriga bittadan default `Business` yozuvi yaratib (masalan restoran nomi + `owner_name`dan foydalanib) `business_id`ni backfill qilish, keyin ustunni NOT NULL qilish.
3. `platform_admins` jadvalini yaratish (bo'sh, qo'lda yoki `seed.py`da birinchi platforma admin qo'shiladi).
4. `admin_users.restaurant_id`ni qo'shish (avval nullable, keyin backfill, keyin NOT NULL). `seed.py`da faqat bitta default do'kon va bitta superadmin yaratiladi (`app/seed.py`), demak amalda bugun bitta restoran bor deb hisoblash xavfsiz: mavjud barcha `admin_users` qatorlarini yagona (yoki birinchi) restoranga bog'lab qo'yish.

## Auth

Mavjud pattern: JWT payload = `{sub, role, exp}`, `decode_token` orqali o'qiladi, har bir rol turi uchun DB'dan lookup qiluvchi alohida `get_current_*` dependency bor (`core/security.py`, `api/deps.py`).

Shu patternga mos yangi qo'shimchalar:

- **`POST /business/auth/login`** (`api/routes/business_auth.py`, yangi fayl) — `admin_auth.py`dagi `admin_login`ga oyna aks, lekin `Business` jadvaliga qarshi tekshiradi, token'da `role="businessman"`.
- **`get_current_business`** (`api/deps.py`) — `get_current_admin`ga oyna aks: token roli `"businessman"` ekanini tekshiradi, `Business`ni id bo'yicha topadi.
- **`POST /platform/auth/login`** (`api/routes/platform_auth.py`, yangi fayl) — xuddi shunday, `PlatformAdmin` jadvaliga qarshi, token'da `role="platform_superadmin"`.
- **`get_current_platform_admin`** (`api/deps.py`) — token roli `"platform_superadmin"` ekanini tekshiradi, `PlatformAdmin`ni id bo'yicha topadi.
- **`require_business`**, **`require_platform_admin`** — mos `get_current_*`ni qaytaruvchi trivial wrapper'lar (`require_superadmin` patteniga mos, kelajakda sub-rol qo'shilsa kengaytiriladi).
- Mavjud `require_staff`/`require_superadmin` (`admin_users` uchun) — o'zgarishsiz qoladi (`AdminRole` semantikasi o'zgarmagani uchun).

## Store-scoping xavfsizlik tuzatuvi

`api/routes/admin.py`dagi barcha do'kon-darajasidagi endpointlar (categories/products/orders CRUD) hozir `restaurant_id`ni ixtiyoriy query-paramdan oladi — har qanday `admin_user` (superadmin/manager/courier) istalgan do'konni so'rasa oladi. O'zgarish: endi har bir `admin_user`ning o'z `restaurant_id`si bor, shuning uchun bu endpointlar `restaurant_id`ni **query-paramdan emas, `admin.restaurant_id`dan** oladi (query-param butunlay olib tashlanadi — endi kerak emas, chunki bitta admin_user hech qachon bir nechta do'konga tegishli bo'lmaydi).

## Ushbu sub-loyihaga kirmaydigan narsalar

- Businessman uchun ko'p-do'kon statistika/mijozlar/xodimlar-maosh endpointlari — sub-loyiha 2.
- Platform superadmin uchun global statistika va businessman yaratish endpointlari — sub-loyiha 3.
- Yangi frontend (ikkala PWA) — sub-loyiha 2/3.
- Businessman/superadmin PWA'larning o'zi qanday login qilishi (frontend forma) — keyingi sub-loyihalarda.

## Testing

- Migratsiyadan keyin: mavjud restoran `business_id`ga ega ekanini, mavjud har bir `admin_user` `restaurant_id`ga ega ekanini tekshiruvchi tekshiruv (pytest, real Postgres'ga qarshi) — **1a**.
- `business_auth.py` va `platform_auth.py` login endpointlari uchun: to'g'ri parol bilan token qaytishini, noto'g'ri parol bilan 401 qaytishini tekshiruvchi test — **1a**.
- `admin.py` scoping uchun: ikkita turli restoranga tegishli ikkita admin_user yaratib, har biri faqat o'z do'koni categories/products/orders'ini ko'rishini (boshqasini emas) tekshiruvchi test — **1b** (endpointlarni scoping bilan qayta yozishning bir qismi).
