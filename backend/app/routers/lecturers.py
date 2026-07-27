from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app import models
from app.schemas import lecturer as schemas

router = APIRouter(
    prefix="/lecturers",
    tags=["Lecturers"]
)


@router.post("", response_model=schemas.LecturerOut, status_code=status.HTTP_201_CREATED)
def create_lecturer(payload: schemas.LecturerCreate, db: Session = Depends(get_db)):
    existing = db.query(models.Lecturer).filter(models.Lecturer.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Lecturer with this email already exists")

    lecturer = models.Lecturer(**payload.model_dump())
    db.add(lecturer)
    db.commit()
    db.refresh(lecturer)
    return lecturer


@router.get("", response_model=list[schemas.LecturerOut])
def get_lecturers(db: Session = Depends(get_db)):
    return db.query(models.Lecturer).all()


@router.get("/{lecturer_id}", response_model=schemas.LecturerOut)
def get_lecturer(lecturer_id: str, db: Session = Depends(get_db)):
    lecturer = db.query(models.Lecturer).filter(models.Lecturer.id == lecturer_id).first()
    if not lecturer:
        raise HTTPException(status_code=404, detail="Lecturer not found")
    return lecturer


@router.put("/{lecturer_id}", response_model=schemas.LecturerOut)
def update_lecturer(lecturer_id: str, payload: schemas.LecturerUpdate, db: Session = Depends(get_db)):
    lecturer = db.query(models.Lecturer).filter(models.Lecturer.id == lecturer_id).first()
    if not lecturer:
        raise HTTPException(status_code=404, detail="Lecturer not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(lecturer, key, value)

    db.commit()
    db.refresh(lecturer)
    return lecturer


@router.delete("/{lecturer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lecturer(lecturer_id: str, db: Session = Depends(get_db)):
    lecturer = db.query(models.Lecturer).filter(models.Lecturer.id == lecturer_id).first()
    if not lecturer:
        raise HTTPException(status_code=404, detail="Lecturer not found")

    db.delete(lecturer)
    db.commit()
    return None