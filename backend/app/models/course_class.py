import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.db import Base

class Class(Base):
    __tablename__ = "classes"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    course_code = Column(String, nullable=False, index=True)
    course_title = Column(String, nullable=False)
    lecturer_id = Column(String, ForeignKey("lecturers.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    lecturer = relationship("Lecturer", back_populates="classes")