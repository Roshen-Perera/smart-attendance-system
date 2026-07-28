import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.db import Base, engine
import app.models  # Registers Student, FaceImage, Lecturer, and Class
from app.routers import students, faces, lecturers, classes, enrollments, sessions

Base.metadata.create_all(bind=engine)

app = FastAPI(title="AI Smart Attendance API")

os.makedirs("uploads/faces", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.include_router(students.router)
app.include_router(faces.router)
app.include_router(lecturers.router)
app.include_router(classes.router)
app.include_router(enrollments.router)
app.include_router(sessions.router)

@app.get("/")
def root():
    return {"message": "Smart Attendance API running"}