from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.student import Student


router = APIRouter(
    prefix="/students",
    tags=["Students"]
)


@router.get("/")
def get_students(db: Session = Depends(get_db)):

    students = db.query(Student).all()

    return students