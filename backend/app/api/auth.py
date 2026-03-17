from datetime import datetime

from fastapi import APIRouter, HTTPException, status
from gotrue.errors import AuthApiError

from app.schemas import AuthResponse, LoginRequest, RegisterRequest
from app.supabase_client import anon_client, service_client

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest) -> AuthResponse:
    try:
        res = anon_client.auth.sign_up({"email": payload.email, "password": payload.password})
    except AuthApiError as ex:
        error_code = getattr(ex, "code", None)
        status_code = status.HTTP_429_TOO_MANY_REQUESTS if error_code == "over_email_send_rate_limit" else status.HTTP_400_BAD_REQUEST
        message = "Too many signup email attempts. Please wait a few minutes and try again." if error_code == "over_email_send_rate_limit" else str(ex)
        raise HTTPException(
            status_code=status_code,
            detail={"message": message, "code": error_code},
        ) from ex
    except Exception as ex:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"message": f"Auth provider error during register: {str(ex)}", "code": "auth_provider_error"},
        ) from ex

    if not res.user or not res.session:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unable to register user")

    service_client.table("audit_logs").insert({
        "doc_id": None,
        "actor_id": res.user.id,
        "action": "user_registered",
        "metadata": {"email": payload.email, "at": datetime.utcnow().isoformat()},
    }).execute()

    return AuthResponse(
        access_token=res.session.access_token,
        expires_in=res.session.expires_in,
        user_id=res.user.id,
        email=payload.email,
    )


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest) -> AuthResponse:
    try:
        res = anon_client.auth.sign_in_with_password({"email": payload.email, "password": payload.password})
    except AuthApiError as ex:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"message": str(ex), "code": getattr(ex, "code", None)},
        ) from ex
    except Exception as ex:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"message": f"Auth provider error during login: {str(ex)}", "code": "auth_provider_error"},
        ) from ex

    if not res.user or not res.session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    return AuthResponse(
        access_token=res.session.access_token,
        expires_in=res.session.expires_in,
        user_id=res.user.id,
        email=payload.email,
    )
