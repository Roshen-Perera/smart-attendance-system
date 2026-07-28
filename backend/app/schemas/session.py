from datetime import datetime
from uuid import UUID
from pydantic import BaseModel


class SessionCreate(BaseModel):
    class_id: UUID
    session_date: datetime


class SessionUpdate(BaseModel):
    session_date: datetime | None = None


class SessionOut(BaseModel):
    id: str
    class_id: str
    session_date: datetime
    created_at: datetime

    model_config = {
        "from_attributes": True
    }