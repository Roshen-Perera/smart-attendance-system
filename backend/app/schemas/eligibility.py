from pydantic import BaseModel


class EligibilityOut(BaseModel):
    student_id: str
    class_id: str
    total_sessions: int
    attended_sessions: int
    attendance_percentage: float
    status: str