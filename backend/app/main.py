from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.audit import router as audit_router
from app.api.auth import router as auth_router
from app.api.documents import router as docs_router
from app.api.signatures import router as sig_router
from app.config import settings
from app.supabase_client import service_client

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def ensure_storage_buckets() -> None:
    existing = {bucket.name for bucket in service_client.storage.list_buckets()}

    if settings.docs_bucket not in existing:
        service_client.storage.create_bucket(
            settings.docs_bucket,
            options={
                "public": False,
                "file_size_limit": "25MB",
                "allowed_mime_types": ["application/pdf"],
            },
        )

    if settings.signatures_bucket not in existing:
        service_client.storage.create_bucket(
            settings.signatures_bucket,
            options={
                "public": False,
                "file_size_limit": "5MB",
                "allowed_mime_types": ["image/png", "image/jpeg"],
            },
        )


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": settings.app_name}


app.include_router(auth_router)
app.include_router(docs_router)
app.include_router(sig_router)
app.include_router(audit_router)
