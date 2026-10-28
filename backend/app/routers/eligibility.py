import math
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app import models
from app.schemas import eligibility as schemas
from app.logger import logger

router = APIRouter(
    prefix="/eligibility",
    tags=["Eligibility"]
)


def _compute_student_prediction(
    student_id: str,
    student_name: str,
    reg_number: str,
    email: Optional[str],
    classroom: models.Class,
    sessions: list[models.Session],
    attended_records_map: dict[str, Optional[models.datetime]],
    planned_sessions: int = 15
) -> dict:
    total_held = len(sessions)
    effective_planned = max(planned_sessions, total_held, 1)

    attended_session_ids = set(attended_records_map.keys())
    attended_count = len(attended_session_ids)

    # 1. Historical / Current metrics
    if total_held > 0:
        current_pct = round((attended_count / total_held) * 100, 2)
    else:
        current_pct = 100.0

    current_status = "Eligible" if current_pct >= 80.0 else "Not Eligible"

    # Dates and timeline breakdown
    attended_dates = []
    missed_dates = []
    session_details = []

    for session in sessions:
        date_str = session.session_date.strftime("%Y-%m-%d")
        sess_id_str = str(session.id)
        if sess_id_str in attended_session_ids:
            marked_time = attended_records_map[sess_id_str]
            time_str = marked_time.strftime("%I:%M %p") if marked_time else "-"
            if marked_time:
                attended_dates.append(f"{date_str} @ {time_str}")
            else:
                attended_dates.append(date_str)
            session_details.append({"date": date_str, "time_in": time_str, "status": "Present"})
        else:
            missed_dates.append(date_str)
            session_details.append({"date": date_str, "time_in": "-", "status": "Absent"})

    # 2. Forward-Looking Predictive Calculations
    remaining_sessions = max(0, effective_planned - total_held)
    target_sessions_needed_total = math.ceil(0.80 * effective_planned)
    max_attainable_attended = attended_count + remaining_sessions
    max_attainable_percentage = round((max_attainable_attended / effective_planned) * 100, 2)

    sessions_needed = max(0, target_sessions_needed_total - attended_count)
    allowed_absences = remaining_sessions - sessions_needed
    is_disqualified = max_attainable_attended < target_sessions_needed_total

    # Projected final attendance based on attendance frequency / momentum
    if total_held > 0:
        attendance_rate = attended_count / total_held
        projected_attended = attended_count + (attendance_rate * remaining_sessions)
        projected_final_percentage = round((projected_attended / effective_planned) * 100, 2)
    else:
        projected_final_percentage = 100.0

    # Momentum calculation (check last 3 sessions)
    momentum = "stable"
    if total_held >= 2:
        last_sessions = sessions[-3:]
        recent_attended_count = sum(1 for s in last_sessions if str(s.id) in attended_session_ids)
        recent_ratio = recent_attended_count / len(last_sessions)
        if recent_ratio == 1.0:
            momentum = "improving"
        elif recent_ratio <= 0.33:
            momentum = "declining"

    # Risk level & narrative
    if is_disqualified:
        risk_level = "DISQUALIFIED"
        risk_label = "Mathematically Disqualified"
        prediction_summary = (
            f"Already disqualified. Max achievable is {max_attainable_percentage}% even with 100% future attendance."
        )
    elif allowed_absences == 0:
        risk_level = "CRITICAL"
        risk_label = "Critical Risk (Zero Margin)"
        prediction_summary = (
            f"Must attend ALL {remaining_sessions} remaining classes. Any further absence causes immediate exam disqualification."
        )
    elif allowed_absences == 1:
        risk_level = "HIGH_RISK"
        risk_label = "High Risk"
        prediction_summary = (
            f"Allowed only 1 more absence. Must attend at least {sessions_needed} of {remaining_sessions} remaining classes."
        )
    elif allowed_absences == 2:
        risk_level = "MODERATE_RISK"
        risk_label = "Moderate Risk (Watchlist)"
        prediction_summary = (
            f"Allowed up to 2 absences in remaining {remaining_sessions} classes to remain eligible."
        )
    else:
        risk_level = "SAFE"
        risk_label = "On Track (Safe)"
        prediction_summary = (
            f"Comfortable buffer. Can afford up to {allowed_absences} absences and still sit final examinations."
        )

    return {
        "student_id": student_id,
        "student_name": student_name,
        "reg_number": reg_number,
        "email": email,
        "class_id": str(classroom.id),
        "total_sessions": total_held,
        "total_held_sessions": total_held,
        "attended_sessions": attended_count,
        "attendance_percentage": current_pct,
        "current_attendance_percentage": current_pct,
        "status": current_status,
        "current_status": current_status,
        "attended_dates": attended_dates,
        "missed_dates": missed_dates,
        "session_details": session_details,
        "planned_semester_sessions": effective_planned,
        "remaining_sessions": remaining_sessions,
        "max_attainable_percentage": max_attainable_percentage,
        "projected_final_percentage": projected_final_percentage,
        "sessions_needed_for_eligibility": sessions_needed,
        "allowed_absences_remaining": allowed_absences,
        "risk_level": risk_level,
        "risk_label": risk_label,
        "is_mathematically_disqualified": is_disqualified,
        "momentum": momentum,
        "prediction_summary": prediction_summary,
    }


