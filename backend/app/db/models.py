from app.db.database import Base
from sqlalchemy import String, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column
from typing import Optional
from datetime import datetime, timezone



class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    name: Mapped[Optional[str]] = mapped_column(String(255))
    picture_url: Mapped[Optional[str]] = mapped_column(Text)

    google_id: Mapped[Optional[str]] = mapped_column(String(255), unique=True, index=True)

    refresh_token: Mapped[Optional[str]] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


    
