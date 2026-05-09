import base64
import hashlib
from dataclasses import dataclass
from datetime import datetime, timezone

from cryptography.fernet import Fernet, InvalidToken
from litellm import acompletion
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.models import (
    AgentMessage,
    AgentThread,
    Project,
    ProviderKey,
    User,
    UserSettings,
)
from app.schemas.settings import ProviderName, UserSettingsResponse


settings = get_settings()


@dataclass(frozen=True)
class RuntimeLLMSettings:
    provider: str
    model: str
    api_key: str | None
    uses_platform_key: bool


class SettingsService:
    def _fernet(self) -> Fernet:
        secret = settings.secret_key.get_secret_value().encode("utf-8")
        digest = hashlib.sha256(secret).digest()
        return Fernet(base64.urlsafe_b64encode(digest))

    def encrypt_key(self, api_key: str) -> str:
        return self._fernet().encrypt(api_key.encode("utf-8")).decode("utf-8")

    def decrypt_key(self, encrypted_api_key: str) -> str:
        try:
            return (
                self._fernet()
                .decrypt(encrypted_api_key.encode("utf-8"))
                .decode("utf-8")
            )
        except InvalidToken as exc:
            raise RuntimeError("Provider key could not be decrypted") from exc

    def key_hint(self, api_key: str) -> str:
        if len(api_key) <= 8:
            return "••••"
        return f"{api_key[:4]}…{api_key[-4:]}"

    async def get_or_create_user_settings(
        self, db: AsyncSession, user_id: str
    ) -> UserSettings:
        result = await db.execute(
            select(UserSettings).where(UserSettings.user_id == user_id)
        )
        user_settings = result.scalar_one_or_none()
        if user_settings:
            return user_settings

        user_settings = UserSettings(
            user_id=user_id,
            default_provider="openai",
            default_model=settings.llm_model,
            platform_key_fallback=True,
        )
        db.add(user_settings)
        await db.commit()
        await db.refresh(user_settings)
        return user_settings

    async def list_provider_keys(
        self, db: AsyncSession, user_id: str
    ) -> list[ProviderKey]:
        result = await db.execute(
            select(ProviderKey)
            .where(ProviderKey.user_id == user_id)
            .order_by(ProviderKey.provider.asc())
        )
        return list(result.scalars().all())

    async def used_prompt_count(self, db: AsyncSession, user_id: str) -> int:
        result = await db.execute(
            select(func.count())
            .select_from(AgentMessage)
            .join(AgentThread, AgentMessage.thread_id == AgentThread.id)
            .join(Project, AgentThread.project_id == Project.id)
            .where(Project.user_id == user_id, AgentMessage.role == "user")
        )
        return int(result.scalar_one())

    def plan_limit_for_user(self, user: User) -> int:
        plan = user.user_type.value
        return {
            "free": settings.plan_limit_free,
            "premium": settings.plan_limit_premium,
            "admin": settings.plan_limit_admin,
        }.get(plan, settings.plan_limit_free)

    async def build_response(
        self, db: AsyncSession, user: User
    ) -> UserSettingsResponse:
        user_settings = await self.get_or_create_user_settings(db, user.id)
        provider_keys = await self.list_provider_keys(db, user.id)
        used_prompts = await self.used_prompt_count(db, user.id)
        return UserSettingsResponse(
            default_provider=user_settings.default_provider,
            default_model=user_settings.default_model,
            platform_key_fallback=user_settings.platform_key_fallback,
            monthly_prompt_limit=user_settings.monthly_prompt_limit,
            plan_prompt_limit=self.plan_limit_for_user(user),
            used_prompts=used_prompts,
            provider_keys=provider_keys,
        )

    async def update_user_settings(
        self,
        db: AsyncSession,
        user_id: str,
        default_provider: ProviderName | None = None,
        default_model: str | None = None,
        platform_key_fallback: bool | None = None,
        monthly_prompt_limit: int | None = None,
    ) -> UserSettings:
        user_settings = await self.get_or_create_user_settings(db, user_id)
        if default_provider is not None:
            user_settings.default_provider = default_provider
        if default_model is not None:
            user_settings.default_model = default_model
        if platform_key_fallback is not None:
            user_settings.platform_key_fallback = platform_key_fallback
        if monthly_prompt_limit is not None:
            user_settings.monthly_prompt_limit = monthly_prompt_limit
        await db.commit()
        await db.refresh(user_settings)
        return user_settings

    async def upsert_provider_key(
        self, db: AsyncSession, user_id: str, provider: ProviderName, api_key: str
    ) -> ProviderKey:
        result = await db.execute(
            select(ProviderKey).where(
                ProviderKey.user_id == user_id,
                ProviderKey.provider == provider,
            )
        )
        provider_key = result.scalar_one_or_none()
        encrypted = self.encrypt_key(api_key)
        if provider_key:
            provider_key.encrypted_api_key = encrypted
            provider_key.key_hint = self.key_hint(api_key)
            provider_key.status = "untested"
            provider_key.last_error = None
        else:
            provider_key = ProviderKey(
                user_id=user_id,
                provider=provider,
                encrypted_api_key=encrypted,
                key_hint=self.key_hint(api_key),
                status="untested",
            )
            db.add(provider_key)

        await db.commit()
        await db.refresh(provider_key)
        return provider_key

    async def delete_provider_key(
        self, db: AsyncSession, user_id: str, provider: ProviderName
    ) -> bool:
        result = await db.execute(
            select(ProviderKey).where(
                ProviderKey.user_id == user_id,
                ProviderKey.provider == provider,
            )
        )
        provider_key = result.scalar_one_or_none()
        if not provider_key:
            return False
        await db.delete(provider_key)
        await db.commit()
        return True

    async def get_runtime_settings(
        self, db: AsyncSession, user_id: str
    ) -> RuntimeLLMSettings:
        user_settings = await self.get_or_create_user_settings(db, user_id)
        result = await db.execute(
            select(ProviderKey).where(
                ProviderKey.user_id == user_id,
                ProviderKey.provider == user_settings.default_provider,
            )
        )
        provider_key = result.scalar_one_or_none()
        if provider_key:
            return RuntimeLLMSettings(
                provider=user_settings.default_provider,
                model=user_settings.default_model,
                api_key=self.decrypt_key(provider_key.encrypted_api_key),
                uses_platform_key=False,
            )

        if user_settings.platform_key_fallback and settings.openai_api_key:
            return RuntimeLLMSettings(
                provider="openai",
                model=settings.llm_model,
                api_key=settings.openai_api_key.get_secret_value(),
                uses_platform_key=True,
            )

        return RuntimeLLMSettings(
            provider=user_settings.default_provider,
            model=user_settings.default_model,
            api_key=None,
            uses_platform_key=False,
        )

    async def test_provider_connection(
        self,
        db: AsyncSession,
        user_id: str,
        provider: ProviderName,
        model: str,
        api_key: str | None = None,
    ) -> tuple[bool, str]:
        provider_key = None
        if api_key is None:
            result = await db.execute(
                select(ProviderKey).where(
                    ProviderKey.user_id == user_id,
                    ProviderKey.provider == provider,
                )
            )
            provider_key = result.scalar_one_or_none()
            if provider_key:
                api_key = self.decrypt_key(provider_key.encrypted_api_key)

        if not api_key:
            return False, "No provider key available to test."

        try:
            await acompletion(
                model=model,
                api_key=api_key,
                messages=[{"role": "user", "content": "Return ok."}],
                max_tokens=4,
                temperature=0,
            )
        except Exception as exc:
            if provider_key:
                provider_key.status = "invalid"
                provider_key.last_error = str(exc)
                provider_key.last_tested_at = datetime.now(timezone.utc)
                await db.commit()
            return False, str(exc)

        if provider_key:
            provider_key.status = "valid"
            provider_key.last_error = None
            provider_key.last_tested_at = datetime.now(timezone.utc)
            await db.commit()
        return True, "Connection succeeded."


settings_service = SettingsService()
