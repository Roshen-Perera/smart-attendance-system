from datetime import datetime
from uuid import UUID
from pydantic import BaseModel


class EnrollmentCreate(BaseModel):
    student_id: UUID
    class_id: UUID


class EnrollmentUpdate(BaseModel):
    student_id: UUID | None = None
    class_id: UUID | None = None


class EnrollmentOut(BaseModel):
    id: UUID
    student_id: UUID
    class_id: UUID
    created_at: datetime

    model_config = {
        "from_attributes": True
    }