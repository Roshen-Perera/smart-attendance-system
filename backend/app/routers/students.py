from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app import models
from app.schemas import student as schemas


router = APIRouter(
    prefix="/students",
    tags=["Students"]
)


@router.post(
    "",
    response_model=schemas.StudentOut,
    status_code=201
)
def create_student(
    payload: schemas.StudentCreate,
    db: Session = Depends(get_db)
):

    existing_student = (
        db.query(models.Student)
        .filter(
            models.Student.reg_number == payload.reg_number
        )
        .first()
    )

    if existing_student:
        raise HTTPException(
            status_code=400,
            detail="Student with this registration number already exists"
        )


    student = models.Student(
        **payload.model_dump()
    )

    db.add(student)
    db.commit()
    db.refresh(student)

    return student


@router.get(
    "",
    response_model=list[schemas.StudentOut]
)
def get_students(
    db: Session = Depends(get_db)
):

    students = (
        db.query(models.Student)
        .all()
    )

    return students