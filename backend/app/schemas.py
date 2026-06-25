from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

# --- Variable Schemas ---
class VariableBase(BaseModel):
    key: str
    value: str

class VariableCreate(VariableBase):
    pass

class VariableResponse(VariableBase):
    id: int
    environment_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# --- Environment Schemas ---
class EnvironmentBase(BaseModel):
    name: str

class EnvironmentCreate(EnvironmentBase):
    variables: Optional[List[VariableCreate]] = []

class EnvironmentResponse(EnvironmentBase):
    id: int
    variables: List[VariableResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# --- Request Schemas ---
class RequestBase(BaseModel):
    name: str
    method: str
    url: str
    headers_json: Optional[str] = "[]"
    body_type: Optional[str] = "none"
    body_raw: Optional[str] = ""
    body_form_data_json: Optional[str] = "[]"
    body_url_encoded_json: Optional[str] = "[]"
    auth_type: Optional[str] = "none"
    auth_config_json: Optional[str] = "{}"

class RequestCreate(RequestBase):
    collection_id: int

class RequestUpdate(BaseModel):
    name: Optional[str] = None
    method: Optional[str] = None
    url: Optional[str] = None
    headers_json: Optional[str] = None
    body_type: Optional[str] = None
    body_raw: Optional[str] = None
    body_form_data_json: Optional[str] = None
    body_url_encoded_json: Optional[str] = None
    auth_type: Optional[str] = None
    auth_config_json: Optional[str] = None

class RequestResponse(RequestBase):
    id: int
    collection_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# --- Collection Schemas ---
class CollectionBase(BaseModel):
    name: str

class CollectionCreate(CollectionBase):
    pass

class CollectionResponse(CollectionBase):
    id: int
    name: str
    requests: List[RequestResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# --- History Schemas ---
class HistoryResponse(BaseModel):
    id: int
    name: str
    method: str
    url: str
    headers_json: str
    body_type: str
    body_raw: str
    body_form_data_json: str
    body_url_encoded_json: str
    auth_type: str
    auth_config_json: str
    response_status: Optional[int]
    response_time_ms: Optional[int]
    response_size_bytes: Optional[int]
    response_headers_json: str
    response_body: str
    sent_at: datetime

    class Config:
        from_attributes = True

# --- Proxy Schemas ---
class ProxySendRequest(BaseModel):
    method: str
    url: str
    headers_json: str  # JSON array of {key, value, enabled}
    body_type: str  # none, raw, form-data, urlencoded
    body_raw: str
    body_form_data_json: str  # JSON array of {key, value, enabled}
    body_url_encoded_json: str  # JSON array of {key, value, enabled}
    auth_type: str  # none, bearer, basic
    auth_config_json: str  # JSON of token, username, password, etc.
    environment_id: Optional[int] = None  # to resolve variables
