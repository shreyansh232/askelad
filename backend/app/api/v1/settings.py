from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.db.models import User
from app.schemas.settings import (
    ProviderKeyResponse,
    ProviderKeyTestRequest,
    ProviderKeyTestResponse,
    ProviderKeyUpsert,
    ProviderName,
    UserSettingsResponse,
    UserSettingsUpdate,
)
from app.services.settings import settings_service


limiter = Limiter(key_func=get_remote_address)


router = APIRouter(prefix="/settings", tags=["Settings"])

DbSession = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]


@router.get("", response_model=UserSettingsResponse)
async def get_settings_state(
    db: DbSession,
    current_user: CurrentUser,
) -> UserSettingsResponse:
    return await settings_service.build_response(db, current_user)


@router.patch("", response_model=UserSettingsResponse)
async def update_settings_state(
    body: UserSettingsUpdate,
    db: DbSession,
    current_user: CurrentUser,
) -> UserSettingsResponse:
    await settings_service.update_user_settings(
        db,
        current_user.id,
        default_provider=body.default_provider,
        default_model=body.default_model,
        platform_key_fallback=body.platform_key_fallback,
        monthly_prompt_limit=body.monthly_prompt_limit,
    )
    return await settings_service.build_response(db, current_user)


@router.put("/provider-keys/{provider}", response_model=ProviderKeyResponse)
async def upsert_provider_key(
    provider: ProviderName,
    body: ProviderKeyUpsert,
    db: DbSession,
    current_user: CurrentUser,
) -> ProviderKeyResponse:
    key = await settings_service.upsert_provider_key(
        db,
        current_user.id,
        provider,
        body.api_key.get_secret_value(),
    )
    return ProviderKeyResponse.model_validate(key)


@router.delete("/provider-keys/{provider}", status_code=204)
async def delete_provider_key(
    provider: ProviderName,
    db: DbSession,
    current_user: CurrentUser,
) -> None:
    deleted = await settings_service.delete_provider_key(db, current_user.id, provider)
    if not deleted:
        raise HTTPException(status_code=404, detail="Provider key not found")


@router.post(
    "/provider-keys/{provider}/test",
    response_model=ProviderKeyTestResponse,
)
@limiter.limit("5/minute")
async def test_provider_key(
    request: Request,
    provider: ProviderName,
    body: ProviderKeyTestRequest,
    db: DbSession,
    current_user: CurrentUser,
) -> ProviderKeyTestResponse:
    user_settings = await settings_service.get_or_create_user_settings(
        db, current_user.id
    )
    model = body.model or user_settings.default_model
    ok, message = await settings_service.test_provider_connection(
        db,
        current_user.id,
        provider,
        model,
        body.api_key.get_secret_value() if body.api_key else None,
    )
    return ProviderKeyTestResponse(
        ok=ok,
        provider=provider,
        model=model,
        message=message,
    )
