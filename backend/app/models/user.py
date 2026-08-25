import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import UUID

from app.db import Base


class User(Base):
    __tablename__ = "users"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    email = Column(
        String,
        unique=True,
        nullable=False,
        index=True
    )

    hashed_password = Column(
        String,
        nullable=False
    )

    full_name = Column(
        String,
        nullable=False
    )

    role = Column(
        String,
        nullable=False,
        default="lecturer"  # "admin", "lecturer", "student"
    )

    created_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc)
    )
