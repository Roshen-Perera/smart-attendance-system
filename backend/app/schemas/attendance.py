from datetime import datetime
from uuid import UUID
from pydantic import BaseModel
from typing import Optional
from app.schemas.student import StudentOut


class AttendanceCreate(BaseModel):
    session_id: UUID
    student_id: UUID
    confidence_score: Optional[float] = None


class AttendanceOut(BaseModel):
    id: UUID
    session_id: UUID
    student_id: UUID
    marked_at: datetime
    confidence_score: Optional[float]

    model_config = {
        "from_attributes": True
    }


class AttendanceDetailOut(BaseModel):
    id: UUID
    session_id: UUID
    student: StudentOut
    marked_at: datetime
    confidence_score: Optional[float]

    model_config = {
        "from_attributes": True
    }