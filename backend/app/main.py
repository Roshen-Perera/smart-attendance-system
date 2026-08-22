import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from app.db import Base, engine
import app.models  # Registers all SQLAlchemy models
from app.routers import (
    auth,
    students,
    faces,
    lecturers,
    classes,
    enrollments,
    sessions,
    attendance,
    eligibility,
    embeddings,
    recognition,
    reports
)

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AI Smart Attendance API",
    version="1.0.0",
    description="FastAPI Backend for AI-powered Smart Attendance System using Face Recognition"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("uploads/faces", exist_ok=True)
os.makedirs("uploads/temp", exist_ok=True)

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Mount Routers
app.include_router(auth.router)
app.include_router(students.router)
app.include_router(faces.router)
app.include_router(lecturers.router)
app.include_router(classes.router)
app.include_router(enrollments.router)
app.include_router(sessions.router)
app.include_router(attendance.router)
app.include_router(eligibility.router)
app.include_router(embeddings.router)
app.include_router(recognition.router)
app.include_router(reports.router)


@app.get("/")
def root():
    return {
        "message": "AI Smart Attendance API is running",
        "docs": "/docs",
        "status": "healthy"
    }