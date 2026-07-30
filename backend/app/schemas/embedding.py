from datetime import datetime

from pydantic import BaseModel


class FaceEmbeddingOut(BaseModel):
    id: str
    student_id: str
    embedding: list[float]
    created_at: datetime

    model_config = {
        "from_attributes": True
    }