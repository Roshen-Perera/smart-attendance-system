import uuid
from datetime import datetime

from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import (
    Column,
    String,
    DateTime,
    Float,
    ForeignKey,
)

from sqlalchemy.orm import relationship

from app.db import Base


def gen_uuid():
    return str(uuid.uuid4())


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("sessions.id"),
        nullable=False
    )

    student_id = Column(
        UUID(as_uuid=True),
        ForeignKey("students.id"),
        nullable=False
    )

    marked_at = Column(
        DateTime,
        default=datetime.utcnow
    )

    confidence_score = Column(
        Float,
        nullable=True
    )

    session = relationship(
        "Session",
        back_populates="attendance_records"
    )

    student = relationship(
        "Student",
        back_populates="attendance_records"
    )