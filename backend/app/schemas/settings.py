from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, SecretStr


ProviderName = Literal["openai", "anthropic", "xai"]
ProviderStatus = Literal["untested", "valid", "invalid"]


class ProviderKeyUpsert(BaseModel):
    api_key: SecretStr = Field(min_length=8)


class ProviderKeyTestRequest(BaseModel):
    api_key: SecretStr | None = None
    model: str | None = Field(default=None, max_length=120)


class ProviderKeyResponse(BaseModel):
    provider: ProviderName
    key_hint: str
    status: ProviderStatus
    last_tested_at: datetime | None
    last_error: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserSettingsUpdate(BaseModel):
    default_provider: ProviderName | None = None
    default_model: str | None = Field(default=None, min_length=1, max_length=120)
    platform_key_fallback: bool | None = None
    monthly_prompt_limit: int | None = Field(default=None, ge=1, le=100000)


class UserSettingsResponse(BaseModel):
    default_provider: ProviderName
    default_model: str
    platform_key_fallback: bool
    monthly_prompt_limit: int | None
    plan_prompt_limit: int
    used_prompts: int
    provider_keys: list[ProviderKeyResponse]


class ProviderKeyTestResponse(BaseModel):
    ok: bool
    provider: ProviderName
    model: str
    message: str
