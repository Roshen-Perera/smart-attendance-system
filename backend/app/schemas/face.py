from datetime import datetime
from pydantic import BaseModel
from uuid import UUID

class FaceImageOut(BaseModel):
    id: UUID
    image_path: str
    student_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True