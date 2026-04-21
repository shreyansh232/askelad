import logging
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException
from starlette.requests import Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi.responses import RedirectResponse
from app.api.deps import get_db
from app.auth.oauth import oauth
from app.auth.service import find_or_create_user, store_refresh_token, get_user_by_refresh_token, logout_user
from app.auth.jwt_handler import create_access_token, verify_access_token, generate_refresh_token
from app.schemas.users import AuthResponse, RefreshRequest, UserResponse
from fastapi.responses import JSONResponse
from app.db.models import User
from app.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

router = APIRouter(prefix='/auth', tags=['Authentication'])


def _get_bearer_token(request: Request) -> str | None:
    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer '):
        return auth_header.split(' ', 1)[1]

    return request.cookies.get('access_token')


def _to_user_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        picture_url=user.picture_url,
        user_type=user.user_type.value,
    )

@router.get('/login')
async def login(request: Request):
    frontend_base = settings.frontend_url
    
    # Store it in session so it survives the redirect to Google and back
    request.session["frontend_base"] = frontend_base

    redirect_uri = settings.google_redirect_uri

    return await oauth.google.authorize_redirect(request, redirect_uri)


@router.get('/callback', name='auth_callback')
async def auth_callback(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    frontend_base = request.session.get("frontend_base") or settings.frontend_url
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
    
    try:
        user = await find_or_create_user(
            db=db,
            google_id=userinfo['sub'],
            email=userinfo['email'],
            name=userinfo.get('name'),
            picture_url=userinfo.get('picture')
        )

        access_token = create_access_token(user_id=user.id)
        refresh_token = generate_refresh_token()

        await store_refresh_token(db, user.id, refresh_token)

        fragment = urlencode(
            {
                "access_token": access_token,
                "refresh_token": refresh_token,
            }
        )
        return RedirectResponse(url=f"{frontend_base}/auth/callback#{fragment}", status_code=302)
    except Exception:
        logger.exception("Google auth callback failed after token exchange")
        return RedirectResponse(
            url=f"{frontend_base}/auth/callback?error=auth_callback_failed",
            status_code=302,
        )


@router.post('/refresh')
async def refresh_tokens(
    request: Request,
    body: RefreshRequest | None = None,
    db: AsyncSession = Depends(get_db)
):
    old_refresh_token = body.refresh_token if body else None
    if not old_refresh_token:
        old_refresh_token = request.cookies.get('refresh_token')

    if not old_refresh_token:
        raise HTTPException(status_code=401, detail='No refresh token provided')

    user = await get_user_by_refresh_token(db, old_refresh_token)

    if not user:
        raise HTTPException(status_code=401, detail='Invalid or expired refresh token')

    new_access_token = create_access_token(user_id=user.id)
    new_refresh_token = generate_refresh_token()
    await store_refresh_token(db, user.id, new_refresh_token)

    return AuthResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        user=_to_user_response(user),
    )

@router.post('/logout')
async def logout(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    token = _get_bearer_token(request)
    if not token:
        raise HTTPException(status_code=401, detail='Not authenticated')

    user_id = verify_access_token(token)

    if not user_id:
        raise HTTPException(status_code=401, detail='Invalid or expired token')

    await logout_user(db, user_id)

    return JSONResponse(content={'message': 'Logged out successfully'})



@router.get('/me')
async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)):
    token = _get_bearer_token(request)

    if not token:
        raise HTTPException(status_code=401, detail='Not authenticated')

    user_id = verify_access_token(token)

    if not user_id:
        raise HTTPException(status_code=401, detail='Invalid or expired token')

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail='User not found')

    return UserResponse.model_validate(user)
