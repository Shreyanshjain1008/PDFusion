from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from storage3.exceptions import StorageApiError

from app.dependencies import CurrentUser, get_current_user
from app.schemas import DocumentOut
from app.supabase_client import service_client
from app.config import settings

router = APIRouter(prefix="/api/docs", tags=["documents"])


@router.post("/upload", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
def upload_document(
    file: UploadFile = File(...),
    current_user: CurrentUser = Depends(get_current_user),
) -> DocumentOut:
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only PDF files are supported")

    raw = file.file.read()
    if not raw:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File is empty")

    doc_id = str(uuid4())
    storage_path = f"{current_user.id}/{doc_id}/original.pdf"

    try:
        service_client.storage.from_(settings.docs_bucket).upload(
            path=storage_path,
            file=raw,
            file_options={"content-type": "application/pdf", "upsert": "false"},
        )
    except StorageApiError as ex:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Document storage upload failed: {ex.message}",
        ) from ex

    row = {
        "id": doc_id,
        "owner_id": current_user.id,
        "filename": file.filename,
        "storage_path": storage_path,
        "status": "uploaded",
    }
    created = service_client.table("documents").insert(row).execute().data
    service_client.table("audit_logs").insert({
        "doc_id": doc_id,
        "actor_id": current_user.id,
        "action": "document_uploaded",
        "metadata": {"filename": file.filename, "at": datetime.utcnow().isoformat()},
    }).execute()

    return DocumentOut(**created[0])


@router.get("", response_model=list[DocumentOut])
def list_documents(current_user: CurrentUser = Depends(get_current_user)) -> list[DocumentOut]:
    rows = service_client.table("documents").select("*").eq("owner_id", current_user.id).order("created_at", desc=True).execute().data
    return [DocumentOut(**r) for r in rows]


@router.get("/{doc_id}", response_model=DocumentOut)
def get_document(doc_id: str, current_user: CurrentUser = Depends(get_current_user)) -> DocumentOut:
    rows = service_client.table("documents").select("*").eq("id", doc_id).eq("owner_id", current_user.id).limit(1).execute().data
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return DocumentOut(**rows[0])


@router.get("/{doc_id}/url", response_model=dict)
def get_document_url(
    doc_id: str,
    version: str = Query(default="original", pattern="^(original|signed)$"),
    download: bool = Query(default=False),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict:
    rows = service_client.table("documents").select("*").eq("id", doc_id).eq("owner_id", current_user.id).limit(1).execute().data
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    doc = rows[0]
    path = doc["signed_storage_path"] if version == "signed" else doc["storage_path"]
    if not path:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{version} version is not available")

    try:
        options = {"download": True} if download else {}
        signed = service_client.storage.from_(settings.docs_bucket).create_signed_url(path, 3600, options)
    except StorageApiError as ex:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not generate document URL: {ex.message}",
        ) from ex

    signed_url = None
    if isinstance(signed, str):
        signed_url = signed
    elif isinstance(signed, dict):
        signed_url = signed.get("signedURL") or signed.get("signedUrl") or signed.get("signed_url")
    else:
        signed_url = (
            getattr(signed, "signedURL", None)
            or getattr(signed, "signedUrl", None)
            or getattr(signed, "signed_url", None)
        )

    if not signed_url:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not create signed URL")

    return {
        "url": signed_url,
        "expires_in": 3600,
        "version": version,
        "doc_id": doc_id,
        "download": download,
    }


@router.delete("/{doc_id}", response_model=dict)
def delete_document(doc_id: str, current_user: CurrentUser = Depends(get_current_user)) -> dict:
    rows = service_client.table("documents").select("*").eq("id", doc_id).eq("owner_id", current_user.id).limit(1).execute().data
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    doc = rows[0]
    signature_rows = (
        service_client.table("signatures")
        .select("image_storage_path")
        .eq("doc_id", doc_id)
        .eq("signer_id", current_user.id)
        .execute()
        .data
    )

    doc_paths = [path for path in [doc.get("storage_path"), doc.get("signed_storage_path")] if path]
    signature_paths = [row["image_storage_path"] for row in signature_rows if row.get("image_storage_path")]

    if doc_paths:
        try:
            service_client.storage.from_(settings.docs_bucket).remove(doc_paths)
        except StorageApiError as ex:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Document storage cleanup failed: {ex.message}",
            ) from ex

    if signature_paths:
        try:
            service_client.storage.from_(settings.signatures_bucket).remove(signature_paths)
        except StorageApiError as ex:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Signature storage cleanup failed: {ex.message}",
            ) from ex

    deleted = (
        service_client.table("documents")
        .delete()
        .eq("id", doc_id)
        .eq("owner_id", current_user.id)
        .execute()
        .data
    )
    if deleted is None:
        remaining = (
            service_client.table("documents")
            .select("id")
            .eq("id", doc_id)
            .eq("owner_id", current_user.id)
            .limit(1)
            .execute()
            .data
        )
        if remaining:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Document database delete failed",
            )

    return {"doc_id": doc_id, "status": "deleted"}
