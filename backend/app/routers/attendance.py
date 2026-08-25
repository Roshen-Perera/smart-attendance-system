from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app import models
from app.schemas import attendance as schemas
from app.dependencies import require_lecturer
from app.logger import logger

router = APIRouter(
    prefix="/attendance",
    tags=["Attendance"]
)


@router.post("", response_model=schemas.AttendanceOut, status_code=201)
def mark_attendance(
    payload: schemas.AttendanceCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer)
):
    student = db.get(models.Student, payload.student_id)
    if not student:
        raise HTTPException(404, "Student not found")

    session = db.get(models.Session, payload.session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    if not session.is_active:
        raise HTTPException(400, "Session is closed. Cannot mark attendance.")

    existing = (
        db.query(models.AttendanceRecord)
        .filter(
            models.AttendanceRecord.student_id == payload.student_id,
            models.AttendanceRecord.session_id == payload.session_id
        )
        .first()
    )

    if existing:
        raise HTTPException(
            400,
            "Attendance already marked"
        )

    attendance = models.AttendanceRecord(**payload.model_dump())
    db.add(attendance)
    db.commit()
    db.refresh(attendance)
    logger.info(f"Manual attendance marked: student={student.reg_number}, session={payload.session_id} by user {current_user.email}")

    return attendance


@router.get("", response_model=list[schemas.AttendanceOut])
def get_attendance(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    return db.query(models.AttendanceRecord).offset(skip).limit(limit).all()


@router.get("/session/{session_id}", response_model=list[schemas.AttendanceOut])
def get_session_attendance(
    session_id: str,
    db: Session = Depends(get_db)
):
    return (
        db.query(models.AttendanceRecord)
        .filter(models.AttendanceRecord.session_id == session_id)
        .all()
    )


@router.get("/session/{session_id}/details", response_model=list[schemas.AttendanceDetailOut])
def get_session_attendance_details(
    session_id: str,
    db: Session = Depends(get_db)
):
    session = db.get(models.Session, session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    records = (
        db.query(models.AttendanceRecord)
        .filter(models.AttendanceRecord.session_id == session_id)
        .all()
    )
    return records


@router.get("/student/{student_id}", response_model=list[schemas.AttendanceOut])
def get_student_attendance(
    student_id: str,
    db: Session = Depends(get_db)
):
    return (
        db.query(models.AttendanceRecord)
        .filter(models.AttendanceRecord.student_id == student_id)
        .all()
    )


@router.patch("/{attendance_id}/correct", response_model=schemas.AttendanceOut)
def correct_attendance(
    attendance_id: str,
    new_student_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer)
):
    record = db.get(models.AttendanceRecord, attendance_id)
    if not record:
        raise HTTPException(404, "Attendance record not found")

    student = db.get(models.Student, new_student_id)
    if not student:
        raise HTTPException(404, "Student not found")

    # pyrefly: ignore [bad-assignment]
    record.student_id = new_student_id
    # pyrefly: ignore [bad-assignment]
    record.confidence_score = None  # Manually corrected
    db.commit()
    db.refresh(record)
    logger.info(f"Attendance {attendance_id} corrected to student {student.reg_number} by user {current_user.email}")
    return record


@router.delete("/{attendance_id}", status_code=204)
def delete_attendance(
    attendance_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer)
):
    attendance = db.get(models.AttendanceRecord, attendance_id)
    if not attendance:
        raise HTTPException(
            404,
            "Attendance record not found"
        )

    db.delete(attendance)
    db.commit()
    logger.info(f"Attendance {attendance_id} deleted by user {current_user.email}")
    return None