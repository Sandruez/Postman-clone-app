from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..models import History
from ..schemas import HistoryResponse

router = APIRouter(prefix="/history", tags=["History"])

@router.get("", response_model=List[HistoryResponse])
def get_all_history(db: Session = Depends(get_db)):
    return db.query(History).order_by(History.sent_at.desc()).all()

@router.delete("/{id}")
def delete_history_item(id: int, db: Session = Depends(get_db)):
    history_item = db.query(History).filter(History.id == id).first()
    if not history_item:
        raise HTTPException(status_code=404, detail="History item not found")
    
    db.delete(history_item)
    db.commit()
    return {"message": "History item deleted successfully"}

@router.delete("")
def clear_all_history(db: Session = Depends(get_db)):
    db.query(History).delete()
    db.commit()
    return {"message": "All history cleared successfully"}
