import os
import uuid

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


router = APIRouter(
    prefix="/faces",
    tags=["Faces"]
)


UPLOAD_DIR = "uploads/faces"


@router.post("/upload/{reg_number}")
async def upload_face(
    reg_number: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):

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

    extension = file.filename.split(".")[-1]

    filename = f"{uuid.uuid4()}.{extension}"

    file_path = os.path.join(
        UPLOAD_DIR,
        filename
    )


    # 4. Save image

    contents = await file.read()

    with open(file_path, "wb") as buffer:
        buffer.write(contents)



    # 5. Save database record

    face_image = models.FaceImage(
        image_path=file_path,
        student_id=student.id
    )


    db.add(face_image)

    db.commit()

    db.refresh(face_image)


    return {
        "message": "Face image uploaded successfully",
        "reg_number": student.reg_number,
        "image_id": str(face_image.id),
        "image_path": face_image.image_path
    }