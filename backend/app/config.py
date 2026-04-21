import logging
from functools import lru_cache
from typing import Optional

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


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
    )  # Long-lived refresh tokens (30 days)

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

    # --- Tavily (for web search) ---
    tavily_api_key: Optional[SecretStr] = None

    # --- OpenAI (for embeddings) ---
    openai_api_key: Optional[SecretStr] = None

    # --- LLM Runtime ---
    llm_model: str = "gpt-5.4-mini"
    llm_temperature: float = 0.2
    llm_max_tokens: int = 2400
    agent_context_document_limit: int = 5
    agent_excerpt_length: int = 2000

    # --- Plan-based prompt limits (messages per user per agent) ---
    # -1 = unlimited (admin)
    plan_limit_free: int = 1
    plan_limit_premium: int = 50
    plan_limit_admin: int = -1

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
        logger.debug(
            "Pinecone API Key Loaded: %s", "Yes" if settings.pinecone_api_key else "No"
        )
        logger.debug(
            "OpenAI API Key Loaded: %s", "Yes" if settings.openai_api_key else "No"
        )
        logger.debug(
            "Supabase URL Loaded: %s", "Yes" if settings.supabase_url else "No"
        )
    return settings
