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
    
    # Google auth
    google_client_id: Optional[str] = None
    google_client_secret: Optional[str] = None
    google_redirect_uri: str = "http://localhost:8000/auth/callback"

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
    return Settings()
