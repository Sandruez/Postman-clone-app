from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import json
from ..database import get_db
from ..schemas import ProxySendRequest
from ..models import History
from ..services.proxy_service import execute_proxied_request, get_env_variables

router = APIRouter(prefix="/proxy", tags=["Proxy"])

@router.post("/send")
def send_request(payload: ProxySendRequest, db: Session = Depends(get_db)):
    # 1. Parse JSON inputs safely
    try:
        headers_list = json.loads(payload.headers_json) if payload.headers_json else []
    except json.JSONDecodeError:
        headers_list = []
        
    try:
        body_form_data = json.loads(payload.body_form_data_json) if payload.body_form_data_json else []
    except json.JSONDecodeError:
        body_form_data = []
        
    try:
        body_url_encoded = json.loads(payload.body_url_encoded_json) if payload.body_url_encoded_json else []
    except json.JSONDecodeError:
        body_url_encoded = []
        
    try:
        auth_config = json.loads(payload.auth_config_json) if payload.auth_config_json else {}
    except json.JSONDecodeError:
        auth_config = {}

    # 2. Fetch environment variables
    variables = get_env_variables(db, payload.environment_id)

    # 3. Execute HTTP request
    result = execute_proxied_request(
        method=payload.method,
        url=payload.url,
        headers_list=headers_list,
        body_type=payload.body_type,
        body_raw=payload.body_raw,
        body_form_data=body_form_data,
        body_url_encoded=body_url_encoded,
        auth_type=payload.auth_type,
        auth_config=auth_config,
        variables=variables
    )

    # 4. Persist in History table
    # Make a friendly display name (e.g. GET http://api.com)
    history_name = f"{payload.method.upper()} {payload.url}"
    
    db_history = History(
        name=history_name,
        method=payload.method,
        url=payload.url,
        headers_json=payload.headers_json,
        body_type=payload.body_type,
        body_raw=payload.body_raw,
        body_form_data_json=payload.body_form_data_json,
        body_url_encoded_json=payload.body_url_encoded_json,
        auth_type=payload.auth_type,
        auth_config_json=payload.auth_config_json,
        response_status=result["status_code"],
        response_time_ms=result["time_ms"],
        response_size_bytes=result["size_bytes"],
        response_headers_json=json.dumps(result["headers"]),
        response_body=result["body"] or ""
    )
    
    db.add(db_history)
    db.commit()
    db.refresh(db_history)

    return {
        "id": db_history.id,
        "status_code": result["status_code"],
        "time_ms": result["time_ms"],
        "size_bytes": result["size_bytes"],
        "headers": result["headers"],
        "body": result["body"],
        "error": result["error"]
    }
