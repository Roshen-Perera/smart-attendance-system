from datetime import datetime
from uuid import UUID
from pydantic import BaseModel
from typing import Optional


class SessionCreate(BaseModel):
    class_id: UUID
    session_date: datetime
    topic: Optional[str] = None
    is_active: bool = True


class SessionUpdate(BaseModel):
    session_date: Optional[datetime] = None
    topic: Optional[str] = None
    is_active: Optional[bool] = None


class SessionOut(BaseModel):
    id: UUID
    class_id: UUID
    session_date: datetime
    topic: Optional[str] = None
    is_active: bool
    created_at: datetime

    model_config = {
        "from_attributes": True
    }