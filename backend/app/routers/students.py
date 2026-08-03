from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app import models
from app.schemas import student as schemas

router = APIRouter(
    prefix="/students",
    tags=["Students"]
)

@router.post("", response_model=schemas.StudentOut, status_code=201)
def create_student(payload: schemas.StudentCreate, db: Session = Depends(get_db)):
    # Keep reg_number here to ensure we don't create duplicate registration numbers
    existing_student = (db.query(models.Student).filter(models.Student.reg_number == payload.reg_number).first())
    if existing_student:
        raise HTTPException(status_code=400, detail="Student with this registration number already exists")

    student = models.Student(**payload.model_dump())
    db.add(student)
    db.commit()
    db.refresh(student)
    return student

@router.get("", response_model=list[schemas.StudentOut])
def get_students(db: Session = Depends(get_db)):
    students = (db.query(models.Student).all())
    return students

# CHANGED: Now uses {student_id} instead of {reg_number}
@router.get("/{student_id}", response_model=schemas.StudentOut)
def get_student(student_id: str, db: Session = Depends(get_db)):
    student = (db.query(models.Student).filter(models.Student.id == student_id).first())
    if not student:
        raise HTTPException(404, "Student not found")
    return student

# CHANGED: Now uses {student_id} instead of {reg_number}
@router.put("/{student_id}", response_model=schemas.StudentOut)
def update_student(student_id: str, payload: schemas.StudentUpdate, db: Session = Depends(get_db)):
    student = (db.query(models.Student).filter(models.Student.id == student_id).first())
    if not student:
        raise HTTPException(404, "Student not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(student, key, value)

    db.commit()
    db.refresh(student)
    return student

# CHANGED: Now uses {student_id} instead of {reg_number}
@router.delete("/{student_id}", status_code=204)
def delete_student(student_id: str, db: Session = Depends(get_db)):
    student = (db.query(models.Student).filter(models.Student.id == student_id).first())
    if not student:
        raise HTTPException(404, "Student not found")

    db.delete(student)
    db.commit()
    return None