@router.get(
    "/class/{class_id}/predictions",
    response_model=schemas.ClassPredictiveAnalyticsOut
)
def get_class_predictive_analytics(
    class_id: str,
    planned_sessions: int = Query(default=15, ge=1, le=50),
    db: Session = Depends(get_db)
):
    classroom = db.get(models.Class, class_id)
    if not classroom:
        raise HTTPException(status_code=404, detail="Class not found")

    sessions = (
        db.query(models.Session)
        .filter(models.Session.class_id == class_id)
        .order_by(models.Session.session_date.asc())
        .all()
    )

    enrollments = (
        db.query(models.Enrollment)
        .join(models.Student)
        .filter(models.Enrollment.class_id == class_id)
        .order_by(models.Student.reg_number.asc(), models.Student.created_at.asc())
        .all()
    )

    session_ids = [s.id for s in sessions]

    # Batch query all attendance records for this class
    all_attendance_records = []
    if session_ids:
        all_attendance_records = (
            db.query(models.AttendanceRecord)
            .filter(models.AttendanceRecord.session_id.in_(session_ids))
            .all()
        )

    # Group attendance by student
    student_records_map = {}
    for record in all_attendance_records:
        stu_id = str(record.student_id)
        if stu_id not in student_records_map:
            student_records_map[stu_id] = {}
        student_records_map[stu_id][str(record.session_id)] = record.marked_at

    students_predictions = []
    risk_distribution = {
        "SAFE": 0,
        "MODERATE_RISK": 0,
        "HIGH_RISK": 0,
        "CRITICAL": 0,
        "DISQUALIFIED": 0,
    }

    projected_eligible = 0
    at_risk = 0
    critical = 0
    disqualified = 0

    total_current_pct = 0.0
    total_projected_pct = 0.0

    for enrollment in enrollments:
        student = enrollment.student
        if not student:
            continue

        attended_map = student_records_map.get(str(student.id), {})
        pred = _compute_student_prediction(
            student_id=str(student.id),
            student_name=student.name,
            reg_number=student.reg_number,
            email=student.email,
            classroom=classroom,
            sessions=sessions,
            attended_records_map=attended_map,
            planned_sessions=planned_sessions,
        )

        r_level = pred["risk_level"]
        risk_distribution[r_level] = risk_distribution.get(r_level, 0) + 1

        if r_level == "DISQUALIFIED":
            disqualified += 1
        elif r_level == "CRITICAL":
            critical += 1
            at_risk += 1
        elif r_level in ("HIGH_RISK", "MODERATE_RISK"):
            at_risk += 1

        if pred["projected_final_percentage"] >= 80.0 and not pred["is_mathematically_disqualified"]:
            projected_eligible += 1

        total_current_pct += pred["current_attendance_percentage"]
        total_projected_pct += pred["projected_final_percentage"]

        students_predictions.append(pred)

    total_stu = len(students_predictions)
    avg_current = round(total_current_pct / total_stu, 2) if total_stu > 0 else 0.0
    avg_projected = round(total_projected_pct / total_stu, 2) if total_stu > 0 else 0.0

    return {
        "class_id": classroom.id,
        "course_code": classroom.course_code,
        "course_name": classroom.course_name,
        "planned_semester_sessions": max(planned_sessions, len(sessions), 1),
        "sessions_held_count": len(sessions),
        "remaining_sessions_count": max(0, max(planned_sessions, len(sessions), 1) - len(sessions)),
        "total_students": total_stu,
        "projected_eligible_count": projected_eligible,
        "at_risk_count": at_risk,
        "critical_count": critical,
        "disqualified_count": disqualified,
        "average_current_percentage": avg_current,
        "average_projected_percentage": avg_projected,
        "risk_distribution": risk_distribution,
        "students": students_predictions,
    }


@router.get(
    "/{student_id}/{class_id}",
    response_model=schemas.EligibilityOut
)
def calculate_eligibility(
    student_id: str,
    class_id: str,
    planned_sessions: int = Query(default=15, ge=1, le=50),
    db: Session = Depends(get_db)
):
    student = db.get(models.Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    classroom = db.get(models.Class, class_id)
    if not classroom:
        raise HTTPException(status_code=404, detail="Class not found")

    sessions = (
        db.query(models.Session)
        .filter(models.Session.class_id == class_id)
        .order_by(models.Session.session_date.asc())
        .all()
    )

    attended_records = (
        db.query(models.AttendanceRecord)
        .join(models.Session, models.AttendanceRecord.session_id == models.Session.id)
        .filter(
            models.AttendanceRecord.student_id == student_id,
            models.Session.class_id == class_id
        )
        .all()
    )

    attended_records_map = {str(record.session_id): record.marked_at for record in attended_records}

    pred = _compute_student_prediction(
        student_id=str(student.id),
        student_name=student.name,
        reg_number=student.reg_number,
        email=student.email,
        classroom=classroom,
        sessions=sessions,
        attended_records_map=attended_records_map,
        planned_sessions=planned_sessions,
    )

    logger.info(
        f"Predictive eligibility calculated: student={student.reg_number}, class={classroom.course_code}, "
        f"current={pred['current_attendance_percentage']}%, projected={pred['projected_final_percentage']}%, "
        f"risk={pred['risk_level']}"
    )

    return pred