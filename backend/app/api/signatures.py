import base64
from datetime import datetime

import fitz
from fastapi import APIRouter, Depends, HTTPException, status
from storage3.exceptions import StorageApiError

from app.config import settings
from app.dependencies import CurrentUser, get_current_user
from app.schemas import FinalizeRequest, SignatureCreate, SignatureOut
from app.supabase_client import service_client

router = APIRouter(prefix="/api/signatures", tags=["signatures"])


def _apply_signatures(original_pdf: bytes, signature_rows: list[dict]) -> bytes:
    # Signature images are stamped on configured pages and coordinates.
    try:
        doc = fitz.open(stream=original_pdf, filetype="pdf")
    except Exception as ex:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Original PDF could not be opened for signing: {str(ex)}",
        ) from ex

    try:
        for sig in signature_rows:
            try:
                img = service_client.storage.from_(settings.signatures_bucket).download(sig["image_storage_path"])
            except StorageApiError as ex:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Signature image download failed: {ex.message}",
                ) from ex
            page_index = sig["page_number"] - 1
            if page_index < 0 or page_index >= len(doc):
                continue
            page = doc[page_index]
            rect = fitz.Rect(sig["x"], sig["y"], sig["x"] + sig["width"], sig["y"] + sig["height"])
            page.insert_image(rect, stream=img)

        return doc.tobytes(garbage=3, deflate=True)
    finally:
        doc.close()


@router.post("", response_model=SignatureOut, status_code=status.HTTP_201_CREATED)
def create_signature(payload: SignatureCreate, current_user: CurrentUser = Depends(get_current_user)) -> SignatureOut:
    doc_rows = service_client.table("documents").select("id,owner_id").eq("id", payload.doc_id).limit(1).execute().data
    if not doc_rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if doc_rows[0]["owner_id"] != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Document access denied")

    try:
        encoded = payload.image_base64
        if "," in encoded and encoded.lower().startswith("data:image"):
            encoded = encoded.split(",", 1)[1]
        image_bytes = base64.b64decode(encoded)
    except Exception as ex:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid base64 signature image") from ex

    sig_id = datetime.utcnow().strftime("%Y%m%d%H%M%S%f")
    img_path = f"{current_user.id}/{payload.doc_id}/{sig_id}.png"

    try:
        service_client.storage.from_(settings.signatures_bucket).upload(
            path=img_path,
            file=image_bytes,
            file_options={"content-type": "image/png", "upsert": "false"},
        )
    except StorageApiError as ex:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Signature storage upload failed: {ex.message}",
        ) from ex

    row = {
        "doc_id": payload.doc_id,
        "signer_id": current_user.id,
        "page_number": payload.page_number,
        "x": payload.x,
        "y": payload.y,
        "width": payload.width,
        "height": payload.height,
        "image_storage_path": img_path,
    }
    created = service_client.table("signatures").insert(row).execute().data[0]
    service_client.table("audit_logs").insert({
        "doc_id": payload.doc_id,
        "actor_id": current_user.id,
        "action": "signature_added",
        "metadata": {"signature_id": created["id"], "at": datetime.utcnow().isoformat()},
    }).execute()

    return SignatureOut(**created)


@router.get("/{doc_id}", response_model=list[SignatureOut])
def list_signatures(doc_id: str, current_user: CurrentUser = Depends(get_current_user)) -> list[SignatureOut]:
    doc_rows = service_client.table("documents").select("id,owner_id").eq("id", doc_id).limit(1).execute().data
    if not doc_rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if doc_rows[0]["owner_id"] != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Document access denied")

    rows = service_client.table("signatures").select("*").eq("doc_id", doc_id).order("created_at", desc=False).execute().data
    return [SignatureOut(**r) for r in rows]


@router.post("/finalize", response_model=dict)
def finalize_document(payload: FinalizeRequest, current_user: CurrentUser = Depends(get_current_user)) -> dict:
    doc_id = payload.doc_id
    doc_rows = service_client.table("documents").select("*").eq("id", doc_id).eq("owner_id", current_user.id).limit(1).execute().data
    if not doc_rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    document_row = doc_rows[0]
    signatures = service_client.table("signatures").select("*").eq("doc_id", doc_id).order("created_at", desc=False).execute().data
    if not signatures:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "No saved signatures found for this document. Save at least one placement before finalizing.", "code": "no_saved_signatures"},
        )

    try:
        original = service_client.storage.from_(settings.docs_bucket).download(document_row["storage_path"])
    except StorageApiError as ex:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Original document download failed: {ex.message}",
        ) from ex
    signed_pdf = _apply_signatures(original, signatures)

    signed_path = document_row.get("signed_storage_path") or f"{current_user.id}/{doc_id}/signed.pdf"
    try:
        storage_bucket = service_client.storage.from_(settings.docs_bucket)
        storage_bucket.upload(
            path=signed_path,
            file=signed_pdf,
            file_options={"content-type": "application/pdf", "upsert": "true"},
        )
    except StorageApiError as ex:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Signed document upload failed: {ex.message}",
        ) from ex

    updated_document = (
        service_client.table("documents")
        .update({"signed_storage_path": signed_path, "status": "signed"})
        .eq("id", doc_id)
        .eq("owner_id", current_user.id)
        .execute()
        .data
    )
    if not updated_document:
        refreshed = (
            service_client.table("documents")
            .select("id,signed_storage_path,status")
            .eq("id", doc_id)
            .eq("owner_id", current_user.id)
            .limit(1)
            .execute()
            .data
        )
        if not refreshed or refreshed[0].get("signed_storage_path") != signed_path or refreshed[0].get("status") != "signed":
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={"message": "Signed PDF was generated but document record update failed.", "code": "document_update_failed"},
            )

    service_client.table("audit_logs").insert({
        "doc_id": doc_id,
        "actor_id": current_user.id,
        "action": "document_finalized",
        "metadata": {"signed_storage_path": signed_path, "at": datetime.utcnow().isoformat()},
    }).execute()

    return {
        "doc_id": doc_id,
        "status": "signed",
        "signed_storage_path": signed_path,
        "signature_count": len(signatures),
    }
