from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models import Address, User
from app.schemas.order import AddressIn, AddressOut

router = APIRouter(prefix="/addresses", tags=["addresses"])


@router.get("", response_model=list[AddressOut])
def list_addresses(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(select(Address).where(Address.user_id == user.id)).all()


@router.post("", response_model=AddressOut, status_code=201)
def create_address(
    data: AddressIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    addr = Address(user_id=user.id, **data.model_dump())
    db.add(addr)
    db.commit()
    db.refresh(addr)
    return addr


@router.delete("/{address_id}", status_code=204)
def delete_address(
    address_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    addr = db.get(Address, address_id)
    if not addr or addr.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Address not found")
    db.delete(addr)
    db.commit()
