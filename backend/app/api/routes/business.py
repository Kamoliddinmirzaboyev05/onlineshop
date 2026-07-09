from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_business
from app.core.db import get_db
from app.models import Business, Order, Restaurant
from app.schemas.business import BusinessStatsOut, StoreBreakdown, StoreCreateIn
from app.schemas.catalog import RestaurantOut

# Tadbirkorning biznes bo'ylab amallari (bitta do'kondan yuqori daraja).
router = APIRouter(prefix="/business", tags=["business"])

_PERIOD_DAYS = {"today": 0, "week": 7, "month": 30}


def _period_start(period: str) -> datetime | None:
    """`all` uchun None (butun tarix), aks holda bugundan orqaga sanaladi."""
    if period == "all":
        return None
    days = _PERIOD_DAYS.get(period)
    if days is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "period: today|week|month|all")
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    return today - timedelta(days=days)


def _own_store(rid: int, business: Business, db: Session) -> Restaurant:
    store = db.get(Restaurant, rid)
    if not store or store.business_id != business.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Store not found")
    return store


@router.get("/stores", response_model=list[RestaurantOut])
def list_stores(
    business: Business = Depends(get_current_business), db: Session = Depends(get_db)
):
    return db.scalars(
        select(Restaurant).where(Restaurant.business_id == business.id).order_by(Restaurant.id)
    ).all()


@router.post("/stores", response_model=RestaurantOut, status_code=201)
def create_store(
    data: StoreCreateIn,
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    store = Restaurant(**data.model_dump(), business_id=business.id)
    db.add(store)
    db.commit()
    db.refresh(store)
    return store


@router.put("/stores/{rid}", response_model=RestaurantOut)
def update_store(
    rid: int,
    data: StoreCreateIn,
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    store = _own_store(rid, business, db)
    for k, v in data.model_dump().items():
        setattr(store, k, v)
    db.commit()
    db.refresh(store)
    return store


@router.delete("/stores/{rid}", status_code=204)
def delete_store(
    rid: int,
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    """Do'konni o'chirish. Buyurtma tarixi bor do'kon o'chirilmaydi (409) —
    aks holda cascade uning buyurtmalarini ham olib ketardi."""
    store = _own_store(rid, business, db)
    has_orders = db.scalar(
        select(func.count(Order.id)).where(Order.restaurant_id == store.id)
    )
    if has_orders:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Buyurtma tarixi bor do'konni o'chirib bo'lmaydi"
        )
    db.delete(store)
    db.commit()


@router.get("/stats", response_model=BusinessStatsOut)
def business_stats(
    period: str = "month",
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    """Har bir do'kon kesimida va umumiy: buyurtma, aylanma, harajat, foyda."""
    from app.api.routes.admin import _agg

    start = _period_start(period)
    stores = db.scalars(
        select(Restaurant).where(Restaurant.business_id == business.id).order_by(Restaurant.id)
    ).all()

    breakdown: list[StoreBreakdown] = []
    for store in stores:
        orders, revenue, profit = _agg(db, store.id, start)
        breakdown.append(StoreBreakdown(
            restaurant_id=store.id, name=store.name,
            orders=orders, revenue=revenue, cost=revenue - profit, profit=profit,
        ))

    return BusinessStatsOut(
        total_orders=sum(s.orders for s in breakdown),
        total_revenue=sum(s.revenue for s in breakdown),
        total_cost=sum(s.cost for s in breakdown),
        total_profit=sum(s.profit for s in breakdown),
        stores=breakdown,
    )
