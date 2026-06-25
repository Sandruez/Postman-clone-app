import pytest
from fastapi.testclient import TestClient
import json
from app.main import app
from app.database import Base, engine, SessionLocal
from app.models import Environment, Collection

client = TestClient(app)

@pytest.fixture(autouse=True)
def run_around_tests():
    # Code that will run before each test
    # Re-create database tables
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    # Code that will run after each test

def test_read_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "online"

def test_collections_crud():
    # 1. Create a collection
    response = client.post("/api/collections", json={"name": "Test Collection"})
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Test Collection"
    collection_id = data["id"]

    # 2. Get collections
    response = client.get("/api/collections")
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["name"] == "Test Collection"

    # 3. Create a request inside this collection
    request_data = {
        "collection_id": collection_id,
        "name": "Test Request",
        "method": "GET",
        "url": "https://httpbin.org/get",
        "headers_json": "[]",
        "body_type": "none"
    }
    response = client.post("/api/requests", json=request_data)
    assert response.status_code == 200
    req_json = response.json()
    assert req_json["name"] == "Test Request"
    assert req_json["collection_id"] == collection_id

def test_environments_crud():
    # 1. Create environment
    env_data = {
        "name": "Localhost Env",
        "variables": [
            {"key": "host", "value": "127.0.0.1"},
            {"key": "port", "value": "8000"}
        ]
    }
    response = client.post("/api/environments", json=env_data)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Localhost Env"
    assert len(data["variables"]) == 2
    env_id = data["id"]

    # 2. Update variables bulk
    new_vars = [
        {"key": "host", "value": "localhost"},
        {"key": "port", "value": "3000"},
        {"key": "protocol", "value": "http"}
    ]
    response = client.put(f"/api/environments/{env_id}/variables", json=new_vars)
    assert response.status_code == 200
    updated_data = response.json()
    assert len(updated_data["variables"]) == 3
    assert any(v["key"] == "protocol" and v["value"] == "http" for v in updated_data["variables"])

def test_proxy_send_and_history():
    # 1. First, create an environment with variables to resolve
    env_resp = client.post("/api/environments", json={
        "name": "Proxy Test Env",
        "variables": [
            {"key": "protocol", "value": "https"},
            {"key": "domain", "value": "httpbin.org"}
        ]
    })
    env_id = env_resp.json()["id"]

    # 2. Send proxy request with variable placeholders
    payload = {
        "method": "GET",
        "url": "{{protocol}}://{{domain}}/get?foo=bar",
        "headers_json": json.dumps([
            {"key": "X-Custom-Header", "value": "CustomValue", "enabled": True}
        ]),
        "body_type": "none",
        "body_raw": "",
        "body_form_data_json": "[]",
        "body_url_encoded_json": "[]",
        "auth_type": "none",
        "auth_config_json": "{}",
        "environment_id": env_id
    }
    
    response = client.post("/api/proxy/send", json=payload)
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["status_code"] == 200
    
    # Body returned should be httpbin response containing the query param and header
    body_data = json.loads(res_data["body"])
    assert body_data["args"]["foo"] == "bar"
    assert body_data["headers"]["X-Custom-Header"] == "CustomValue"

    # 3. Verify history item was saved
    hist_resp = client.get("/api/history")
    assert hist_resp.status_code == 200
    history = hist_resp.json()
    assert len(history) == 1
    assert history[0]["url"] == "{{protocol}}://{{domain}}/get?foo=bar"
    assert history[0]["response_status"] == 200
