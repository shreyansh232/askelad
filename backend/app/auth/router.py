from fastapi import APIRouter, Depends, HTTPException
from starlette.requests import Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_db
from app.auth.oauth import oauth
from app.auth.service import find_or_create_user, store_refresh_token, get_user_by_refresh_token, logout_user
from app.auth.jwt_handler import create_access_token, verify_access_token, generate_refresh_token
from app.schemas.users import AuthResponse, UserResponse, RefreshRequest
from app.db.models import User


router = APIRouter(prefix='/auth', tags=['Authentication'])

@router.get('/login')
async def login(request: Request):
    redirect_uri = request.url_for('auth_callback')

    return await oauth.google.authorize_redirect(request, redirect_uri)


@router.get('/callback', name='auth_callback')
async def auth_callback(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    try:
        token = await oauth.google.authorize_access_token(request)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f'OAuth authentication failed: {str(e)}'
        )
    
    userinfo = token.get('userinfo')

    if not userinfo:
        raise HTTPException(
            status_code=400,
            detail='Failed to get user info from Google'
        )
    
    user = await find_or_create_user(
        db=db,
        google_id=userinfo['sub'],
        email=userinfo['email'],
        name=userinfo.get('name'),
        picture_url=userinfo.get('picture')
    )

    access_token = create_access_token(user_id=user.id)
    refresh_token = generate_refresh_token()

    # Store refresh token in DB
    await store_refresh_token(db, user.id, refresh_token)

    return AuthResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse.model_validate(user)
    )


@router.post('/refresh')
async def refresh_tokens(
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db)
):
    """Exchange a valid refresh token for a new access + refresh token pair."""
    user = await get_user_by_refresh_token(db, body.refresh_token)

    if not user:
        raise HTTPException(status_code=401, detail='Invalid or expired refresh token')

    # Rotate: issue new tokens and invalidate the old refresh token
    new_access_token = create_access_token(user_id=user.id)
    new_refresh_token = generate_refresh_token()
    await store_refresh_token(db, user.id, new_refresh_token)

    return AuthResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        user=UserResponse.model_validate(user)
    )

@router.post('/logout')
async def logout(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        raise HTTPException(status_code=401, detail='Not authenticated')
    
    token = auth_header.split(' ')[1]
    user_id = verify_access_token(token)

    if not user_id:
        raise HTTPException(status_code=401, detail='Invalid or expired token')
    
    await logout_user(db, user_id)
    return {'message' : 'Logged out successfully'}



@router.get('/me')
async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)):
    auth_header = request.headers.get('Authorization')

    if not auth_header or not auth_header.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = auth_header.split(' ')[1]

    user_id = verify_access_token(token)

    if not user_id:
        raise HTTPException(status_code=401, detail='Invalid or expired token')
    
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail='User not found')
    
    return UserResponse.model_validate(user)
