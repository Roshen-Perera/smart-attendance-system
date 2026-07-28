from datetime import datetime

from pydantic import BaseModel


class AttendanceCreate(BaseModel):
    session_id: str
    student_id: str
    confidence_score: float | None = None


class AttendanceOut(BaseModel):
    id: str
    session_id: str
    student_id: str
    marked_at: datetime
    confidence_score: float | None

    model_config = {
        "from_attributes": True
    }