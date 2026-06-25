from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..models import Environment, Variable
from ..schemas import EnvironmentResponse, EnvironmentCreate, VariableCreate

router = APIRouter(prefix="/environments", tags=["Environments"])

@router.get("", response_model=List[EnvironmentResponse])
def get_environments(db: Session = Depends(get_db)):
    return db.query(Environment).all()

@router.post("", response_model=EnvironmentResponse)
def create_environment(payload: EnvironmentCreate, db: Session = Depends(get_db)):
    db_env = Environment(name=payload.name)
    db.add(db_env)
    db.commit()
    db.refresh(db_env)
    
    # Save variables if provided
    if payload.variables:
        for v in payload.variables:
            db_var = Variable(environment_id=db_env.id, key=v.key, value=v.value)
            db.add(db_var)
        db.commit()
        db.refresh(db_env)
        
    return db_env

@router.put("/{id}", response_model=EnvironmentResponse)
def rename_environment(id: int, payload: EnvironmentCreate, db: Session = Depends(get_db)):
    db_env = db.query(Environment).filter(Environment.id == id).first()
    if not db_env:
        raise HTTPException(status_code=404, detail="Environment not found")
    
    db_env.name = payload.name
    db.commit()
    db.refresh(db_env)
    return db_env

@router.delete("/{id}")
def delete_environment(id: int, db: Session = Depends(get_db)):
    db_env = db.query(Environment).filter(Environment.id == id).first()
    if not db_env:
        raise HTTPException(status_code=404, detail="Environment not found")
    
    db.delete(db_env)
    db.commit()
    return {"message": "Environment deleted successfully"}

@router.put("/{id}/variables", response_model=EnvironmentResponse)
def save_environment_variables(id: int, variables: List[VariableCreate], db: Session = Depends(get_db)):
    db_env = db.query(Environment).filter(Environment.id == id).first()
    if not db_env:
        raise HTTPException(status_code=404, detail="Environment not found")
    
    # Delete existing variables
    db.query(Variable).filter(Variable.environment_id == id).delete()
    
    # Add new variables
    for v in variables:
        # Ignore empty/incomplete entries if needed, but let's save what is given
        db_var = Variable(environment_id=id, key=v.key, value=v.value)
        db.add(db_var)
        
    db.commit()
    db.refresh(db_env)
    return db_env
