import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import User


async def find_or_create_user(
    db: AsyncSession,
    google_id: str,
    email: str,
    name: str | None = None,
    picture_url: str | None = None
) -> User:
    result = await db.execute(select(User).where(User.google_id == google_id))
    user = result.scalar_one_or_none()

    if user:
        user.email = email

        if name is not None:
            user.name = name
        if picture_url is not None:
            user.picture_url = picture_url
        
        await db.commit()
        await db.refresh(user)
        return user
    
    user = User(
        id=str(uuid.uuid4()),
        google_id=google_id,
        email=email,
        name=name,
        picture_url=picture_url
    )

    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def logout_user(db: AsyncSession, user_id: str) -> None:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user:
        user.refresh_token = None
        await db.commit()


async def store_refresh_token(db: AsyncSession, user_id: str, token: str) -> None:
    """Store a refresh token on the user."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user:
        user.refresh_token = token
        await db.commit()


async def get_user_by_refresh_token(db: AsyncSession, token: str) -> User | None:
    """Look up a user by refresh token. Returns None if not found."""
    result = await db.execute(select(User).where(User.refresh_token == token))
    user = result.scalar_one_or_none()
    return user


