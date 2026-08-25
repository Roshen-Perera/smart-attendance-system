from datetime import datetime
from uuid import UUID
from pydantic import BaseModel


class FaceEmbeddingOut(BaseModel):
    id: UUID
    student_id: UUID
    embedding: list[float]
    created_at: datetime

    model_config = {
        "from_attributes": True
    }