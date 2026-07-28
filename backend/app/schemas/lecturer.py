from datetime import datetime
from pydantic import BaseModel, EmailStr
from uuid import UUID

class LecturerCreate(BaseModel):
    full_name: str
    email: EmailStr
    department: str | None = None


class LecturerUpdate(BaseModel):
    full_name: str | None = None
    email: EmailStr | None = None
    department: str | None = None


class LecturerOut(BaseModel):
    id: UUID
    full_name: str
    email: EmailStr
    department: str | None
    created_at: datetime

    class Config:
        from_attributes = True