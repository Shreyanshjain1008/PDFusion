from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "PDFusion API"
    app_env: str = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8000

    supabase_url: str = Field(..., alias="SUPABASE_URL")
    supabase_anon_key: str = Field(..., alias="SUPABASE_ANON_KEY")
    supabase_service_role_key: str = Field(..., alias="SUPABASE_SERVICE_ROLE_KEY")
    database_url: str | None = Field(default=None, alias="DATABASE_URL")

    docs_bucket: str = Field("pdfusion-documents", alias="DOCS_BUCKET")
    signatures_bucket: str = Field("pdfusion-signatures", alias="SIGNATURES_BUCKET")
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
