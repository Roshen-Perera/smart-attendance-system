from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app import models
from app.schemas import attendance as schemas

router = APIRouter(
    prefix="/attendance",
    tags=["Attendance"]
)

@router.post("", response_model=schemas.AttendanceOut, status_code=201)
def mark_attendance(
    payload: schemas.AttendanceCreate,
    db: Session = Depends(get_db)
):

    student = db.get(
        models.Student,
        payload.student_id
    )

    if not student:
        raise HTTPException(404, "Student not found")

    session = db.get(
        models.Session,
        payload.session_id
    )

    if not session:
        raise HTTPException(404, "Session not found")

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

    attendance = models.AttendanceRecord(
        **payload.model_dump()
    )

    db.add(attendance)
    db.commit()
    db.refresh(attendance)

    return attendance

@router.get("", response_model=list[schemas.AttendanceOut])
def get_attendance(
    db: Session = Depends(get_db)
):
    return db.query(models.AttendanceRecord).all()

@router.get("/session/{session_id}", response_model=list[schemas.AttendanceOut])
def get_session_attendance(
    session_id: str,
    db: Session = Depends(get_db)
):

    return (
        db.query(models.AttendanceRecord)
        .filter(
            models.AttendanceRecord.session_id == session_id
        )
        .all()
    )

@router.get("/student/{student_id}", response_model=list[schemas.AttendanceOut])
def get_student_attendance(
    student_id: str,
    db: Session = Depends(get_db)
):

    return (
        db.query(models.AttendanceRecord)
        .filter(
            models.AttendanceRecord.student_id == student_id
        )
        .all()
    )

@router.delete("/{attendance_id}", status_code=204)
def delete_attendance(
    attendance_id: str,
    db: Session = Depends(get_db)
):

    attendance = db.get(
        models.AttendanceRecord,
        attendance_id
    )

    if not attendance:
        raise HTTPException(
            404,
            "Attendance record not found"
        )

    db.delete(attendance)
    db.commit()

    return None