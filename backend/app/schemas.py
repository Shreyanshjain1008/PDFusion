from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int | None = None
    user_id: str
    email: EmailStr


class DocumentOut(BaseModel):
    id: str
    owner_id: str
    filename: str
    storage_path: str
    signed_storage_path: str | None = None
    status: str
    created_at: datetime
    updated_at: datetime


class SignatureCreate(BaseModel):
    doc_id: str
    page_number: int = Field(ge=1)
    x: float
    y: float
    width: float = Field(gt=0)
    height: float = Field(gt=0)
    image_base64: str


class SignatureOut(BaseModel):
    id: str
    doc_id: str
    signer_id: str
    page_number: int
    x: float
    y: float
    width: float
    height: float
    image_storage_path: str
    created_at: datetime


class FinalizeRequest(BaseModel):
    doc_id: str


class AuditOut(BaseModel):
    id: str
    doc_id: str
    actor_id: str
    action: str
    metadata: dict
    created_at: datetime
