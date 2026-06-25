import re
import json
import time
import httpx
import base64
from typing import Dict, List, Any, Tuple, Optional
from sqlalchemy.orm import Session
from ..models import Environment, Variable

def resolve_variables(text: str, variables: Dict[str, str]) -> str:
    """
    Replaces all occurrences of {{variable_name}} with its value from variables dictionary.
    """
    if not text:
        return text
    
    def replacer(match):
        var_name = match.group(1).strip()
        return variables.get(var_name, match.group(0)) # fallback to original if not found
        
    return re.sub(r"\{\{([^}]+)\}\}", replacer, text)

def get_env_variables(db: Session, environment_id: Optional[int]) -> Dict[str, str]:
    """
    Retrieves variables for a given environment ID as a dictionary.
    """
    if not environment_id:
        return {}
    
    variables = db.query(Variable).filter(Variable.environment_id == environment_id).all()
    return {v.key: v.value for v in variables}

def execute_proxied_request(
    method: str,
    url: str,
    headers_list: List[Dict[str, Any]],
    body_type: str,
    body_raw: str,
    body_form_data: List[Dict[str, Any]],
    body_url_encoded: List[Dict[str, Any]],
    auth_type: str,
    auth_config: Dict[str, Any],
    variables: Dict[str, str]
) -> Dict[str, Any]:
    """
    Resolves variables, builds, and executes an HTTP request, returning the response metadata.
    """
    # 1. Resolve variables in URL
    resolved_url = resolve_variables(url, variables)
    if not resolved_url.startswith(("http://", "https://")):
        # Default to http if no protocol provided to prevent immediate failure
        resolved_url = "http://" + resolved_url

    # 2. Build headers
    headers = {}
    for h in headers_list:
        if h.get("enabled", True) and h.get("key"):
            key = resolve_variables(h["key"], variables)
            val = resolve_variables(h.get("value", ""), variables)
            headers[key] = val

    # 3. Handle Auth
    if auth_type == "bearer" and auth_config.get("token"):
        token = resolve_variables(auth_config["token"], variables)
        headers["Authorization"] = f"Bearer {token}"
    elif auth_type == "basic":
        username = resolve_variables(auth_config.get("username", ""), variables)
        password = resolve_variables(auth_config.get("password", ""), variables)
        encoded = base64.b64encode(f"{username}:{password}".encode("utf-8")).decode("utf-8")
        headers["Authorization"] = f"Basic {encoded}"

    # 4. Build Request Body
    data = None
    files = None
    content = None

    if body_type == "raw" and body_raw:
        content = resolve_variables(body_raw, variables).encode("utf-8")
    elif body_type == "urlencoded":
        data = {}
        for item in body_url_encoded:
            if item.get("enabled", True) and item.get("key"):
                k = resolve_variables(item["key"], variables)
                v = resolve_variables(item.get("value", ""), variables)
                data[k] = v
    elif body_type == "form-data":
        data = {}
        for item in body_form_data:
            if item.get("enabled", True) and item.get("key"):
                k = resolve_variables(item["key"], variables)
                v = resolve_variables(item.get("value", ""), variables)
                data[k] = v

    # Execute request using httpx
    start_time = time.perf_counter()
    
    try:
        # We follow redirects and support normal methods
        # Use a timeout of 30 seconds
        with httpx.Client(follow_redirects=True, timeout=30.0) as client:
            req = client.build_request(
                method=method.upper(),
                url=resolved_url,
                headers=headers,
                content=content,
                data=data,
                files=files
            )
            response = client.send(req)
            
            end_time = time.perf_counter()
            elapsed_ms = int((end_time - start_time) * 1000)
            
            # Format response headers as a list of dicts for the UI
            resp_headers = [{"key": k, "value": v} for k, v in response.headers.items()]
            
            return {
                "status_code": response.status_code,
                "time_ms": elapsed_ms,
                "size_bytes": len(response.content),
                "headers": resp_headers,
                "body": response.text,
                "error": None
            }
            
    except httpx.TimeoutException:
        end_time = time.perf_counter()
        return {
            "status_code": 504,
            "time_ms": int((end_time - start_time) * 1000),
            "size_bytes": 0,
            "headers": [],
            "body": "Request Timeout: The server did not respond within 30 seconds.",
            "error": "TimeoutException"
        }
    except Exception as e:
        end_time = time.perf_counter()
        return {
            "status_code": 0,
            "time_ms": int((end_time - start_time) * 1000),
            "size_bytes": 0,
            "headers": [],
            "body": f"Error: {str(e)}",
            "error": type(e).__name__
        }
