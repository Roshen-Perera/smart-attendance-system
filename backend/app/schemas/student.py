from pydantic import BaseModel, EmailStr
from datetime import datetime


class StudentCreate(BaseModel):
    reg_number: str
    name: str
    email: EmailStr | None = None


class StudentOut(BaseModel):
    id: int
    reg_number: str
    name: str
    email: EmailStr | None
    created_at: datetime

    class Config:
        from_attributes = True