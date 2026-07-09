from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_business
from app.core.db import get_db
from app.core.ratelimit import rate_limiter
from app.core.security import create_access_token, verify_password
from app.models import Business
from app.schemas.auth import AdminLoginIn, TokenOut
from app.schemas.business import BusinessOut

router = APIRouter(prefix="/business/auth", tags=["business-auth"])

# IP boshiga 1 daqiqada 10 ta login urinishi.
_login_limit = rate_limiter("business_login", limit=10, window_seconds=60)


@router.post("/login", response_model=TokenOut, dependencies=[Depends(_login_limit)])
def business_login(data: AdminLoginIn, db: Session = Depends(get_db)):
    business = db.scalar(select(Business).where(Business.username == data.username))
    if not business or not business.is_active or not verify_password(data.password, business.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    token = create_access_token(subject=business.id, role="businessman")
    return TokenOut(access_token=token)


@router.get("/me", response_model=BusinessOut)
def business_me(business: Business = Depends(get_current_business)):
    return business
