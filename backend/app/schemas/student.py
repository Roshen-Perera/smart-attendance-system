from pydantic import BaseModel, EmailStr
from datetime import datetime
from uuid import UUID


class StudentCreate(BaseModel):
    reg_number: str
    name: str
    email: EmailStr | None = None
    phone: str | None = None
    programme: str | None = None


class StudentUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    programme: str | None = None


class StudentOut(BaseModel):
    id: UUID
    reg_number: str
    name: str
    email: EmailStr | None
    phone: str | None = None
    programme: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True 