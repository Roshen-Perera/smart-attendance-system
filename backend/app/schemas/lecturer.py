from datetime import datetime
from pydantic import BaseModel, EmailStr, model_validator
from typing import Optional
from uuid import UUID


class LecturerCreate(BaseModel):
    name: Optional[str] = None
    full_name: Optional[str] = None
    email: EmailStr
    department: Optional[str] = None
    employee_id: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def resolve_name(cls, data: any):
        if isinstance(data, dict):
            val = data.get("name") or data.get("full_name")
            if val:
                data["full_name"] = val
                data["name"] = val
        return data


class LecturerUpdate(BaseModel):
    name: Optional[str] = None
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    department: Optional[str] = None
    employee_id: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def resolve_name(cls, data: any):
        if isinstance(data, dict):
            val = data.get("name") or data.get("full_name")
            if val:
                data["full_name"] = val
                data["name"] = val
        return data


class LecturerOut(BaseModel):
    id: UUID
    full_name: str
    name: Optional[str] = None
    email: EmailStr
    department: Optional[str] = None
    created_at: datetime

    @model_validator(mode="before")
    @classmethod
    def set_name_field(cls, data: any):
        if hasattr(data, "full_name"):
            name_val = getattr(data, "full_name")
            setattr(data, "name", name_val)
        elif isinstance(data, dict):
            data["name"] = data.get("name") or data.get("full_name")
        return data

    class Config:
        from_attributes = True