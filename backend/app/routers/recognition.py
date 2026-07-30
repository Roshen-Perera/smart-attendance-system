import os
import uuid
import numpy as np
import face_recognition

from typing import Optional
from uuid import UUID

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
    prefix="/recognition",
    tags=["Face Recognition"]
)


@router.post("/recognize")
async def recognize_face(
    file: UploadFile = File(...),
    session_id: Optional[UUID] = None,
    db: Session = Depends(get_db)
):

    # Check session
    if not session_id:
        raise HTTPException(
            status_code=400,
            detail="Session ID is required"
        )


    session = db.get(
        models.Session,
        session_id
    )

    if not session:
        raise HTTPException(
            status_code=404,
            detail="Session not found"
        )


    # Save uploaded image temporarily
    filename = f"temp_{uuid.uuid4()}.jpg"

    contents = await file.read()

    with open(filename, "wb") as f:
        f.write(contents)


    try:

        # Load image
        image = face_recognition.load_image_file(
            filename
        )


        # Generate face encoding
        unknown_faces = face_recognition.face_encodings(
            image
        )


        if not unknown_faces:
            raise HTTPException(
                status_code=400,
                detail="No face found"
            )


        unknown_encoding = unknown_faces[0]


        # Get stored embeddings
        stored_embeddings = (
            db.query(models.FaceEmbedding)
            .all()
        )


        for stored in stored_embeddings:


            stored_encoding = np.array(
                stored.embedding
            )


            matched = face_recognition.compare_faces(
                [stored_encoding],
                unknown_encoding,
                tolerance=0.5
            )


            if matched[0]:


                # Prevent duplicate attendance

                existing = (
                    db.query(
                        models.AttendanceRecord
                    )
                    .filter(
                        models.AttendanceRecord.student_id
                        ==
                        stored.student_id,

                        models.AttendanceRecord.session_id
                        ==
                        session_id
                    )
                    .first()
                )


                if existing:
                    return {
                        "message": "Attendance already marked",
                        "student_id": str(
                            stored.student_id
                        )
                    }



                attendance = models.AttendanceRecord(
                    student_id=stored.student_id,
                    session_id=session_id,
                    confidence_score=0.95
                )


                db.add(attendance)
                db.commit()
                db.refresh(attendance)


                return {
                    "message": "Attendance marked",
                    "student_id": str(
                        stored.student_id
                    ),
                    "attendance_id": str(
                        attendance.id
                    )
                }



        return {
            "message": "Unknown face"
        }


    finally:

        # Remove temporary file
        if os.path.exists(filename):
            os.remove(filename)