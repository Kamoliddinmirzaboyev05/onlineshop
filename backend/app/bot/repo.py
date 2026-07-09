"""User persistence helpers for the bot. One place that touches the DB for
user rows, so handlers/onboarding stay free of session boilerplate."""

from sqlalchemy import select

from app.core.db import SessionLocal
from app.models import Order, OrderStatus, User


def get_or_create_user(tg_id: int, first_name: str | None, username: str | None) -> User:
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.telegram_id == tg_id))
        if not user:
            user = User(telegram_id=tg_id, first_name=first_name, username=username)
            db.add(user)
            db.commit()
            db.refresh(user)
        return user


def set_lang(tg_id: int, lang: str) -> None:
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.telegram_id == tg_id))
        if user:
            user.language = lang
            db.commit()


def set_phone(tg_id: int, phone: str) -> None:
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.telegram_id == tg_id))
        if user:
            user.phone = phone
            db.commit()


def set_name(tg_id: int, first_name: str, last_name: str | None) -> None:
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.telegram_id == tg_id))
        if user:
            user.first_name = first_name
            user.last_name = last_name
            db.commit()


def is_onboarded(user: User) -> bool:
    """Onboarding is complete once we have a phone and a full name."""
    return bool(user.phone and user.first_name and user.last_name)


def get_latest_pending_order(tg_id: int) -> Order | None:
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.telegram_id == tg_id))
        if not user:
            return None
        return db.scalar(
            select(Order)
            .where(Order.user_id == user.id, Order.status == OrderStatus.pending)
            .order_by(Order.created_at.desc())
        )


def set_order_location(order_id: int, lat: float, lng: float) -> None:
    with SessionLocal() as db:
        order = db.get(Order, order_id)
        if order:
            order.lat = lat
            order.lng = lng
            db.commit()


def split_full_name(text: str) -> tuple[str, str]:
    """'Ali Valiyev Aliyevich' -> ('Ali', 'Valiyev Aliyevich'). Single word -> ('Ali', '')."""
    parts = text.strip().split()
    if not parts:
        return "", ""
    return parts[0], " ".join(parts[1:])
