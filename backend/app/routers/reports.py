import csv
import io
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.db import get_db
from app import models
from app.dependencies import require_lecturer
from app.logger import logger

router = APIRouter(
    prefix="/reports",
    tags=["Reports"]
)


@router.get("/attendance/class/{class_id}")
def export_class_attendance_csv(
    class_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer)
):
    classroom = db.get(models.Class, class_id)
    if not classroom:
        raise HTTPException(status_code=404, detail="Class not found")

    sessions = (
        db.query(models.Session)
        .filter(models.Session.class_id == class_id)
        .order_by(models.Session.session_date.asc())
        .all()
    )

    enrollments = (
        db.query(models.Enrollment)
        .filter(models.Enrollment.class_id == class_id)
        .all()
    )

    output = io.StringIO()
    writer = csv.writer(output)

    # Header row
    session_headers = [f"Session {s.session_date.strftime('%Y-%m-%d %H:%M')}" for s in sessions]
    writer.writerow(["Reg Number", "Student Name", "Email"] + session_headers + ["Total Attended", "Total Sessions", "Percentage", "Status"])

    total_sessions_count = len(sessions)

    for enrollment in enrollments:
        student = enrollment.student
        if not student:
            continue

        attended_count = 0
        status_row = [student.reg_number, student.name, student.email or ""]

        for sess in sessions:
            record = (
                db.query(models.AttendanceRecord)
                .filter(
                    models.AttendanceRecord.session_id == sess.id,
                    models.AttendanceRecord.student_id == student.id
                )
                .first()
            )
            if record:
                status_row.append("Present")
                attended_count += 1
            else:
                status_row.append("Absent")

        percentage = (attended_count / total_sessions_count * 100) if total_sessions_count > 0 else 0.0
        eligibility = "Eligible" if percentage >= 80.0 else "Not Eligible"

        status_row.extend([attended_count, total_sessions_count, f"{round(percentage, 2)}%", eligibility])
        writer.writerow(status_row)

    output.seek(0)
    filename = f"attendance_report_{classroom.course_code}.csv"
    headers = {"Content-Disposition": f"attachment; filename={filename}"}
    logger.info(f"Class attendance CSV report generated for {classroom.course_code} by user {current_user.email}")
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers=headers)


@router.get("/attendance/session/{session_id}")
def export_session_attendance_csv(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer)
):
    session = db.get(models.Session, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    classroom = session.classroom

    records = (
        db.query(models.AttendanceRecord)
        .filter(models.AttendanceRecord.session_id == session_id)
        .all()
    )

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(["Session ID", "Course Code", "Course Name", "Session Date"])
    writer.writerow([str(session.id), classroom.course_code if classroom else "", classroom.course_name if classroom else "", session.session_date.strftime('%Y-%m-%d %H:%M')])
    writer.writerow([])
    writer.writerow(["Student Reg Number", "Student Name", "Marked At", "Confidence Score"])

    for r in records:
        student = r.student
        writer.writerow([
            student.reg_number if student else "",
            student.name if student else "",
            r.marked_at.strftime('%Y-%m-%d %H:%M:%S'),
            r.confidence_score or "N/A"
        ])

    output.seek(0)
    filename = f"session_attendance_{session_id}.csv"
    headers = {"Content-Disposition": f"attachment; filename={filename}"}
    logger.info(f"Session attendance CSV report generated for session {session_id} by user {current_user.email}")
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers=headers)


@router.get("/analytics/class/{class_id}")
def get_class_analytics(
    class_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer)
):
    classroom = db.get(models.Class, class_id)
    if not classroom:
        raise HTTPException(status_code=404, detail="Class not found")

    sessions = (
        db.query(models.Session)
        .filter(models.Session.class_id == class_id)
        .order_by(models.Session.session_date.asc())
        .all()
    )

    enrollments = (
        db.query(models.Enrollment)
        .filter(models.Enrollment.class_id == class_id)
        .all()
    )

    total_sessions_count = len(sessions)
    total_students = len(enrollments)

    # 1. Trend data: attendance per session
    trend_data = []
    for sess in sessions:
        attended_count = (
            db.query(models.AttendanceRecord)
            .filter(models.AttendanceRecord.session_id == sess.id)
            .count()
        )
        trend_data.append({
            "session_id": str(sess.id),
            "session_date": sess.session_date.isoformat(),
            "topic": f"Session on {sess.session_date.strftime('%Y-%m-%d')}",
            "attended": attended_count,
            "absent": total_students - attended_count
        })

    # 2. Eligibility distribution
    eligible_count = 0
    not_eligible_count = 0

    if total_sessions_count > 0:
        for enrollment in enrollments:
            student_id = enrollment.student_id
            attended_count = (
                db.query(models.AttendanceRecord)
                .join(models.Session, models.AttendanceRecord.session_id == models.Session.id)
                .filter(
                    models.AttendanceRecord.student_id == student_id,
                    models.Session.class_id == class_id
                )
                .count()
            )
            percentage = (attended_count / total_sessions_count) * 100
            if percentage >= 80.0:
                eligible_count += 1
            else:
                not_eligible_count += 1
    else:
        not_eligible_count = total_students

    overall_attendance_percentage = 0.0
    if total_sessions_count > 0 and total_students > 0:
        total_possible_attendance = total_sessions_count * total_students
        total_actual_attendance = sum([t["attended"] for t in trend_data])
        overall_attendance_percentage = (total_actual_attendance / total_possible_attendance) * 100

    return {
        "class_id": str(class_id),
        "course_code": classroom.course_code,
        "course_name": classroom.course_name,
        "total_sessions": total_sessions_count,
        "total_students": total_students,
        "overall_attendance_percentage": round(overall_attendance_percentage, 2),
        "eligibility": {
            "eligible": eligible_count,
            "not_eligible": not_eligible_count
        },
        "trends": trend_data
    }
