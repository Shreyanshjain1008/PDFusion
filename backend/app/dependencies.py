from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException, status

from app.supabase_client import service_client


@dataclass
class CurrentUser:
    id: str
    email: str


def _extract_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Authorization header")

    parts = authorization.split(" ")
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Authorization header")

    return parts[1]


def get_current_user(authorization: str | None = Header(default=None)) -> CurrentUser:
    token = _extract_bearer_token(authorization)
    user_res = service_client.auth.get_user(token)
    user = user_res.user

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    return CurrentUser(id=user.id, email=user.email or "")


def get_access_token(authorization: str | None = Header(default=None)) -> str:
    return _extract_bearer_token(authorization)


CurrentUserDep = Depends(get_current_user)
