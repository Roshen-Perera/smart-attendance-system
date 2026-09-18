from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app import models
from app.schemas import eligibility as schemas
from app.logger import logger

router = APIRouter(
    prefix="/eligibility",
    tags=["Eligibility"]
)


@router.get(
    "/{student_id}/{class_id}",
    response_model=schemas.EligibilityOut
)
def calculate_eligibility(
    student_id: str,
    class_id: str,
    db: Session = Depends(get_db)
):

    # Check student
    student = db.get(models.Student, student_id)

    if not student:
        raise HTTPException(
            status_code=404,
            detail="Student not found"
        )

    # Check class
    classroom = db.get(models.Class, class_id)

    if not classroom:
        raise HTTPException(
            status_code=404,
            detail="Class not found"
        )

    # Fetch all sessions for the class ordered by date
    sessions = (
        db.query(models.Session)
        .filter(models.Session.class_id == class_id)
        .order_by(models.Session.session_date.asc())
        .all()
    )
    total_sessions = len(sessions)

    # Fetch attendance records for the student in this class
    attended_records = (
        db.query(models.AttendanceRecord)
        .join(models.Session, models.AttendanceRecord.session_id == models.Session.id)
        .filter(
            models.AttendanceRecord.student_id == student_id,
            models.Session.class_id == class_id
        )
        .all()
    )
    # Create a mapping from session_id to marked_at timestamp
    attended_records_map = {str(record.session_id): record.marked_at for record in attended_records}
    attended_session_ids = set(attended_records_map.keys())
    attended_sessions = len(attended_session_ids)

    attended_dates = []
    missed_dates = []

    for session in sessions:
        date_str = session.session_date.strftime("%Y-%m-%d")
        sess_id_str = str(session.id)
        if sess_id_str in attended_session_ids:
            marked_time = attended_records_map[sess_id_str]
            if marked_time:
                time_str = marked_time.strftime("%I:%M %p")
                attended_dates.append(f"{date_str} @ {time_str}")
            else:
                attended_dates.append(date_str)
        else:
            missed_dates.append(date_str)

    # Calculate percentage
    if total_sessions == 0:
        percentage = 0.0
    else:
        percentage = (attended_sessions / total_sessions) * 100

    # Determine eligibility
    status = "Eligible" if percentage >= 80 else "Not Eligible"

    logger.info(f"Eligibility calculated: student={student.reg_number}, class={classroom.course_code}, percentage={round(percentage, 2)}%, status={status}")

    # Return result
    return {
        "student_id": student_id,
        "class_id": class_id,
        "total_sessions": total_sessions,
        "attended_sessions": attended_sessions,
        "attendance_percentage": round(percentage, 2),
        "status": status,
        "attended_dates": attended_dates,
        "missed_dates": missed_dates
    }