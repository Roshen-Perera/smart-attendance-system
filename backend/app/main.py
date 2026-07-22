from fastapi import FastAPI

app = FastAPI(
    title="Smart Attendance API"
)

@app.get("/")
def root():
    return {
        "message": "Smart Attendance API running"
    }