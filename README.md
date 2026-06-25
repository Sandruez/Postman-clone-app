# Postman Clone (API Client) Workspace

A high-performance, dark-themed, and responsive API client workspace clone of Postman. This workspace allows users to build and run HTTP requests, organize requests into collections, manage environmental variables, inspect response data, and track request execution history.

To prevent browser CORS (Cross-Origin Resource Sharing) blockages, the frontend request builder routes all outbound HTTP executions through a proxy service running on the Python backend.

---

## 🛠 Tech Stack

*   **Frontend**: Next.js 14/15 (TypeScript, App Router, CSS Modules / Vanilla CSS)
*   **Backend**: Python (FastAPI, Uvicorn, HTTPX client)
*   **Database**: SQLite with SQLAlchemy ORM

---

## 🏗 Architecture Overview

```
             ┌─────────────────────────┐
             │    Next.js Client       │ (Runs on localhost:3000)
             │   (React UI & State)    │
             └────────────┬────────────┘
                          │
                          │ HTTP REST API (JSON)
                          ▼
             ┌─────────────────────────┐
             │     FastAPI Proxy       │ (Runs on localhost:8000)
             │  (Variable Resolver)    │
             └──────┬───────────┬──────┘
                    │           │
   Executes Request │           │ CRUD Operations
                    ▼           ▼
        ┌──────────────┐    ┌──────────────┐
        │  Outbound    │    │  SQLite DB   │ (postman.db)
        │  Web APIs    │    │  (SQLAlchemy)│
        └──────────────┘    └──────────────┘
```

1.  **Client-Side Interface**: The interface replicates Postman's pane layout with sidebar selectors, query parameter grids, authorization options, and customizable raw/form-data body inputs.
2.  **Variable Resolution**: Environmental variables specified in active environments are referenced as `{{variable}}` in request inputs. They are resolved dynamically by the backend proxy prior to request dispatch.
3.  **Proxy Dispatcher**: Outbound requests are dispatched by the FastAPI proxy using python `httpx`. The proxy monitors the network stream to compute duration, bandwidth payload size, status, and response headers.
4.  **Database Persistence**: Active collections, requests, environmental configurations, and execution histories are persisted inside SQLite.

---

## 🗄 Database Schema

The database uses SQLite with 5 tables:

### 1. `collections`
Stores request collections folders.
*   `id` (Integer, Primary Key): Unique identifier.
*   `name` (String): Collection name.
*   `created_at` / `updated_at` (DateTime): Timestamp markers.

### 2. `requests`
Stores saved requests.
*   `id` (Integer, Primary Key).
*   `collection_id` (Integer, Foreign Key to `collections`).
*   `name` (String): Request title.
*   `method` (String): HTTP verb (GET, POST, etc.).
*   `url` (Text): Target URL (with possible variable placeholders).
*   `headers_json` (Text): JSON-encoded list of headers.
*   `body_type` (String): `none`, `raw`, `form-data`, or `urlencoded`.
*   `body_raw` (Text): Text/JSON request body.
*   `body_form_data_json` (Text): JSON-encoded form-data key-values.
*   `body_url_encoded_json` (Text): JSON-encoded url-encoded key-values.
*   `auth_type` (String): `none`, `bearer`, or `basic`.
*   `auth_config_json` (Text): JSON-encoded credentials.

### 3. `environments`
Stores env scopes.
*   `id` (Integer, Primary Key).
*   `name` (String): Environment label.

### 4. `variables`
Variables nested inside environments.
*   `id` (Integer, Primary Key).
*   `environment_id` (Integer, Foreign Key to `environments`).
*   `key` (String): Variable name.
*   `value` (Text): Resolved value string.

### 5. `history`
Persistent log of all sent requests and their returned responses.
*   `id` (Integer, Primary Key).
*   `name` (String): Method + URL tag.
*   `method` / `url` / `headers_json` / `body_type` / `body_raw` / `body_form_data_json` / `body_url_encoded_json` / `auth_type` / `auth_config_json` (Stores configuration of the request).
*   `response_status` (Integer): Status code (e.g. 200).
*   `response_time_ms` (Integer): Roundtrip time in milliseconds.
*   `response_size_bytes` (Integer): Response payload size.
*   `response_headers_json` (Text): JSON headers dictionary.
*   `response_body` (Text): Raw text response string.
*   `sent_at` (DateTime): Execution time.

---

## ⚡️ Quick Start Setup

### Prerequisites
*   Node.js (v18+)
*   Python (3.10+)

### 1. Launch Backend API Server
Navigate to the `backend/` directory:
```bash
cd backend
```

Create a virtual environment, activate it, and install dependencies:
```bash
# Windows powershell:
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Linux/macOS:
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Launch the FastAPI application:
```bash
$env:PYTHONPATH="."  # Windows Powershell
# export PYTHONPATH="." # Linux/macOS

python -m uvicorn app.main:app --reload --port 8000
```
The backend API server will run on [http://127.0.0.1:8000](http://127.0.0.1:8000). The SQLite database will be initialized and seeded automatically if empty.

To run automated backend verification tests:
```bash
.\venv\Scripts\pytest app/test_main.py
```

---

### 2. Launch Next.js Frontend Development Server
Navigate to the `frontend/` directory:
```bash
cd frontend
```

Install npm dependencies:
```bash
npm install
```

Start the development hot-reloader:
```bash
npm run dev
```
Open [http://127.0.0.1:3000](http://127.0.0.1:3000) in your browser.

---

## ☁️ Deployment on Render

This project is structured for straightforward hosting on Render (or other platforms like Railway/Vercel). Follow the settings below to deploy both applications:

### 1. Backend Web Service (FastAPI)
*   **Service Type**: Web Service
*   **Runtime**: `Python`
*   **Root Directory**: `backend`
*   **Build Command**: `pip install -r requirements.txt`
*   **Start Command**: `python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT`
*   **Environment Variables**:
    *   `PYTHONPATH`: `.`
    *   `DATABASE_URL`: *(Optional)* Your Render PostgreSQL connection string (e.g., `postgresql://user:pass@host/dbname`). If omitted, it falls back to a local SQLite database file `postman.db`. To make SQLite data persistent, add a **Disk** mount on Render to the `/opt/render/project/src/backend` path.

---

### 2. Frontend Web Service (Next.js)
*   **Service Type**: Web Service
*   **Runtime**: `Node`
*   **Root Directory**: `frontend`
*   **Build Command**: `npm install && npm run build`
*   **Start Command**: `npm run start`
*   **Environment Variables**:
    *   `NEXT_PUBLIC_API_URL`: The URL of your deployed backend service (e.g., `https://your-backend-name.onrender.com/api`). Note: This must be defined *during build time* so Next.js compile scripts can embed it.

---

## 🗒 Key Assumptions & Core Decisions

1.  **CORS Bypass**: Standard browser security forbids direct outbound HTTP calls to third-party endpoints. By routing request payloads to the backend `/api/proxy/send` route, we execute real request flows safely.
2.  **No Authorization Overhead**: The workspace behaves as a single default user. There is no session layer; SQLite database models are served globally.
3.  **Automatic DB Seeding**: On start, the server checks if the database tables are empty. If so, it seeds a default workspace collection `HTTPBin Sandbox`, two environments (`Production environment` / `Development env` with variables), and a history run to make the platform immediately usable.
