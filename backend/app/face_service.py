import os
import cv2
import numpy as np
from typing import Optional, List, Union
from insightface.app import FaceAnalysis
from app.logger import logger

class FaceService:
    _instance: Optional['FaceService'] = None

    def __init__(self):
        logger.info("Initializing InsightFace FaceAnalysis app (buffalo_l)...")
        # ctx_id=-1 for CPU, 0 for GPU
        # providers can default to CPUExecutionProvider for universal compatibility
        self.app = FaceAnalysis(
            name="buffalo_l",
            allowed_modules=['detection', 'recognition'],
            providers=['CPUExecutionProvider']
        )
        self.app.prepare(ctx_id=-1, det_size=(640, 640))
        logger.info("InsightFace FaceAnalysis app initialized successfully.")

    @classmethod
    def get_instance(cls) -> 'FaceService':
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _read_image(self, image_input: Union[str, bytes, np.ndarray]) -> Optional[np.ndarray]:
        """Convert various input types (file path, raw bytes, or numpy array) to a BGR numpy image for OpenCV."""
        if isinstance(image_input, np.ndarray):
            return image_input
        elif isinstance(image_input, str):
            if not os.path.exists(image_input):
                logger.error(f"Image path does not exist: {image_input}")
                return None
            img = cv2.imread(image_input)
            return img
        elif isinstance(image_input, (bytes, bytearray)):
            np_arr = np.frombuffer(image_input, np.uint8)
            img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
            return img
        return None

    def detect_faces(self, image_input: Union[str, bytes, np.ndarray]):
        """Run face detection and recognition on the input image."""
        img = self._read_image(image_input)
        if img is None:
            return []
        return self.app.get(img)

    def has_face(self, image_input: Union[str, bytes, np.ndarray]) -> bool:
        """Check whether at least one face exists in the image."""
        faces = self.detect_faces(image_input)
        return len(faces) > 0

    def get_embedding(self, image_input: Union[str, bytes, np.ndarray]) -> Optional[List[float]]:
        """Extract a 512-d normalized face embedding from the primary (or largest) detected face."""
        faces = self.detect_faces(image_input)
        if not faces:
            return None
        
        # If multiple faces detected, pick the largest one by bounding box area
        if len(faces) > 1:
            faces = sorted(
                faces,
                key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]),
                reverse=True
            )
        
        embedding = faces[0].embedding
        # Normalize embedding to unit length
        norm = np.linalg.norm(embedding)
        if norm > 0:
            embedding = embedding / norm
        return embedding.tolist()

    @staticmethod
    def compute_similarity(emb1: Union[List[float], np.ndarray], emb2: Union[List[float], np.ndarray]) -> float:
        """
        Compute cosine similarity between two face embeddings.
        Returns a score between -1.0 and 1.0 (typically 0.0 to 1.0 for faces).
        """
        vec1 = np.array(emb1, dtype=np.float32)
        vec2 = np.array(emb2, dtype=np.float32)

        norm1 = np.linalg.norm(vec1)
        norm2 = np.linalg.norm(vec2)

        if norm1 == 0 or norm2 == 0:
            return 0.0

        similarity = float(np.dot(vec1, vec2) / (norm1 * norm2))
        return round(similarity, 4)


face_service = FaceService.get_instance()
