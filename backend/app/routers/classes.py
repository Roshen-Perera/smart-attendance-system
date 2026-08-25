from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app import models
from app.schemas import class_course as schemas
from app.schemas import session as session_schemas
from app.schemas.student import StudentOut
from app.dependencies import require_lecturer, require_admin
from app.logger import logger

router = APIRouter(
    prefix="/classes",
    tags=["Classes"]
)


@router.post("", response_model=schemas.ClassOut, status_code=201)
def create_class(
    payload: schemas.ClassCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer)
):
    lecturer = db.get(models.Lecturer, payload.lecturer_id)
    if not lecturer:
        raise HTTPException(
            status_code=404,
            detail="Lecturer not found"
        )

    existing = (
        db.query(models.Class)
        .filter(models.Class.course_code == payload.course_code)
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Course code already exists"
        )

    classroom = models.Class(**payload.model_dump())
    db.add(classroom)
    db.commit()
    db.refresh(classroom)
    logger.info(f"Class created: {classroom.course_code} - {classroom.course_name} by user {current_user.email}")
    return classroom


@router.get("", response_model=list[schemas.ClassOut])
def get_classes(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    return db.query(models.Class).offset(skip).limit(limit).all()


@router.get("/{class_id}", response_model=schemas.ClassOut)
def get_class(class_id: str, db: Session = Depends(get_db)):
    classroom = db.get(models.Class, class_id)
    if not classroom:
        raise HTTPException(
            status_code=404,
            detail="Class not found"
        )
    return classroom


@router.get("/{class_id}/students", response_model=list[StudentOut])
def get_class_students(class_id: str, db: Session = Depends(get_db)):
    classroom = db.get(models.Class, class_id)
    if not classroom:
        raise HTTPException(
            status_code=404,
            detail="Class not found"
        )

    enrollments = (
        db.query(models.Enrollment)
        .filter(models.Enrollment.class_id == class_id)
        .all()
    )

    return [enrollment.student for enrollment in enrollments]


@router.get("/{class_id}/sessions", response_model=list[session_schemas.SessionOut])
def get_class_sessions(class_id: str, db: Session = Depends(get_db)):
    classroom = db.get(models.Class, class_id)
    if not classroom:
        raise HTTPException(
            status_code=404,
            detail="Class not found"
        )

    return (
        db.query(models.Session)
        .filter(models.Session.class_id == class_id)
        .order_by(models.Session.session_date.desc())
        .all()
    )


@router.put("/{class_id}", response_model=schemas.ClassOut)
def update_class(
    class_id: str,
    payload: schemas.ClassUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer)
):
    classroom = db.get(models.Class, class_id)
    if not classroom:
        raise HTTPException(
            status_code=404,
            detail="Class not found"
        )

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(classroom, key, value)

    db.commit()
    db.refresh(classroom)
    logger.info(f"Class updated: {classroom.course_code} by user {current_user.email}")
    return classroom


@router.delete("/{class_id}", status_code=204)
def delete_class(
    class_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    classroom = db.get(models.Class, class_id)
    if not classroom:
        raise HTTPException(
            status_code=404,
            detail="Class not found"
        )

    db.delete(classroom)
    db.commit()
    logger.info(f"Class deleted: {class_id} by admin {current_user.email}")
    return None