from datetime import datetime

from sqlalchemy import DateTime, Enum, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.enums import AnnouncementStatus


class Announcement(Base):
    """A broadcast post (text + optional image + TMA button) sent to bot users."""

    __tablename__ = "announcements"

    id: Mapped[int] = mapped_column(primary_key=True)
    text: Mapped[str] = mapped_column(Text)
    image_url: Mapped[str | None] = mapped_column(String(512))
    button_text: Mapped[str] = mapped_column(String(64), default="🛍 Ochish")
    status: Mapped[AnnouncementStatus] = mapped_column(
        Enum(AnnouncementStatus), default=AnnouncementStatus.pending
    )
    total_recipients: Mapped[int] = mapped_column(Integer, default=0)
    sent_count: Mapped[int] = mapped_column(Integer, default=0)
    failed_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
