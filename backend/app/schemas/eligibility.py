from typing import Optional
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

    # Predictive Analytics Fields
    planned_semester_sessions: int = 15
    remaining_sessions: int = 0
    max_attainable_percentage: float = 100.0
    projected_final_percentage: float = 100.0
    sessions_needed_for_eligibility: int = 0
    allowed_absences_remaining: int = 0
    risk_level: str = "SAFE"  # "SAFE", "MODERATE_RISK", "HIGH_RISK", "CRITICAL", "DISQUALIFIED"
    risk_label: str = "On Track"
    is_mathematically_disqualified: bool = False
    momentum: str = "stable"  # "improving", "declining", "stable"
    prediction_summary: str = ""


class PredictiveStudentItem(BaseModel):
    student_id: UUID
    student_name: str
    reg_number: str
    email: Optional[str] = None
    total_held_sessions: int
    attended_sessions: int
    current_attendance_percentage: float
    current_status: str

    planned_semester_sessions: int
    remaining_sessions: int
    max_attainable_percentage: float
    projected_final_percentage: float
    sessions_needed_for_eligibility: int
    allowed_absences_remaining: int
    risk_level: str
    risk_label: str
    is_mathematically_disqualified: bool
    momentum: str
    prediction_summary: str
    session_details: list[SessionDetailItem] = []


class ClassPredictiveAnalyticsOut(BaseModel):
    class_id: UUID
    course_code: str
    course_name: str
    planned_semester_sessions: int
    sessions_held_count: int
    remaining_sessions_count: int
    total_students: int
    projected_eligible_count: int
    at_risk_count: int
    critical_count: int
    disqualified_count: int
    average_current_percentage: float
    average_projected_percentage: float
    risk_distribution: dict[str, int]
    students: list[PredictiveStudentItem]
