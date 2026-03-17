# PDFusion

PDFusion is a full-stack PDF signing app built with a React + Vite frontend and a FastAPI backend, using Supabase for authentication, database storage, and file storage.

## Features

- User registration and login with Supabase Auth
- PDF upload and preview
- Signature drawing and text-based signing
- Placement-based PDF finalization
- Signed PDF viewing and download
- Audit log tracking
- Document deletion with storage and database cleanup

## Tech Stack

- Frontend: React, Vite, Axios, Tailwind CSS, React PDF
- Backend: FastAPI, Supabase Python SDK, PyMuPDF, Pydantic
- Platform services: Supabase Auth, Postgres, Storage

## Project Structure

```text
PDFusion/
|-- backend/
|   |-- app/
|   |-- supabase/
|   |-- requirements.txt
|   `-- .env
|-- frontend/
|   |-- src/
|   |-- package.json
|   `-- .env.example
`-- README.md
```

## Prerequisites

- Python 3.11+
- Node.js 18+
- npm
- A Supabase project

## Backend Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

Ensure `backend/.env` contains your Supabase project values:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=
DOCS_BUCKET=pdfusion-documents
SIGNATURES_BUCKET=pdfusion-signatures
```

Run the backend:

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend default URL: `http://127.0.0.1:8000`

## Frontend Setup

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

Frontend environment file:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Frontend default URL: `http://127.0.0.1:5173`

## Supabase Setup

1. Create a new Supabase project.
2. Open the SQL editor and run [`backend/supabase/schema.sql`](./backend/supabase/schema.sql).
3. Ensure these buckets exist:
   - `pdfusion-documents`
   - `pdfusion-signatures`
4. Enable email/password auth in Supabase Authentication.
5. Add your project credentials to `backend/.env`.

Note: the backend startup already attempts to create the storage buckets if they do not exist.

## API Overview

Authentication:

- `POST /api/auth/register`
- `POST /api/auth/login`

Documents:

- `POST /api/docs/upload`
- `GET /api/docs`
- `GET /api/docs/{doc_id}`
- `GET /api/docs/{doc_id}/url`
- `DELETE /api/docs/{doc_id}`

Signatures:

- `POST /api/signatures`
- `GET /api/signatures/{doc_id}`
- `POST /api/signatures/finalize`

Audit:

- `GET /api/audit/{doc_id}`

## Document Deletion Behavior

Deleting a document removes:

- the original PDF from Supabase Storage
- the signed PDF from Supabase Storage, if present
- saved signature images from Supabase Storage
- the document row from the database

Related `signatures` and `audit_logs` rows are removed by database cascade rules in the schema.

## Dependency Notes

Backend Python dependencies are tracked in [`backend/requirements.txt`](./backend/requirements.txt).

Frontend dependencies are tracked in [`frontend/package.json`](./frontend/package.json). This project does not use a separate frontend `requirements.txt`.

## Development Notes

- The backend expects a Bearer token in the `Authorization` header for protected routes.
- Signed document URLs are generated as temporary signed links from Supabase Storage.
- Uploaded files are limited by the bucket configuration created at app startup.

## Common Run Commands

Backend:

```bash
cd backend
venv\Scripts\activate
uvicorn app.main:app --reload
```

Frontend:

```bash
cd frontend
npm run dev
```
