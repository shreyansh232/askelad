from functools import lru_cache
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import SecretStr


class Settings(BaseSettings):
    """Application settings using Pydantic Settings."""

    # --- Core Application Settings ---
    app_name: str = "Askelad API"
    debug: bool = False

    # --- Security & Auth ---
    secret_key: SecretStr = SecretStr("dev-secret-key-change-in-production")
    access_token_expire_minutes: int = 60  # Access tokens (60 minutes)
    refresh_token_expire_minutes: int = (
        60 * 24 * 30
    ) # Long-lived refresh tokens (30 days)
    
    # Google auth
    google_client_id: Optional[str] = None
    google_client_secret: Optional[str] = None
    google_redirect_uri: str = "http://localhost:8000/api/auth/callback"
    frontend_url: str = "http://localhost:3000"

    # --- Pinecone ---
    pinecone_api_key: Optional[SecretStr] = None
    pinecone_index_name: str = "askelad"

    # --- Supabase Storage (For free PDF hosting) ---
    supabase_url: Optional[str] = None
    supabase_service_key: Optional[SecretStr] = None
    supabase_bucket: str = "PDFs"

    # --- OpenAI (for embeddings) ---
    openai_api_key: Optional[SecretStr] = None

    # --- Database ---
    database_url: str = "postgresql+asyncpg://user:pass@localhost:5432/askelad"

    # --- Configuration ---
    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    """
    Returns a cached instance of Settings.
    The lru_cache decorator ensures that we instantiate the Settings class
    (and read the .env file) only once. Subsequent calls return the same object,
    which improves performance.
    """
    settings = Settings()
    if settings.debug:
        print(f"DEBUG: Pinecone API Key Loaded: {'Yes' if settings.pinecone_api_key else 'No'}")
        print(f"DEBUG: OpenAI API Key Loaded: {'Yes' if settings.openai_api_key else 'No'}")
        print(f"DEBUG: Supabase URL Loaded: {'Yes' if settings.supabase_url else 'No'}")
    return settings
