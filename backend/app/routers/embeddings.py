import random

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import face_recognition

from app.db import get_db
from app import models
from app.schemas import embedding as schemas

router = APIRouter(
    prefix="/embeddings",
    tags=["Face Embeddings"]
)
@router.post(
    "/generate/{reg_number}",
    response_model=schemas.FaceEmbeddingOut
)
def generate_embedding(
    reg_number: str,
    db: Session = Depends(get_db)
):

    student = (
        db.query(models.Student)
        .filter(
            models.Student.reg_number == reg_number
        )
        .first()
    )

    if not student:
        raise HTTPException(
            status_code=404,
            detail="Student not found"
        )

    image = face_recognition.load_image_file(
    "uploads/faces/image.jpg"
)

    encodings = face_recognition.face_encodings(image)


    if not encodings:
        raise HTTPException(
            400,
            "No face detected"
        )


    embedding = encodings[0].tolist()

    face_embedding = models.FaceEmbedding(
        student_id=student.id,
        embedding=embedding
    )

    db.add(face_embedding)
    db.commit()
    db.refresh(face_embedding)

    return face_embedding

@router.get(
    "/{reg_number}",
    response_model=list[schemas.FaceEmbeddingOut]
)
def get_embeddings(
    reg_number: str,
    db: Session = Depends(get_db)
):

    student = (
        db.query(models.Student)
        .filter(
            models.Student.reg_number == reg_number
        )
        .first()
    )

    if not student:
        raise HTTPException(
            404,
            "Student not found"
        )

    return (
        db.query(models.FaceEmbedding)
        .filter(
            models.FaceEmbedding.student_id == student.id
        )
        .all()
    )

@router.delete("/{embedding_id}", status_code=204)
def delete_embedding(
    embedding_id: str,
    db: Session = Depends(get_db)
):

    embedding = db.get(
        models.FaceEmbedding,
        embedding_id
    )

    if not embedding:
        raise HTTPException(
            404,
            "Embedding not found"
        )

    db.delete(embedding)
    db.commit()

    return None

