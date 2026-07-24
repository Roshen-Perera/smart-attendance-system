from pydantic import BaseModel, EmailStr
from datetime import datetime
from uuid import UUID


class StudentCreate(BaseModel):
    reg_number: str
    name: str
    email: EmailStr | None = None


class StudentUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None


class StudentOut(BaseModel):
    id: UUID
    reg_number: str
    name: str
    email: EmailStr | None
    created_at: datetime

    class Config:
        from_attributes = True

class FaceImageOut(BaseModel):
    id: UUID
    image_path: str
    created_at: datetime

    class Config:
        from_attributes = True    