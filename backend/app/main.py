from fastapi import FastAPI

from app.db import Base, engine
from app.routers import students
from app.models import student
from app.routers import faces


Base.metadata.create_all(
    bind=engine
)


app = FastAPI(
    title="AI Smart Attendance API"
)


app.include_router(
    students.router
)

app.include_router(
    faces.router
)

@app.get("/")
def root():
    return {
        "message": "Smart Attendance API running"
    }