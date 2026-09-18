from pydantic import BaseModel
from uuid import UUID

class SessionDetailItem(BaseModel):
    date: str
    time_in: str | None = None
    status: str

class EligibilityOut(BaseModel):
    student_id: UUID
    class_id: UUID
    total_sessions: int
    attended_sessions: int
    attendance_percentage: float
    status: str
    attended_dates: list[str] = []
    missed_dates: list[str] = []
    session_details: list[SessionDetailItem] = []