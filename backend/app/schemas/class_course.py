from datetime import datetime

from pydantic import BaseModel


class ClassCreate(BaseModel):
    course_code: str
    course_name: str
    lecturer_id: str


class ClassUpdate(BaseModel):
    course_code: str | None = None
    course_name: str | None = None
    lecturer_id: str | None = None


class ClassOut(BaseModel):
    id: str
    course_code: str
    course_name: str
    lecturer_id: str
    created_at: datetime

    model_config = {
        "from_attributes": True
    }