"""
Database seeder for AI Smart Attendance System.
Creates initial admin and lecturer accounts for development and testing.
"""

from app.db import SessionLocal
from app import models
from app.auth import get_password_hash


def seed_data():
    db = SessionLocal()
    try:
        # 1. Admin Account
        admin_email = "admin@cinec.edu"
        admin = db.query(models.User).filter(models.User.email == admin_email).first()
        if not admin:
            admin = models.User(
                email=admin_email,
                full_name="CINEC System Administrator",
                hashed_password=get_password_hash("Admin@123"),
                role="admin"
            )
            db.add(admin)
            print(f"Created Admin account: {admin_email} / Admin@123")
        else:
            print(f"Admin account already exists: {admin_email}")

        # 2. Lecturer Account
        lecturer_email = "lecturer@cinec.edu"
        lecturer_user = db.query(models.User).filter(models.User.email == lecturer_email).first()
        if not lecturer_user:
            lecturer_user = models.User(
                email=lecturer_email,
                full_name="Dr. Alan Turing",
                hashed_password=get_password_hash("Lecturer@123"),
                role="lecturer"
            )
            db.add(lecturer_user)
            db.commit()
            db.refresh(lecturer_user)
            print(f"Created Lecturer user account: {lecturer_email} / Lecturer@123")
        else:
            print(f"Lecturer user account already exists: {lecturer_email}")

        # 3. Lecturer Profile
        lecturer_profile = db.query(models.Lecturer).filter(models.Lecturer.email == lecturer_email).first()
        if not lecturer_profile:
            lecturer_profile = models.Lecturer(
                full_name="Dr. Alan Turing",
                email=lecturer_email,
                department="Computer Science & AI",
                employee_id="LEC-1001",
                user_id=lecturer_user.id
            )
            db.add(lecturer_profile)
            print("Created Lecturer profile for Dr. Alan Turing (CS & AI)")
        else:
            lecturer_profile.user_id = lecturer_user.id
            lecturer_profile.employee_id = lecturer_profile.employee_id or "LEC-1001"
            print("Linked existing Lecturer profile to User ID")

        db.commit()
        print("\nDatabase seeded successfully!")
        print("You can log in with:")
        print("  - Admin:    admin@cinec.edu    / Admin@123")
        print("  - Lecturer: lecturer@cinec.edu / Lecturer@123")
    finally:
        db.close()


if __name__ == "__main__":
    seed_data()
