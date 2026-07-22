import uuid
from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime

from app.db import Base
def gen_uuid():
    return str(uuid.uuid4())

class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True, default=gen_uuid)

    student_id = Column(
        String,
        unique=True,
        nullable=False
    )

    name = Column(
        String,
        nullable=False
    )

    email = Column(
        String,
        unique=True,
        nullable=True
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )