from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app import models
from app.schemas import enrollment as schemas
from app.dependencies import require_lecturer
from app.logger import logger

router = APIRouter(prefix="/enrollments", tags=["Enrollments"])


@router.post("", response_model=schemas.EnrollmentOut, status_code=201)
def create_enrollment(
    payload: schemas.EnrollmentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer)
):
    student = db.get(models.Student, payload.student_id)
    if not student:
        raise HTTPException(404, "Student not found")

    classroom = db.get(models.Class, payload.class_id)
    if not classroom:
        raise HTTPException(404, "Class not found")

    existing = (
        db.query(models.Enrollment)
        .filter(
            models.Enrollment.student_id == payload.student_id,
            models.Enrollment.class_id == payload.class_id,
        )
        .first()
    )

    if existing:
        raise HTTPException(
            400,
            "Student is already enrolled in this class"
        )

    enrollment = models.Enrollment(**payload.model_dump())

    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)
    logger.info(f"Student {student.reg_number} enrolled in class {classroom.course_code} by user {current_user.email}")

    return enrollment


@router.get("", response_model=list[schemas.EnrollmentOut])
def get_enrollments(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    return db.query(models.Enrollment).offset(skip).limit(limit).all()


@router.get("/{enrollment_id}", response_model=schemas.EnrollmentOut)
def get_enrollment(
    enrollment_id: str,
    db: Session = Depends(get_db)
):
    enrollment = db.get(models.Enrollment, enrollment_id)
    if not enrollment:
        raise HTTPException(404, "Enrollment not found")

    return enrollment


@router.delete("/{enrollment_id}", status_code=204)
def delete_enrollment(
    enrollment_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer)
):
    enrollment = db.get(models.Enrollment, enrollment_id)
    if not enrollment:
        raise HTTPException(404, "Enrollment not found")

    db.delete(enrollment)
    db.commit()
    logger.info(f"Enrollment {enrollment_id} deleted by user {current_user.email}")

    return None