# Multi-tenant foundation (businessman + platform superadmin) — design

## Context

Bugungi holat:
- `Restaurant` modeli allaqachon ko'p-restoranli (bir nechta qator bo'lishi mumkin), lekin uni egasi (tadbirkor) tushunchasi yo'q.
- `AdminUser` (do'kon xodimlari: hozirgi `admin` PWA login qiladigan jadval) hech qanday `restaurant_id`ga bog'lanmagan. `admin.py` route'lari `restaurant_id`ni ixtiyoriy query-param sifatida qabul qiladi — demak har qanday admin xodim istalgan do'konning ma'lumotini so'rasa oladi. Bu real xavfsizlik teshigi.
- `AdminRole` enumi: `superadmin`, `manager`, `courier`. `superadmin` hozircha "hammasini ko'radigan" rol, chunki umuman scoping yo'q.

Kelajakdagi maqsad — 3 ta alohida app/rol darajasi:
```
Platform Superadmin (biz)         — yangi PWA (sub-loyiha 3)
  └── Businessman (tadbirkor)     — yangi PWA (sub-loyiha 2), bir nechta do'konga ega
         └── Do'kon xodimlari     — mavjud `admin` PWA, bitta do'konga cheklangan
```

Ushbu sub-loyiha faqat **backend fundamentini** qamrab oladi: yangi ikkala PWA ham shunga tayanadi. Yangi frontend, yangi dashboard endpointlari (statistika, mijozlar ro'yxati va h.k.) — bu yerga kirmaydi, sub-loyiha 2/3ga qoldiriladi.

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

- `restaurant_id: Mapped[int | None] = mapped_column(ForeignKey("restaurants.id"), index=True)` — `platform_superadmin` uchun NULL, `manager`/`courier` uchun majburiy.

### `AdminRole` enum

- `superadmin` → `platform_superadmin` ga nomi almashtiriladi (qiymati ham). Ma'nosi: butun platformani ko'radigan, biznes cheklovisiz rol.
- `manager`, `courier` — o'zgarishsiz qoladi, faqat endi `restaurant_id`si bo'lishi shart.

## Migratsiya / backfill

Alembic migratsiyasida ketma-ket:
1. `businesses` jadvalini yaratish.
2. Mavjud har bir `Restaurant` qatoriga bittadan default `Business` yozuvi yaratib (masalan restoran nomi + `owner_name`dan foydalanib) `business_id`ni backfill qilish, keyin ustunni NOT NULL qilish.
3. `admin_users.restaurant_id`ni qo'shish (nullable). Mavjud `role=superadmin` qatorlarni `role=platform_superadmin`ga yangilash (restaurant_id NULL qoladi). Qolgan (`manager`/`courier`) qatorlarni — agar bazada faqat bitta restoran mavjud bo'lsa — o'sha restoranga backfill qilish. Agar bir nechta restoran mavjud bo'lsa, backfill implementatsiya bosqichida real ma'lumotga qarab qo'lda hal qilinadi (bu holat hozircha noaniq, lekin ehtimoli past — amalda joriy admin app bitta restoranni boshqargandek ishlatilgan).

## Auth

Mavjud pattern: JWT payload = `{sub, role, exp}`, `decode_token` orqali o'qiladi, har bir rol turi uchun DB'dan lookup qiluvchi alohida `get_current_*` dependency bor (`core/security.py`, `api/deps.py`).

Shu patternga mos yangi qo'shimchalar:

- **`POST /business/auth/login`** (`api/routes/business_auth.py`, yangi fayl) — `admin_auth.py`dagi `admin_login`ga oyna aks, lekin `Business` jadvaliga qarshi tekshiradi, token'da `role="businessman"`.
- **`get_current_business`** (`api/deps.py`) — `get_current_admin`ga oyna aks: token roli `"businessman"` ekanini tekshiradi, `Business`ni id bo'yicha topadi.
- **`require_business`** — shunchaki `get_current_business`ni qaytaradi (hozircha businessman ichida qo'shimcha sub-rol yo'q).
- **`require_platform_superadmin`** — `require_superadmin`ning o'rnini bosadi, `AdminRole.platform_superadmin` tekshiradi.
- **`require_staff`** (mavjud, do'kon xodimlari uchun) — `AdminRole.manager` roliga tekshiruv qo'shiladi va **`admin.restaurant_id is not None`** talab qilinadi.

## Store-scoping xavfsizlik tuzatuvi

`api/routes/admin.py`dagi barcha do'kon-darajasidagi endpointlar (categories/products/orders CRUD) hozir `restaurant_id`ni ixtiyoriy query-paramdan oladi. O'zgarish:

- `manager`/`courier` rolidagi admin uchun: `restaurant_id` endi **query-paramdan emas, `admin.restaurant_id`dan** olinadi (query-param e'tiborga olinmaydi yoki berilsa ham tokendan kelgan qiymatga ustunlik beriladi).
- `platform_superadmin` uchun: o'zining restaurant_id'i yo'q, shuning uchun ixtiyoriy `restaurant_id` query-paramni davom ettiradi (istalgan do'konni ko'ra oladi) — bu qism o'zgarishsiz qoladi.

## Ushbu sub-loyihaga kirmaydigan narsalar

- Businessman uchun ko'p-do'kon statistika/mijozlar/xodimlar-maosh endpointlari — sub-loyiha 2.
- Platform superadmin uchun global statistika va businessman yaratish endpointlari — sub-loyiha 3.
- Yangi frontend (ikkala PWA) — sub-loyiha 2/3.
- Businessman/superadmin PWA'larning o'zi qanday login qilishi (frontend forma) — keyingi sub-loyihalarda.

## Testing

- Migratsiyadan keyin: mavjud restoran(lar) `business_id`ga ega ekanini, mavjud admin_users to'g'ri `restaurant_id`/`platform_superadmin`ga ega ekanini tekshiruvchi bir marotabalik tekshiruv skripti yoki alembic migratsiya ichidagi assert.
- `require_staff`/`admin.py` scoping uchun: bitta manager boshqa restaurant_id bilan so'rov yuborganda 403/o'z ma'lumotlarigina qaytishini tekshiruvchi test.
