from typing import AsyncGenerator
from fastapi import Depends, HTTPException
from starlette.requests import Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.database import AsyncSessionLocal
from app.auth.jwt_handler import verify_access_token
from app.db.models import User


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as db:
        yield db


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    auth_header = request.headers.get('Authorization')

    if not auth_header or not auth_header.startswith('Bearer '):
        raise HTTPException(status_code=401, detail='Not authenticated')

    token = auth_header.split(' ')[1]
    user_id = verify_access_token(token)

    if not user_id:
        raise HTTPException(status_code=401, detail='Invalid or expired token')

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=401, detail='User not found')

    return user