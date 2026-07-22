from fastapi import FastAPI
from app.db import Base, engine
from app.models import student

app = FastAPI(
    title="Smart Attendance API"
)

@app.get("/")
def root():
    return {
        "message": "Smart Attendance API running"
    }