from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..models import Collection, Request
from ..schemas import CollectionResponse, CollectionCreate, RequestResponse, RequestCreate, RequestUpdate

router = APIRouter(tags=["Collections & Requests"])

# --- Collections CRUD ---

@router.get("/collections", response_model=List[CollectionResponse])
def get_collections(db: Session = Depends(get_db)):
    return db.query(Collection).all()

@router.post("/collections", response_model=CollectionResponse)
def create_collection(payload: CollectionCreate, db: Session = Depends(get_db)):
    db_col = Collection(name=payload.name)
    db.add(db_col)
    db.commit()
    db.refresh(db_col)
    return db_col

@router.put("/collections/{id}", response_model=CollectionResponse)
def rename_collection(id: int, payload: CollectionCreate, db: Session = Depends(get_db)):
    db_col = db.query(Collection).filter(Collection.id == id).first()
    if not db_col:
        raise HTTPException(status_code=404, detail="Collection not found")
    db_col.name = payload.name
    db.commit()
    db.refresh(db_col)
    return db_col

@router.delete("/collections/{id}")
def delete_collection(id: int, db: Session = Depends(get_db)):
    db_col = db.query(Collection).filter(Collection.id == id).first()
    if not db_col:
        raise HTTPException(status_code=404, detail="Collection not found")
    db.delete(db_col)
    db.commit()
    return {"message": "Collection deleted successfully"}

# --- Requests CRUD ---

@router.post("/requests", response_model=RequestResponse)
def save_request(payload: RequestCreate, db: Session = Depends(get_db)):
    # Verify collection exists
    db_col = db.query(Collection).filter(Collection.id == payload.collection_id).first()
    if not db_col:
        raise HTTPException(status_code=404, detail="Parent collection not found")
        
    db_req = Request(
        collection_id=payload.collection_id,
        name=payload.name,
        method=payload.method,
        url=payload.url,
        headers_json=payload.headers_json,
        body_type=payload.body_type,
        body_raw=payload.body_raw,
        body_form_data_json=payload.body_form_data_json,
        body_url_encoded_json=payload.body_url_encoded_json,
        auth_type=payload.auth_type,
        auth_config_json=payload.auth_config_json
    )
    db.add(db_req)
    db.commit()
    db.refresh(db_req)
    return db_req

@router.put("/requests/{id}", response_model=RequestResponse)
def update_request(id: int, payload: RequestUpdate, db: Session = Depends(get_db)):
    db_req = db.query(Request).filter(Request.id == id).first()
    if not db_req:
        raise HTTPException(status_code=404, detail="Request not found")
        
    update_data = payload.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_req, key, value)
        
    db.commit()
    db.refresh(db_req)
    return db_req

@router.delete("/requests/{id}")
def delete_request(id: int, db: Session = Depends(get_db)):
    db_req = db.query(Request).filter(Request.id == id).first()
    if not db_req:
        raise HTTPException(status_code=404, detail="Request not found")
    db.delete(db_req)
    db.commit()
    return {"message": "Request deleted successfully"}
