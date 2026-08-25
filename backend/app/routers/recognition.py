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
from app.logger import logger

router = APIRouter(
    prefix="/recognition",
    tags=["Face Recognition"]
)

TEMP_DIR = "uploads/temp"
MIN_CONFIDENCE = 0.55  # Reject matches below 55% confidence (distance > 0.45)


@router.post("/recognize")
async def recognize_face(
    file: UploadFile = File(...),
    session_id: Optional[UUID] = None,
    db: Session = Depends(get_db)
):
    if not session_id:
        raise HTTPException(
            status_code=400,
            detail="Session ID is required"
        )

    session = db.get(models.Session, session_id)
    if not session:
        raise HTTPException(
            status_code=404,
            detail="Session not found"
        )

    if not session.is_active:
        raise HTTPException(
            status_code=400,
            detail="Session is closed. Attendance cannot be marked."
        )

    os.makedirs(TEMP_DIR, exist_ok=True)
    filename = os.path.join(TEMP_DIR, f"temp_{uuid.uuid4()}.jpg")

    contents = await file.read()
    with open(filename, "wb") as f:
        f.write(contents)

    try:
        image = face_recognition.load_image_file(filename)
        unknown_faces = face_recognition.face_encodings(image)

        if not unknown_faces:
            logger.warning(f"Recognition attempt failed: No face detected in uploaded image for session {session_id}")
            raise HTTPException(
                status_code=400,
                detail="No face detected in the image"
            )

        unknown_encoding = unknown_faces[0]

        # Filter embeddings to students enrolled in this class only
        enrolled_records = (
            db.query(models.Enrollment.student_id)
            .filter(models.Enrollment.class_id == session.class_id)
            .all()
        )
        enrolled_student_ids = [r[0] for r in enrolled_records]

        if not enrolled_student_ids:
            logger.info(f"Recognition attempt for session {session_id}: No students enrolled in class")
            return {
                "message": "No students enrolled in this class"
            }

        stored_embeddings = (
            db.query(models.FaceEmbedding)
            .filter(models.FaceEmbedding.student_id.in_(enrolled_student_ids))
            .all()
        )

        for stored in stored_embeddings:
            stored_encoding = np.array(stored.embedding)

            matched = face_recognition.compare_faces(
                [stored_encoding],
                unknown_encoding,
                tolerance=0.5
            )

            if matched[0]:
                distance = face_recognition.face_distance([stored_encoding], unknown_encoding)[0]
                confidence = round(1.0 - float(distance), 4)

                # Check minimum confidence threshold
                if confidence < MIN_CONFIDENCE:
                    logger.info(f"Match found for student_id={stored.student_id} but confidence ({confidence}) < threshold ({MIN_CONFIDENCE})")
                    continue

                student = db.get(models.Student, stored.student_id)

                # Prevent duplicate attendance
                existing = (
                    db.query(models.AttendanceRecord)
                    .filter(
                        models.AttendanceRecord.student_id == stored.student_id,
                        models.AttendanceRecord.session_id == session_id
                    )
                    .first()
                )

                if existing:
                    logger.info(f"Attendance already marked for student {student.reg_number if student else stored.student_id} in session {session_id}")
                    return {
                        "message": "Attendance already marked",
                        "student_id": str(stored.student_id),
                        "confidence_score": confidence
                    }

                attendance = models.AttendanceRecord(
                    student_id=stored.student_id,
                    session_id=session_id,
                    confidence_score=confidence
                )

                db.add(attendance)
                db.commit()
                db.refresh(attendance)

                logger.info(f"Attendance marked via AI: student={student.reg_number if student else stored.student_id}, session={session_id}, confidence={confidence}")

                return {
                    "message": "Attendance marked successfully",
                    "student_id": str(stored.student_id),
                    "student_name": student.name if student else None,
                    "student_reg_number": student.reg_number if student else None,
                    "attendance_id": str(attendance.id),
                    "confidence_score": confidence
                }

        logger.info(f"Recognition attempt for session {session_id}: Unknown face or low confidence match")
        return {
            "message": "Unknown face or student not enrolled in this class"
        }

    finally:
        if os.path.exists(filename):
            os.remove(filename)