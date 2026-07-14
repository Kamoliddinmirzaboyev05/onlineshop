import secrets

from fastapi import HTTPException, status
from sqlalchemy import func, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from sqlalchemy import select

from app.models import Address, DeliveryZone, Order, OrderItem, Product, Restaurant, User
from app.models.enums import OrderStatus
from app.schemas.order import OrderCreateIn
from app.services.geo import (
    distance_to_user,
    is_within_zone,
    reverse_geocode,
    zone_is_configured,
)

# Buyurtma holatlari grafi — faqat ruxsat etilgan o'tishlar.
# Bekor qilish (cancelled) yetkazilgan/bekor qilingandan tashqari har qaysidan mumkin.
# Kuryer buyurtmani to'g'ridan-to'g'ri boshqaradi (admin tasdig'isiz): yangi
# (pending) buyurtmani ham qabul qila oladi. Shu sabab erta holatlardan ham
# 'accepted' ga o'tish ruxsat etilgan.
_ALLOWED_TRANSITIONS: dict[OrderStatus, set[OrderStatus]] = {
    OrderStatus.pending: {OrderStatus.confirmed, OrderStatus.accepted, OrderStatus.cancelled},
    OrderStatus.confirmed: {OrderStatus.preparing, OrderStatus.accepted, OrderStatus.cancelled},
    OrderStatus.preparing: {OrderStatus.ready, OrderStatus.accepted, OrderStatus.cancelled},
    OrderStatus.ready: {OrderStatus.accepted, OrderStatus.delivering, OrderStatus.cancelled},
    OrderStatus.accepted: {OrderStatus.delivering, OrderStatus.cancelled},
    OrderStatus.delivering: {OrderStatus.delivered, OrderStatus.cancelled},
    OrderStatus.delivered: set(),     # terminal
    OrderStatus.cancelled: set(),     # terminal
}


def ensure_transition(current: OrderStatus, new: OrderStatus) -> None:
    """Noto'g'ri holat o'tishini 400 bilan rad etadi. Bir xil holat — no-op."""
    if new == current:
        return
    if new not in _ALLOWED_TRANSITIONS.get(current, set()):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Holatni '{current.value}' dan '{new.value}' ga o'zgartirib bo'lmaydi",
        )


def decrement_stock_atomic(db: Session, order: Order) -> None:
    """Yetkazilgan buyurtma uchun ombor qoldig'ini atomik kamaytiradi.
    Race condition'siz: read-modify-write o'rniga bitta UPDATE."""
    for it in order.items:
        db.execute(
            update(Product)
            .where(Product.id == it.product_id)
            .values(stock=func.greatest(Product.stock - it.quantity, 0))
        )


def _generate_number() -> str:
    return "AF-" + secrets.token_hex(4).upper()


def create_order(db: Session, user: User, data: OrderCreateIn) -> Order:
    if user.is_blocked:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Akkauntingiz bloklangan")
    restaurant = db.get(Restaurant, data.restaurant_id)
    if not restaurant or not restaurant.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Restaurant not found")
    if not restaurant.is_open:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Restaurant is closed")
    if not data.items:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cart is empty")

    # resolve delivery target
    address_line = data.address_line
    lat, lng = data.lat, data.lng
    if data.address_id:
        addr = db.get(Address, data.address_id)
        if not addr or addr.user_id != user.id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Address not found")
        address_line, lat, lng = addr.address_line, addr.lat, addr.lng
    # Mijoz manzil yozmaydi — joylashuv yuboradi. Manzil bo'sh bo'lsa,
    # koordinatadan o'qiladigan manzilni avtomatik olamiz (geocode), bo'lmasa
    # koordinataning o'zini saqlaymiz.
    if not address_line:
        if lat is None or lng is None:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Yetkazib berish uchun joylashuvni yuboring",
            )
        address_line = reverse_geocode(lat, lng) or f"📍 {lat:.5f}, {lng:.5f}"

    # Yetkazish hududi (doira) tekshiruvi — shu do'konning faol zonasi bo'lsa.
    zone = db.scalar(
        select(DeliveryZone)
        .where(DeliveryZone.restaurant_id == restaurant.id, DeliveryZone.is_active.is_(True))
        .order_by(DeliveryZone.id)
        .limit(1)
    )
    if zone_is_configured(zone):
        if lat is None or lng is None:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Yetkazib berish uchun joylashuvni yuboring",
            )
        if not is_within_zone(zone, lat, lng):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Manzil yetkazib berish hududidan tashqarida",
            )

    items_total = 0
    order_items: list[OrderItem] = []
    for ci in data.items:
        product = db.get(Product, ci.product_id)
        if not product or product.restaurant_id != restaurant.id or not product.is_available:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Product {ci.product_id} unavailable")
        # Ombor qoldig'ini tekshirish (overselling'ni oldini olish).
        if product.stock < ci.quantity:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"'{product.name_uz}' uchun ombor yetarli emas (qoldiq: {product.stock:g})",
            )
        line = product.price * ci.quantity
        items_total += line
        order_items.append(
            OrderItem(
                product_id=product.id,
                name_uz=product.name_uz,
                name_ru=product.name_ru,
                image_url=product.image_url,
                price=product.price,
                cost=product.cost,          # sotuv vaqtidagi tannarx snapshot'i
                quantity=ci.quantity,
                unit=product.unit,          # o'lchov birligi snapshot (kg/dona/litr)
                note=(ci.note or None),     # mahsulotga mijoz izohi
            )
        )

    if items_total < restaurant.min_order:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Minimum order is {restaurant.min_order}",
        )

    delivery_fee = restaurant.delivery_fee

    # Do'kon ↔ mijoz masofasi (km) — origin: restaurant.lat/lng yoki zona markazi.
    distance_km = distance_to_user(restaurant, zone, lat, lng)

    # Raqam unikal — noyob kolliziyada qayta urinamiz (IntegrityError).
    for _attempt in range(5):
        order = Order(
            number=_generate_number(),
            user_id=user.id,
            restaurant_id=restaurant.id,
            status=OrderStatus.pending,
            payment_method=data.payment_method,
            items_total=items_total,
            delivery_fee=delivery_fee,
            total=items_total + delivery_fee,
            address_line=address_line,
            lat=lat,
            lng=lng,
            phone=data.phone or user.phone,
            comment=data.comment,
            distance_km=distance_km,
            items=[
                OrderItem(
                    product_id=oi.product_id,
                    name_uz=oi.name_uz,
                    name_ru=oi.name_ru,
                    image_url=oi.image_url,
                    price=oi.price,
                    cost=oi.cost,
                    quantity=oi.quantity,
                    unit=oi.unit,
                    note=oi.note,
                )
                for oi in order_items
            ],
        )
        db.add(order)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            continue
        db.refresh(order)
        return order

    raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Could not generate order number")
