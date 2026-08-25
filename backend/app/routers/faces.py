import os
import uuid
import face_recognition

from fastapi import (
    APIRouter,
    UploadFile,
    File,
    Depends,
    HTTPException
)

from sqlalchemy.orm import Session

from app.db import get_db
from app import models
from app.schemas import face as face_schema
from app.dependencies import require_lecturer
from app.logger import logger


router = APIRouter(
    prefix="/faces",
    tags=["Faces"]
)


UPLOAD_DIR = "uploads/faces"
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png"}
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/jpg", "image/png"}
MAX_SIZE_BYTES = 5 * 1024 * 1024  # 5MB


@router.post("/upload/{reg_number:path}")
async def upload_face(
    reg_number: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer)
):
    # 0. Validate file extension & content type
    extension = file.filename.split(".")[-1].lower() if file.filename else ""
    if extension not in ALLOWED_EXTENSIONS or (file.content_type and file.content_type.lower() not in ALLOWED_CONTENT_TYPES):
        raise HTTPException(
            status_code=400,
            detail="Only JPG and PNG image files are allowed"
        )

    contents = await file.read()
    if len(contents) > MAX_SIZE_BYTES:
        raise HTTPException(
            status_code=400,
            detail="File size must be under 5MB"
        )

    # 1. Find student
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

    # 2. Create upload folder if missing
    os.makedirs(
        UPLOAD_DIR,
        exist_ok=True
    )

    # 3. Generate unique filename
    filename = f"{uuid.uuid4()}.{extension}"
    file_path = os.path.join(
        UPLOAD_DIR,
        filename
    )

    # 4. Save image
    with open(file_path, "wb") as buffer:
        buffer.write(contents)

    # 5. Validate that a face is detected in the image
    try:
        loaded_image = face_recognition.load_image_file(file_path)
        detected_encodings = face_recognition.face_encodings(loaded_image)
        if not detected_encodings:
            os.remove(file_path)
            raise HTTPException(
                status_code=400,
                detail="No face detected in the uploaded image. Please upload a clear face photo."
            )
    except HTTPException:
        raise
    except Exception as e:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(
            status_code=400,
            detail=f"Could not process image: {str(e)}"
        )

    # 6. Save database record
    face_image = models.FaceImage(
        image_path=file_path,
        student_id=student.id
    )

    db.add(face_image)
    db.commit()
    db.refresh(face_image)

    logger.info(f"Face image uploaded for student {student.reg_number} by user {current_user.email}")

    return {
        "message": "Face image uploaded successfully",
        "reg_number": student.reg_number,
        "image_id": str(face_image.id),
        "image_path": face_image.image_path
    }


@router.get("/{reg_number:path}", response_model=list[face_schema.FaceImageOut])
def get_face_images(
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

    face_images = (
        db.query(models.FaceImage)
        .filter(
            models.FaceImage.student_id == student.id
        )
        .all()
    )

    return face_images