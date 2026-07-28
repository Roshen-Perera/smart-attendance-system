import uuid
from datetime import datetime

from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.db import Base


def gen_uuid():
    return str(uuid.uuid4())


class Session(Base):
    __tablename__ = "sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    class_id = Column(
        UUID(as_uuid=True),
        ForeignKey("classes.id"),
        nullable=False
    )

    session_date = Column(
        DateTime,
        nullable=False
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )

    classroom = relationship(
        "Class",
        back_populates="sessions"
    )

    attendance_records = relationship(
        "AttendanceRecord",
        back_populates="session",
        cascade="all, delete-orphan"
    )