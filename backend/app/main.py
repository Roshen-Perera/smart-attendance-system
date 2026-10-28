import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from app.db import Base, engine
from app.logger import logger
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs("uploads/faces", exist_ok=True)
    os.makedirs("uploads/temp", exist_ok=True)
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables verified/created successfully.")
    except Exception as e:
        logger.error(f"Database table verification error: {e}")
    yield


app = FastAPI(
    title="AI Smart Attendance API",
    version="1.0.0",
    description="FastAPI Backend for AI-powered Smart Attendance System using Face Recognition",
    lifespan=lifespan
)

cors_origins_env = os.getenv("CORS_ORIGINS")
if cors_origins_env:
    allowed_origins = [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]
else:
    allowed_origins = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:8080"
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
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