from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app import models
from app.schemas import student as schemas
from app.schemas.class_course import ClassOut
from app.dependencies import require_lecturer, require_admin
from app.logger import logger

router = APIRouter(
    prefix="/students",
    tags=["Students"]
)


@router.post("", response_model=schemas.StudentOut, status_code=201)
def create_student(
    payload: schemas.StudentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer)
):
    existing_student = (
        db.query(models.Student)
        .filter(models.Student.reg_number == payload.reg_number)
        .first()
    )
    if existing_student:
        raise HTTPException(
            status_code=400,
            detail="Student with this registration number already exists"
        )

    student = models.Student(**payload.model_dump())
    db.add(student)
    db.commit()
    db.refresh(student)
    logger.info(f"Student created: {student.reg_number} ({student.name}) by user {current_user.email}")
    return student


@router.get("", response_model=list[schemas.StudentOut])
def get_students(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    return db.query(models.Student).offset(skip).limit(limit).all()


@router.get("/{student_id}", response_model=schemas.StudentOut)
def get_student(student_id: str, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(404, "Student not found")
    return student


@router.get("/{student_id}/classes", response_model=list[ClassOut])
def get_student_classes(student_id: str, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(404, "Student not found")

    enrollments = (
        db.query(models.Enrollment)
        .filter(models.Enrollment.student_id == student_id)
        .all()
    )
    return [enrollment.classroom for enrollment in enrollments]


@router.put("/{student_id}", response_model=schemas.StudentOut)
def update_student(
    student_id: str,
    payload: schemas.StudentUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer)
):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(404, "Student not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(student, key, value)

    db.commit()
    db.refresh(student)
    logger.info(f"Student updated: {student.reg_number} by user {current_user.email}")
    return student


@router.delete("/{student_id}", status_code=204)
def delete_student(
    student_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(404, "Student not found")

    db.delete(student)
    db.commit()
    logger.info(f"Student deleted: {student_id} by admin {current_user.email}")
    return None