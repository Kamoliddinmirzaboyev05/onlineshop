from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.db import get_db
from app.core.ratelimit import rate_limiter
from app.core.security import create_access_token, verify_telegram_init_data
from app.models import User
from app.schemas.auth import AuthResult, TelegramAuthIn, TokenOut, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])

_tg_auth_limit = rate_limiter("tg_auth", limit=30, window_seconds=60)


@router.post("/telegram", response_model=AuthResult, dependencies=[Depends(_tg_auth_limit)])
def telegram_auth(data: TelegramAuthIn, db: Session = Depends(get_db)):
    parsed = verify_telegram_init_data(data.init_data)
    if not parsed or "user" not in parsed:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid initData")

    tg = parsed["user"]
    user = db.scalar(select(User).where(User.telegram_id == tg["id"]))
    if not user:
        user = User(
            telegram_id=tg["id"],
            username=tg.get("username"),
            first_name=tg.get("first_name"),
            last_name=tg.get("last_name"),
            language=tg.get("language_code", "uz")[:2],
        )
        db.add(user)
    else:
        user.username = tg.get("username") or user.username
        user.first_name = tg.get("first_name") or user.first_name
    db.commit()
    db.refresh(user)

    token = create_access_token(subject=user.id, role="user")
    return AuthResult(token=TokenOut(access_token=token), user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user
