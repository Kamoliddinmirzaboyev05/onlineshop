from datetime import datetime

from pydantic import BaseModel, Field


class BusinessOut(BaseModel):
    id: int
    name: str
    phone: str | None = None
    username: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class BusinessCreateIn(BaseModel):
    name: str
    username: str
    password: str
    phone: str | None = None


class BusinessRow(BusinessOut):
    stores_count: int


class PlatformAdminOut(BaseModel):
    id: int
    username: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


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


# Do'kon yaratish — do'kon nomi + uni yurituvchi xodim (login/parol) birga.
# Tahrirlashda ishlatilmaydi (u StoreCreateIn'ni to'liq oladi).
class StoreWithStaffCreateIn(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    staff_name: str = Field(min_length=1, max_length=128)
    staff_phone: str | None = None
    staff_username: str = Field(min_length=3, max_length=64)
    staff_password: str = Field(min_length=6, max_length=128)


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


class BusinessBreakdown(BaseModel):
    business_id: int
    name: str
    stores: int
    orders: int
    revenue: int
    cost: int
    profit: int


class PlatformStatsOut(BaseModel):
    businesses_total: int
    stores_total: int
    customers_total: int
    total_orders: int
    total_revenue: int
    total_cost: int
    total_profit: int
    businesses: list[BusinessBreakdown]
