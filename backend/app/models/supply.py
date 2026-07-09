from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class SupplyRecord(Base):
    __tablename__ = "supply_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), index=True)
    supplier_name: Mapped[str] = mapped_column(String(128))
    quantity: Mapped[float] = mapped_column(Float)
    unit: Mapped[str] = mapped_column(String(32), default="dona")   # kg, litr, dona, ...
    cost_per_unit: Mapped[int] = mapped_column(Integer, default=0)  # so'm
    total_cost: Mapped[int] = mapped_column(Integer, default=0)     # so'm
    supply_date: Mapped[date] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

    product = relationship("Product")
