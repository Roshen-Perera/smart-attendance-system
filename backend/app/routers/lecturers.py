from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db import get_db
from app import models
from app.schemas import lecturer as schemas
from app.dependencies import require_admin
from app.logger import logger

router = APIRouter(
    prefix="/lecturers",
    tags=["Lecturers"]
)


@router.post("", response_model=schemas.LecturerOut, status_code=status.HTTP_201_CREATED)
def create_lecturer(
    payload: schemas.LecturerCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    existing = db.query(models.Lecturer).filter(models.Lecturer.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Lecturer with this email already exists")

    name_val = payload.full_name or payload.name
    if not name_val:
        raise HTTPException(status_code=422, detail="Name is required")

    lecturer = models.Lecturer(
        full_name=name_val,
        email=payload.email,
        department=payload.department
    )
    db.add(lecturer)
    db.commit()
    db.refresh(lecturer)
    logger.info(f"Lecturer created: {lecturer.email} ({lecturer.full_name}) by admin {current_user.email}")
    return lecturer


@router.get("", response_model=list[schemas.LecturerOut])
def get_lecturers(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    return db.query(models.Lecturer).offset(skip).limit(limit).all()


@router.get("/{lecturer_id}", response_model=schemas.LecturerOut)
def get_lecturer(lecturer_id: str, db: Session = Depends(get_db)):
    lecturer = db.query(models.Lecturer).filter(models.Lecturer.id == lecturer_id).first()
    if not lecturer:
        raise HTTPException(status_code=404, detail="Lecturer not found")
    return lecturer


@router.put("/{lecturer_id}", response_model=schemas.LecturerOut)
def update_lecturer(
    lecturer_id: str,
    payload: schemas.LecturerUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    lecturer = db.query(models.Lecturer).filter(models.Lecturer.id == lecturer_id).first()
    if not lecturer:
        raise HTTPException(status_code=404, detail="Lecturer not found")

    data = payload.model_dump(exclude_unset=True)
    name_val = data.pop("name", None)
    if name_val:
        lecturer.full_name = name_val
    if "full_name" in data:
        lecturer.full_name = data.pop("full_name")
    data.pop("employee_id", None)

    for key, value in data.items():
        setattr(lecturer, key, value)

    db.commit()
    db.refresh(lecturer)
    logger.info(f"Lecturer updated: {lecturer.email} by admin {current_user.email}")
    return lecturer


@router.delete("/{lecturer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lecturer(
    lecturer_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    lecturer = db.query(models.Lecturer).filter(models.Lecturer.id == lecturer_id).first()
    if not lecturer:
        raise HTTPException(status_code=404, detail="Lecturer not found")

    db.delete(lecturer)
    db.commit()
    logger.info(f"Lecturer deleted: {lecturer_id} by admin {current_user.email}")
    return None