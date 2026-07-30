from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app import models
from app.schemas import eligibility as schemas

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

    # Count total sessions
    total_sessions = (
        db.query(models.Session)
        .filter(models.Session.class_id == class_id)
        .count()
    )

    # Count attended sessions
    attended_sessions = (
        db.query(models.AttendanceRecord)
        .join(
            models.Session,
            models.AttendanceRecord.session_id == models.Session.id
        )
        .filter(
            models.AttendanceRecord.student_id == student_id,
            models.Session.class_id == class_id
        )
        .count()
    )

    # Calculate percentage
    if total_sessions == 0:
        percentage = 0
    else:
        percentage = (attended_sessions / total_sessions) * 100

    # Determine eligibility
    status = "Eligible" if percentage >= 80 else "Not Eligible"

    # Return result
    return {
        "student_id": student_id,
        "class_id": class_id,
        "total_sessions": total_sessions,
        "attended_sessions": attended_sessions,
        "attendance_percentage": round(percentage, 2),
        "status": status
    }