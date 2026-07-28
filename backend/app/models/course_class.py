import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.db import Base


def gen_uuid():
    return str(uuid.uuid4())


class Class(Base):
    __tablename__ = "classes"

    id = Column(String, primary_key=True, default=gen_uuid)
    course_code = Column(String, nullable=False, index=True)
    course_name = Column(String, nullable=False)
    lecturer_id = Column(String, ForeignKey("lecturers.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    lecturer = relationship("Lecturer", back_populates="classes")
    enrollments = relationship("Enrollment", back_populates="classroom", cascade="all, delete-orphan")
    sessions = relationship("Session", back_populates="classroom", cascade="all, delete-orphan")