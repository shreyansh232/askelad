import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt

from app.config import get_settings


settings = get_settings()

ACCESS_TOKEN_EXPIRE_MINUTES = settings.access_token_expire_minutes


def create_access_token(user_id: str, expires_delta: Optional[timedelta] = None) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    payload = {
        'sub' : user_id,
        'exp': expire,
        'iat': datetime.now(timezone.utc)
    }


    token = jwt.encode(
        payload,
        settings.secret_key.get_secret_value(),
        algorithm='HS256'
    )

    return token


def verify_access_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(
            token,
            settings.secret_key.get_secret_value(),
            algorithms=['HS256']
        )
        return payload.get('sub')
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def generate_refresh_token() -> str:
    """Generate a cryptographically secure random refresh token."""
    return secrets.token_urlsafe(32)

