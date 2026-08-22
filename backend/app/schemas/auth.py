from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, EmailStr
from typing import Optional


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: Optional[str] = "lecturer"


class UserOut(BaseModel):
    id: UUID
    email: EmailStr
    full_name: str
    role: str
    created_at: datetime

    model_config = {
        "from_attributes": True
    }


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class TokenData(BaseModel):
    user_id: Optional[str] = None
    role: Optional[str] = None
