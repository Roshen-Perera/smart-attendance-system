from datetime import datetime

from pydantic import BaseModel
from uuid import UUID


class ClassCreate(BaseModel):
    course_code: str
    course_name: str
    lecturer_id: UUID
    schedule_info: str | None = None


class ClassUpdate(BaseModel):
    course_code: str | None = None
    course_name: str | None = None
    lecturer_id: UUID | None = None
    schedule_info: str | None = None


class ClassOut(BaseModel):
    id: UUID
    course_code: str
    course_name: str
    lecturer_id: UUID
    schedule_info: str | None = None
    created_at: datetime

    model_config = {
        "from_attributes": True
    }