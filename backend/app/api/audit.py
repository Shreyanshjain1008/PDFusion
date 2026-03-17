from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies import CurrentUser, get_current_user
from app.schemas import AuditOut
from app.supabase_client import service_client

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("/{doc_id}", response_model=list[AuditOut])
def get_audit_logs(doc_id: str, current_user: CurrentUser = Depends(get_current_user)) -> list[AuditOut]:
    doc_rows = service_client.table("documents").select("id,owner_id").eq("id", doc_id).limit(1).execute().data
    if not doc_rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if doc_rows[0]["owner_id"] != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Document access denied")

    rows = service_client.table("audit_logs").select("*").eq("doc_id", doc_id).order("created_at", desc=False).execute().data
    return [AuditOut(**r) for r in rows]