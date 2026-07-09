"""Fire-and-forget Telegram notifications via Bot API (httpx).

Used by API to ping the user and the orders channel on order events.
Failures are swallowed — a notification problem must never break an order.
"""

import httpx

from app.core.config import settings
from app.models import Order
from app.services import webpush

_API = f"https://api.telegram.org/bot{settings.bot_token}/sendMessage"
_PHOTO_API = f"https://api.telegram.org/bot{settings.bot_token}/sendPhoto"

_STATUS_TEXT = {
    "pending": "🆕 Buyurtmangiz qabul qilindi / Заказ принят",
    "confirmed": "✅ Buyurtma tasdiqlandi / Заказ подтверждён",
    "preparing": "👨‍🍳 Tayyorlanmoqda / Готовится",
    "ready": "📦 Tayyor / Готов",
    "accepted": "✅ Kuryer qabul qildi / Курьер принял заказ",
    "delivering": "🛵 Yetkazilmoqda / В пути",
    "delivered": "🎉 Yetkazib berildi / Доставлен",
    "cancelled": "❌ Bekor qilindi / Отменён",
}


def _send(chat_id: int, text: str) -> None:
    try:
        httpx.post(_API, json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"}, timeout=5)
    except Exception:
        pass


def _send_photo(chat_id: int, png: bytes, caption: str = "") -> None:
    try:
        httpx.post(
            _PHOTO_API,
            data={"chat_id": chat_id, "caption": caption},
            files={"photo": ("receipt.png", png, "image/png")},
            timeout=10,
        )
    except Exception:
        pass


def _ask_location(chat_id: int) -> None:
    try:
        httpx.post(_API, json={
            "chat_id": chat_id,
            "text": "📍 Buyurtmangizni yetkazib berish uchun joylashuvingizni yuboring\n📍 Отправьте геолокацию для доставки",
            "reply_markup": {
                "keyboard": [[{"text": "📍 Joylashuv yuborish / Геолокация", "request_location": True}]],
                "resize_keyboard": True,
                "one_time_keyboard": True,
            },
        }, timeout=5)
    except Exception:
        pass


def notify_new_order(
    order: Order, user_telegram_id: int, receipt_png: bytes | None = None,
    needs_location: bool = True,
) -> None:
    lines = [
        f"🆕 <b>Yangi buyurtma {order.number}</b>",
        f"Restoran ID: {order.restaurant_id}",
        f"Summa: {order.total:,} so'm",
        f"Manzil: {order.address_line}",
        f"Tel: {order.phone or '-'}",
    ]
    text = "\n".join(lines)
    if settings.orders_chat_id:
        _send(settings.orders_chat_id, text)

    # Foydalanuvchiga chek (rasm) + status.
    if receipt_png:
        _send_photo(
            user_telegram_id, receipt_png,
            caption=f"🧾 Buyurtmangiz qabul qilindi · № {order.number}",
        )
    else:
        _send(user_telegram_id, _STATUS_TEXT["pending"] + f"\n№ {order.number}")

    # Joylashuv hali yo'q bo'lsa — so'raymiz (TMA xaritadan yuborgan bo'lsa, kerak emas).
    if needs_location:
        _ask_location(user_telegram_id)

    # admin PWA push
    webpush.notify_admins(
        f"🆕 Yangi buyurtma {order.number}",
        f"{order.total:,} so'm · {order.address_line}",
        url="/orders",
        tag=f"order-{order.id}",
    )

    # Barcha kuryerlarga — yangi buyurtma mavjud (birinchi qabul qilgan oladi).
    webpush.notify_all_couriers(
        f"🆕 Yangi buyurtma № {order.number}",
        f"{order.total:,} so'm · {order.address_line}",
        url="/orders",
        tag=f"neworder-{order.id}",
    )


def notify_courier_assigned(order: Order, courier_admin_id: int) -> None:
    """Push to the assigned courier's app (web push)."""
    webpush.notify_courier(
        courier_admin_id,
        f"🛵 Yangi buyurtma № {order.number}",
        f"{order.total:,} so'm · {order.address_line}",
        url=f"/orders/{order.id}",
        tag=f"assign-{order.id}",
    )


def notify_location_update(order_number: str, lat: float, lng: float) -> None:
    if settings.orders_chat_id:
        maps_url = f"https://maps.google.com/?q={lat},{lng}"
        _send(settings.orders_chat_id, f"📍 Buyurtma <b>{order_number}</b> joylashuvi:\n{maps_url}")


def notify_status_change(order: Order, user_telegram_id: int) -> None:
    text = _STATUS_TEXT.get(order.status.value, "")
    if text:
        _send(user_telegram_id, f"{text}\n№ {order.number}")


def notify_delivering_eta(
    order: Order, user_telegram_id: int, eta_minutes: int | None, distance_km: float | None
) -> None:
    """Kuryer 'yetkazilmoqda' bosganda — masofa + taxminiy yetkazib berish vaqti."""
    lines = [f"🛵 <b>Buyurtmangiz yo'lda · № {order.number}</b>"]
    if eta_minutes:
        lines.append(f"⏱ Taxminan <b>{eta_minutes} daqiqada</b> yetkaziladi")
        lines.append(f"⏱ Ориентировочно через <b>{eta_minutes} мин</b>")
    if distance_km:
        lines.append(f"📍 Masofa: ~{distance_km:g} km")
    _send(user_telegram_id, "\n".join(lines))
