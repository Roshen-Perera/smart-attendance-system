from datetime import datetime

from pydantic import BaseModel


class EnrollmentCreate(BaseModel):
    student_id: str
    class_id: str


class EnrollmentUpdate(BaseModel):
    student_id: str | None = None
    class_id: str | None = None


class EnrollmentOut(BaseModel):
    id: str
    student_id: str
    class_id: str
    created_at: datetime

    model_config = {
        "from_attributes": True
    }