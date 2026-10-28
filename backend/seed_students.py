"""
Seed sample students, classes, enrollments, and sessions for development and testing.
"""

from datetime import datetime, timedelta, timezone
from app.db import SessionLocal
from app import models


def seed_students_and_classes():
    db = SessionLocal()
    try:
        # 1. Fetch lecturer
        lecturer = db.query(models.Lecturer).filter(models.Lecturer.email == "lecturer@cinec.edu").first()
        if not lecturer:
            print("Lecturer not found. Please run seed.py first.")
            return

        # 2. Students List
        students_data = [
            {
                "reg_number": "CINEC/IT/2026/001",
                "name": "Kasun Perera",
                "email": "kasun.p@cinec.edu",
                "phone": "+94 77 123 4567",
                "programme": "BSc (Hons) in Software Engineering",
            },
            {
                "reg_number": "CINEC/IT/2026/002",
                "name": "Nipuni Fernando",
                "email": "nipuni.f@cinec.edu",
                "phone": "+94 71 234 5678",
                "programme": "BSc (Hons) in Software Engineering",
            },
            {
                "reg_number": "CINEC/IT/2026/003",
                "name": "Dilan Jayawardena",
                "email": "dilan.j@cinec.edu",
                "phone": "+94 76 345 6789",
                "programme": "BSc (Hons) in Data Science & AI",
            },
            {
                "reg_number": "CINEC/IT/2026/004",
                "name": "Sanduni Wickramasinghe",
                "email": "sanduni.w@cinec.edu",
                "phone": "+94 70 456 7890",
                "programme": "BSc (Hons) in Data Science & AI",
            },
            {
                "reg_number": "CINEC/IT/2026/005",
                "name": "Tharindu Silva",
                "email": "tharindu.s@cinec.edu",
                "phone": "+94 75 567 8901",
                "programme": "BSc (Hons) in Software Engineering",
            },
            {
                "reg_number": "CINEC/IT/2026/006",
                "name": "Amaya Senanayake",
                "email": "amaya.s@cinec.edu",
                "phone": "+94 72 678 9012",
                "programme": "BSc (Hons) in Cyber Security",
            },
            {
                "reg_number": "CINEC/IT/2026/007",
                "name": "Roshen Fernando",
                "email": "roshen.f@cinec.edu",
                "phone": "+94 78 789 0123",
                "programme": "BSc (Hons) in Software Engineering",
            },
            {
                "reg_number": "CINEC/IT/2026/008",
                "name": "Dilki Rathnayake",
                "email": "dilki.r@cinec.edu",
                "phone": "+94 77 890 1234",
                "programme": "BSc (Hons) in Data Science & AI",
            },
        ]

        created_students = []
        for s in students_data:
            existing = db.query(models.Student).filter(models.Student.reg_number == s["reg_number"]).first()
            if not existing:
                student = models.Student(
                    reg_number=s["reg_number"],
                    name=s["name"],
                    email=s["email"],
                    phone=s["phone"],
                    programme=s["programme"],
                )
                db.add(student)
                db.commit()
                db.refresh(student)
                created_students.append(student)
                print(f"Added Student: {student.reg_number} - {student.name}")
            else:
                created_students.append(existing)
                print(f"Student already exists: {existing.reg_number} - {existing.name}")

        # 3. Create Classes
        classes_data = [
            {
                "course_code": "CS301",
                "course_name": "Deep Learning & Computer Vision",
                "schedule_info": "Mondays 09:00 AM - 12:00 PM (Lab 4B)",
            },
            {
                "course_code": "SE204",
                "course_name": "Full-Stack Web Architectures",
                "schedule_info": "Wednesdays 01:00 PM - 04:00 PM (Lecture Hall 2)",
            },
        ]

        created_classes = []
        for c in classes_data:
            existing_cls = db.query(models.Class).filter(models.Class.course_code == c["course_code"]).first()
            if not existing_cls:
                classroom = models.Class(
                    course_code=c["course_code"],
                    course_name=c["course_name"],
                    schedule_info=c["schedule_info"],
                    lecturer_id=lecturer.id,
                )
                db.add(classroom)
                db.commit()
                db.refresh(classroom)
                created_classes.append(classroom)
                print(f"Created Class: {classroom.course_code} - {classroom.course_name}")
            else:
                created_classes.append(existing_cls)
                print(f"Class already exists: {existing_cls.course_code}")

        # 4. Enroll all students in CS301, and first 5 in SE204
        for cls in created_classes:
            target_students = created_students if cls.course_code == "CS301" else created_students[:5]
            for stu in target_students:
                existing_enroll = (
                    db.query(models.Enrollment)
                    .filter(models.Enrollment.class_id == cls.id, models.Enrollment.student_id == stu.id)
                    .first()
                )
                if not existing_enroll:
                    enrollment = models.Enrollment(class_id=cls.id, student_id=stu.id)
                    db.add(enrollment)
            db.commit()
            print(f"Enrolled students in {cls.course_code}")

        # 5. Create Sessions for CS301 (3 past sessions + 1 active session)
        cs301 = next(c for c in created_classes if c.course_code == "CS301")
        existing_sessions = db.query(models.Session).filter(models.Session.class_id == cs301.id).all()

        if not existing_sessions:
            now = datetime.now(timezone.utc)
            sessions_info = [
                {"date": now - timedelta(days=21), "topic": "Introduction to Neural Networks & CNNs", "active": False},
                {"date": now - timedelta(days=14), "topic": "Face Embeddings & ArcFace Metric Learning", "active": False},
                {"date": now - timedelta(days=7), "topic": "Real-Time Object Detection with MediaPipe", "active": False},
                {"date": now, "topic": "Live Facial Recognition Lab", "active": True},
            ]

            created_sessions = []
            for s_info in sessions_info:
                sess = models.Session(
                    class_id=cs301.id,
                    session_date=s_info["date"],
                    topic=s_info["topic"],
                    is_active=s_info["active"],
                )
                db.add(sess)
                db.commit()
                db.refresh(sess)
                created_sessions.append(sess)
                print(f"Created Session: {sess.topic} (Active: {sess.is_active})")

            # 6. Mark Attendance for past sessions (simulate realistic attendance patterns)
            # Session 0: All 8 students attended
            # Session 1: 7 students attended (Sanduni missed)
            # Session 2: 6 students attended (Dilan and Sanduni missed)
            past_sessions = [s for s in created_sessions if not s.is_active]

            for idx, sess in enumerate(past_sessions):
                for s_idx, stu in enumerate(created_students):
                    # Simulate some absences for testing eligibility calculations
                    if idx == 1 and s_idx == 3:
                        continue
                    if idx == 2 and s_idx in (2, 3):
                        continue

                    att = models.AttendanceRecord(
                        session_id=sess.id,
                        student_id=stu.id,
                        marked_at=sess.session_date + timedelta(minutes=10),
                        confidence_score=0.92,
                    )
                    db.add(att)
            db.commit()
            print("Seeded sample attendance records for past sessions.")

        print("\nAll sample students, classes, enrollments, and sessions seeded successfully!")

    finally:
        db.close()


if __name__ == "__main__":
    seed_students_and_classes()
