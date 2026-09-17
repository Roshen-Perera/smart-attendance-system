import os
import uuid
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
from app.face_service import face_service

router = APIRouter(
    prefix="/recognition",
    tags=["Face Recognition"]
)

TEMP_DIR = "uploads/temp"
SIMILARITY_THRESHOLD = 0.50  # Cosine similarity threshold for ArcFace match (0.0 to 1.0)


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
        # Extract 512-d embedding using InsightFace
        unknown_embedding = face_service.get_embedding(filename)

        if not unknown_embedding:
            logger.warning(f"Recognition attempt failed: No face detected in uploaded image for session {session_id}")
            raise HTTPException(
                status_code=400,
                detail="No face detected in the image. Please ensure your face is clearly visible."
            )

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

        best_student_id = None
        best_confidence = -1.0

        for stored in stored_embeddings:
            score = face_service.compute_similarity(stored.embedding, unknown_embedding)
            if score > best_confidence:
                best_confidence = score
                best_student_id = stored.student_id

        # Check if best match satisfies threshold
        if best_student_id is not None and best_confidence >= SIMILARITY_THRESHOLD:
            student = db.get(models.Student, best_student_id)

            # Prevent duplicate attendance
            existing = (
                db.query(models.AttendanceRecord)
                .filter(
                    models.AttendanceRecord.student_id == best_student_id,
                    models.AttendanceRecord.session_id == session_id
                )
                .first()
            )

            if existing:
                logger.info(f"Attendance already marked for student {student.reg_number if student else best_student_id} in session {session_id}")
                return {
                    "message": "Attendance already marked",
                    "student_id": str(best_student_id),
                    "confidence_score": best_confidence
                }

            attendance = models.AttendanceRecord(
                student_id=best_student_id,
                session_id=session_id,
                confidence_score=best_confidence
            )

            db.add(attendance)
            db.commit()
            db.refresh(attendance)

            logger.info(f"Attendance marked via AI: student={student.reg_number if student else best_student_id}, session={session_id}, confidence={best_confidence}")

            return {
                "message": "Attendance marked successfully",
                "student_id": str(best_student_id),
                "student_name": student.name if student else None,
                "student_reg_number": student.reg_number if student else None,
                "attendance_id": str(attendance.id),
                "confidence_score": best_confidence
            }

        logger.info(f"Recognition attempt for session {session_id}: Unknown face or low confidence match (best_score={best_confidence})")
        return {
            "message": "Unknown face or student not enrolled in this class"
        }

    finally:
        if os.path.exists(filename):
            os.remove(filename)


@router.post("/recognize-multi")
async def recognize_multiple_faces(
    file: UploadFile = File(...),
    session_id: Optional[UUID] = None,
    db: Session = Depends(get_db)
):
    """
    Process an image containing one or more faces simultaneously.
    Tracks, identifies, and marks attendance for all recognized students in the frame at once.
    """
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
    filename = os.path.join(TEMP_DIR, f"temp_multi_{uuid.uuid4()}.jpg")

    contents = await file.read()
    with open(filename, "wb") as f:
        f.write(contents)

    try:
        faces_data = face_service.get_all_faces_with_embeddings(filename)
        if not faces_data:
            return {
                "total_faces": 0,
                "recognized_count": 0,
                "newly_marked_count": 0,
                "faces": []
            }

        # Filter embeddings to students enrolled in this class only
        enrolled_records = (
            db.query(models.Enrollment.student_id)
            .filter(models.Enrollment.class_id == session.class_id)
            .all()
        )
        enrolled_student_ids = [r[0] for r in enrolled_records]
        if not enrolled_student_ids:
            return {
                "total_faces": len(faces_data),
                "recognized_count": 0,
                "newly_marked_count": 0,
                "faces": [{"bbox": f["bbox"], "status": "unrecognized", "confidence_score": 0.0} for f in faces_data],
                "message": "No students enrolled in this class"
            }

        stored_embeddings = (
            db.query(models.FaceEmbedding)
            .filter(models.FaceEmbedding.student_id.in_(enrolled_student_ids))
            .all()
        )

        # Get all existing attendance records for this session
        existing_records = (
            db.query(models.AttendanceRecord.student_id)
            .filter(models.AttendanceRecord.session_id == session_id)
            .all()
        )
        already_marked_ids = set(r[0] for r in existing_records)

        # Load student details lookup map
        students_map = {
            s.id: s
            for s in db.query(models.Student).filter(models.Student.id.in_(enrolled_student_ids)).all()
        }

        results = []
        newly_marked_count = 0
        recognized_count = 0

        for face_info in faces_data:
            unknown_emb = face_info["embedding"]
            bbox = face_info["bbox"]
            det_score = face_info["det_score"]

            best_student_id = None
            best_confidence = -1.0

            for stored in stored_embeddings:
                score = face_service.compute_similarity(stored.embedding, unknown_emb)
                if score > best_confidence:
                    best_confidence = score
                    best_student_id = stored.student_id

            if best_student_id is not None and best_confidence >= SIMILARITY_THRESHOLD:
                student = students_map.get(best_student_id)
                recognized_count += 1

                if best_student_id in already_marked_ids:
                    results.append({
                        "bbox": bbox,
                        "det_score": det_score,
                        "status": "already_marked",
                        "student_id": str(best_student_id),
                        "student_name": student.name if student else None,
                        "student_reg_number": student.reg_number if student else None,
                        "confidence_score": best_confidence
                    })
                else:
                    # Mark attendance in database
                    attendance = models.AttendanceRecord(
                        student_id=best_student_id,
                        session_id=session_id,
                        confidence_score=best_confidence
                    )
                    db.add(attendance)
                    db.commit()
                    db.refresh(attendance)
                    already_marked_ids.add(best_student_id)
                    newly_marked_count += 1

                    logger.info(
                        f"Attendance marked via AI Multi-Scan: student={student.reg_number if student else best_student_id}, session={session_id}, confidence={best_confidence}"
                    )

                    results.append({
                        "bbox": bbox,
                        "det_score": det_score,
                        "status": "newly_marked",
                        "student_id": str(best_student_id),
                        "student_name": student.name if student else None,
                        "student_reg_number": student.reg_number if student else None,
                        "confidence_score": best_confidence,
                        "attendance_id": str(attendance.id)
                    })
            else:
                results.append({
                    "bbox": bbox,
                    "det_score": det_score,
                    "status": "unrecognized",
                    "confidence_score": max(0.0, best_confidence)
                })

        return {
            "total_faces": len(faces_data),
            "recognized_count": recognized_count,
            "newly_marked_count": newly_marked_count,
            "faces": results
        }
    finally:
        if os.path.exists(filename):
            os.remove(filename)