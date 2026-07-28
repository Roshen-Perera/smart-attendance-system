import uuid
from datetime import datetime

from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import Column, String, DateTime
from sqlalchemy.orm import relationship

from app.db import Base


def gen_uuid():
    return str(uuid.uuid4())


class Lecturer(Base):
    __tablename__ = "lecturers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    full_name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    department = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    classes = relationship(
        "Class",
        back_populates="lecturer",
        cascade="all, delete-orphan"
    )