from datetime import datetime
from uuid import UUID
from pydantic import BaseModel


class AttendanceCreate(BaseModel):
    session_id: UUID
    student_id: UUID
    confidence_score: float | None = None


class AttendanceOut(BaseModel):
    id: UUID
    session_id: UUID
    student_id: UUID
    marked_at: datetime
    confidence_score: float | None

    model_config = {
        "from_attributes": True
    }