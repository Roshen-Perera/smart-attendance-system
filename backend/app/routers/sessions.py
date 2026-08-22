from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app import models
from app.schemas import session as schemas

router = APIRouter(
    prefix="/sessions",
    tags=["Sessions"]
)


@router.post("", response_model=schemas.SessionOut, status_code=201)
def create_session(
    payload: schemas.SessionCreate,
    db: Session = Depends(get_db)
):
    classroom = db.get(models.Class, payload.class_id)
    if not classroom:
        raise HTTPException(
            status_code=404,
            detail="Class not found"
        )

    session = models.Session(**payload.model_dump())
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.get("", response_model=list[schemas.SessionOut])
def get_sessions(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    class_id: str | None = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.Session)
    if class_id:
        query = query.filter(models.Session.class_id == class_id)
    return query.offset(skip).limit(limit).all()


@router.get("/{session_id}", response_model=schemas.SessionOut)
def get_session(
    session_id: str,
    db: Session = Depends(get_db)
):
    session = db.get(models.Session, session_id)
    if not session:
        raise HTTPException(
            status_code=404,
            detail="Session not found"
        )
    return session


@router.put("/{session_id}", response_model=schemas.SessionOut)
def update_session(
    session_id: str,
    payload: schemas.SessionUpdate,
    db: Session = Depends(get_db)
):
    session = db.get(models.Session, session_id)
    if not session:
        raise HTTPException(
            status_code=404,
            detail="Session not found"
        )

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(session, key, value)

    db.commit()
    db.refresh(session)
    return session


@router.patch("/{session_id}/close", response_model=schemas.SessionOut)
def close_session(
    session_id: str,
    db: Session = Depends(get_db)
):
    session = db.get(models.Session, session_id)
    if not session:
        raise HTTPException(
            status_code=404,
            detail="Session not found"
        )

    session.is_active = False
    db.commit()
    db.refresh(session)
    return session


@router.delete("/{session_id}", status_code=204)
def delete_session(
    session_id: str,
    db: Session = Depends(get_db)
):
    session = db.get(models.Session, session_id)
    if not session:
        raise HTTPException(
            status_code=404,
            detail="Session not found"
        )

    db.delete(session)
    db.commit()
    return None