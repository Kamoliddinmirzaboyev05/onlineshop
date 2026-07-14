from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.db import get_db
from app.models import Category, CategoryGroup, DeliveryZone, Product, Restaurant
from app.schemas.catalog import (
    CategoryGroupOut,
    CategoryWithSubcategories,
    ProductOut,
    RestaurantDetail,
    RestaurantOut,
    SubcategoryOut,
)
from app.services.geo import haversine_km, is_within_zone, shop_origin, zone_is_configured

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

    groups = db.scalars(
        select(CategoryGroup)
        .where(CategoryGroup.restaurant_id == restaurant.id)
        .order_by(CategoryGroup.sort_order)
    ).all()

    detail = RestaurantDetail.model_validate(restaurant)
    detail.categories = cat_out
    detail.category_groups = [CategoryGroupOut.model_validate(g) for g in groups]
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


def _store_zone(db: Session, restaurant_id: int) -> DeliveryZone | None:
    return db.scalar(
        select(DeliveryZone)
        .where(DeliveryZone.restaurant_id == restaurant_id, DeliveryZone.is_active.is_(True))
        .order_by(DeliveryZone.id)
        .limit(1)
    )


@router.get("/nearest", response_model=RestaurantDetail)
def get_nearest_store(lat: float, lng: float, db: Session = Depends(get_db)):
    """Foydalanuvchiga eng yaqin, uni yetkazish hududi qamrab oladigan do'kon.

    Yaqinlikda tartiblab, har birining yetkazish zonasini tekshiramiz — birinchi
    mos kelgani qaytadi. Hech qaysi do'kon hududni qamramasa — 404 OUT_OF_RANGE.
    """
    restaurants = db.scalars(
        select(Restaurant).where(Restaurant.is_active.is_(True))
    ).all()
    if not restaurants:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No active stores found")

    # Har bir do'kon uchun masofa hisoblash origin'i: o'zining lat/lng'i,
    # bo'lmasa yetkazish zonasi markazi (ko'p do'konlar faqat zona belgilagan).
    ranked: list[tuple[float, Restaurant, DeliveryZone | None]] = []
    for r in restaurants:
        zone = _store_zone(db, r.id)
        origin = shop_origin(r, zone)
        if origin:
            ranked.append((haversine_km(lat, lng, origin[0], origin[1]), r, zone))

    if not ranked:
        return _build_detail(restaurants[0], db)

    ranked.sort(key=lambda x: x[0])
    for _, r, zone in ranked:
        if not zone_is_configured(zone) or is_within_zone(zone, lat, lng):
            return _build_detail(r, db)

    raise HTTPException(status.HTTP_404_NOT_FOUND, "OUT_OF_RANGE")


@router.get("/{restaurant_id}", response_model=RestaurantDetail)
def get_restaurant(restaurant_id: int, db: Session = Depends(get_db)):
    restaurant = db.get(Restaurant, restaurant_id)
    if not restaurant or not restaurant.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Restaurant not found")
    return _build_detail(restaurant, db)
