import numpy as np
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app import models
from app.schemas import embedding as schemas
from app.dependencies import require_lecturer
from app.logger import logger
from app.face_service import face_service

router = APIRouter(
    prefix="/embeddings",
    tags=["Face Embeddings"]
)


@router.post(
    "/generate/{reg_number:path}",
    response_model=schemas.FaceEmbeddingOut
)
def generate_embedding(
    reg_number: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer)
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

    face_images = (
        db.query(models.FaceImage)
        .filter(models.FaceImage.student_id == student.id)
        .all()
    )

    if not face_images:
        raise HTTPException(
            status_code=400,
            detail="No face image found for this student. Please upload a face image first."
        )

    valid_embeddings = []
    for img in face_images:
        emb = face_service.get_embedding(img.image_path)
        if emb:
            valid_embeddings.append(emb)

    if not valid_embeddings:
        raise HTTPException(
            status_code=400,
            detail="No face detected in any of the student's stored images"
        )

    # Compute high-accuracy aggregate unit embedding across all available student photos
    avg_emb = np.mean(valid_embeddings, axis=0)
    norm = np.linalg.norm(avg_emb)
    if norm > 0:
        avg_emb = avg_emb / norm
    final_embedding = avg_emb.tolist()

    # Clear prior embeddings for this student to keep templates fresh and clean
    db.query(models.FaceEmbedding).filter(models.FaceEmbedding.student_id == student.id).delete()

    face_embedding = models.FaceEmbedding(
        student_id=student.id,
        embedding=final_embedding
    )

    db.add(face_embedding)
    db.commit()
    db.refresh(face_embedding)
    logger.info(f"Face embedding generated for student {reg_number} from {len(valid_embeddings)} photo(s) by user {current_user.email}")

    return face_embedding


@router.get(
    "/{reg_number:path}",
    response_model=List[schemas.FaceEmbeddingOut]
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
            status_code=404,
            detail="Student not found"
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
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer)
):
    embedding = db.get(
        models.FaceEmbedding,
        embedding_id
    )

    if not embedding:
        raise HTTPException(
            status_code=404,
            detail="Embedding not found"
        )

    db.delete(embedding)
    db.commit()
    logger.info(f"Embedding {embedding_id} deleted by user {current_user.email}")

    return None
