import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.db import Base, engine
import app.models  # Imports ALL models so Base creates all database tables
from app.routers import students, faces

Base.metadata.create_all(bind=engine)

app = FastAPI(title="AI Smart Attendance API")

# Serve uploaded files over HTTP (e.g. http://localhost:8000/uploads/faces/...)
os.makedirs("uploads/faces", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.include_router(students.router)
app.include_router(faces.router)

@app.get("/")
def root():
    return {"message": "Smart Attendance API running"}