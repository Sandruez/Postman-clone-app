import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import json

from .database import engine, Base, SessionLocal
from .routers import collections, environments, history, proxy
from .models import Collection, Request, Environment, Variable, History

# Initialize database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Postman Clone API Backend",
    description="Proxy runner and persistence engine for the Postman Clone application.",
    version="1.0.0"
)

# Enable CORS for frontend client
allowed_origins = os.environ.get(
    "CORS_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000,https://postman-clone-app-cp.onrender.com"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(proxy.router, prefix="/api")
app.include_router(collections.router, prefix="/api")
app.include_router(environments.router, prefix="/api")
app.include_router(history.router, prefix="/api")

# Database Seeding function
def seed_database():
    db = SessionLocal()
    try:
        # Check if seeding is already done
        if db.query(Collection).count() == 0 and db.query(Environment).count() == 0:
            print("Seeding database with sample collections, environments, and history...")
            
            # 1. Create a sample environment
            env = Environment(name="Production environment")
            db.add(env)
            db.commit()
            db.refresh(env)
            
            # Add variables to the environment
            baseUrl_var = Variable(environment_id=env.id, key="baseUrl", value="https://httpbin.org")
            token_var = Variable(environment_id=env.id, key="apiKey", value="token-from-env-12345")
            db.add_all([baseUrl_var, token_var])
            db.commit()
            
            # 2. Create a second environment
            env_dev = Environment(name="Development env")
            db.add(env_dev)
            db.commit()
            db.refresh(env_dev)
            db.add_all([
                Variable(environment_id=env_dev.id, key="baseUrl", value="https://httpbin.org"),
                Variable(environment_id=env_dev.id, key="apiKey", value="dev-token-abc")
            ])
            db.commit()

            # 3. Create a collection
            collection = Collection(name="HTTPBin Sandbox")
            db.add(collection)
            db.commit()
            db.refresh(collection)

            # 4. Add saved requests to the collection
            req_get = Request(
                collection_id=collection.id,
                name="Get Request (Env Variables)",
                method="GET",
                url="{{baseUrl}}/get?test=true",
                headers_json=json.dumps([
                    {"key": "X-API-Key", "value": "{{apiKey}}", "enabled": True},
                    {"key": "User-Agent", "value": "PostmanClone/1.0", "enabled": True}
                ]),
                body_type="none"
            )
            
            req_post = Request(
                collection_id=collection.id,
                name="Post JSON Request",
                method="POST",
                url="{{baseUrl}}/post",
                headers_json=json.dumps([
                    {"key": "Content-Type", "value": "application/json", "enabled": True}
                ]),
                body_type="raw",
                body_raw=json.dumps({
                    "info": "This request body contains nested variables",
                    "secret_key": "{{apiKey}}",
                    "status": "success"
                }, indent=2)
            )

            req_urlencoded = Request(
                collection_id=collection.id,
                name="Post Form URL Encoded",
                method="POST",
                url="{{baseUrl}}/post",
                body_type="urlencoded",
                body_url_encoded_json=json.dumps([
                    {"key": "param1", "value": "value1", "enabled": True},
                    {"key": "env_secret", "value": "{{apiKey}}", "enabled": True}
                ])
            )
            
            db.add_all([req_get, req_post, req_urlencoded])
            db.commit()

            # 5. Seed some initial History
            mock_history_get = History(
                name="GET https://httpbin.org/get?test=true",
                method="GET",
                url="https://httpbin.org/get?test=true",
                headers_json=json.dumps([{"key": "X-API-Key", "value": "token-from-env-12345", "enabled": True}]),
                body_type="none",
                response_status=200,
                response_time_ms=185,
                response_size_bytes=425,
                response_headers_json=json.dumps([
                    {"key": "content-type", "value": "application/json"},
                    {"key": "server", "value": "gunicorn"}
                ]),
                response_body=json.dumps({
                    "args": {"test": "true"},
                    "headers": {
                        "Host": "httpbin.org",
                        "X-Api-Key": "token-from-env-12345",
                        "User-Agent": "PostmanClone/1.0"
                    },
                    "url": "https://httpbin.org/get?test=true"
                }, indent=2)
            )
            db.add(mock_history_get)
            db.commit()
            print("Database seeding completed.")
    except Exception as e:
        print(f"Failed to seed database: {e}")
    finally:
        db.close()

seed_database()

@app.get("/")
def read_root():
    return {
        "status": "online",
        "message": "Postman Clone API Server is running. Use /api routes."
    }
