import logging
from functools import lru_cache
from typing import Optional

from pydantic import SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    app_name: str = "Askelad API"
    debug: bool = False

    secret_key: SecretStr = SecretStr("dummy-secret-key-min-32-chars-for-dev")

    access_token_expire_minutes: int = 60
    refresh_token_expire_minutes: int = 60 * 24 * 30

    google_client_id: Optional[str] = None
    google_client_secret: Optional[str] = None
    google_redirect_uri: str = "https://app.askelad.com/api/auth/callback"
    frontend_url: str = "http://localhost:3000"

    pinecone_api_key: Optional[SecretStr] = None
    pinecone_index_name: str = "askelad"

    supabase_url: Optional[str] = None
    supabase_service_key: Optional[SecretStr] = None
    supabase_bucket: str = "PDFs"

    tavily_api_key: Optional[SecretStr] = None

    openai_api_key: Optional[SecretStr] = None

    llm_model: str = "gpt-5.4-mini"
    llm_temperature: float = 0.2
    llm_max_tokens: int = 2400
    agent_context_document_limit: int = 5
    agent_excerpt_length: int = 2000
    agent_thread_context_messages: int = 8

    plan_limit_free: int = 1
    plan_limit_premium: int = 50
    plan_limit_admin: int = -1

    cofounder_cross_agent_messages: int = 3

    database_url: str = (
        "postgresql+asyncpg://askelad_user:askelad_password@localhost:5432/askelad"
    )

    @field_validator("debug", mode="before")
    @classmethod
    def debug_from_env(cls, v):
        return str(v).lower() in ("true", "1", "yes")

    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )


@lru_cache
def get_settings() -> Settings:
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
