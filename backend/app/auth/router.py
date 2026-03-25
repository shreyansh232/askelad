from fastapi import APIRouter, Depends, HTTPException
from starlette.requests import Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi.responses import RedirectResponse
from app.api.deps import get_db
from app.auth.oauth import oauth
from app.auth.service import find_or_create_user, store_refresh_token, get_user_by_refresh_token, logout_user
from app.auth.jwt_handler import create_access_token, verify_access_token, generate_refresh_token
from app.schemas.users import UserResponse
from fastapi.responses import JSONResponse
from app.db.models import User
from app.config import get_settings

settings = get_settings()

router = APIRouter(prefix='/auth', tags=['Authentication'])

@router.get('/login')
async def login(request: Request):
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

    response = RedirectResponse(url=f"{frontend_base}/auth/callback", status_code=302)

    response.set_cookie(
            key="access_token",
            value=access_token,
            httponly=True,
            secure=not settings.debug,
            samesite="none" if not settings.debug else "lax",
            max_age=settings.access_token_expire_minutes * 60,
            path="/"
        )

    response.set_cookie(
            key="refresh_token",
            value=refresh_token,
            httponly=True,
            secure=not settings.debug,
            samesite="none" if not settings.debug else "lax",
            max_age=60 * 60 * 24 * 30,
            path="/"
        )

    return response


@router.post('/refresh')
async def refresh_tokens(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Read refresh_token from cookie, rotate tokens, set new cookies."""
    old_refresh_token = request.cookies.get('refresh_token')

    if not old_refresh_token:
        raise HTTPException(status_code=401, detail='No refresh token cookie')

    user = await get_user_by_refresh_token(db, old_refresh_token)

    if not user:
        raise HTTPException(status_code=401, detail='Invalid or expired refresh token')

    # Rotate: issue new tokens and invalidate the old refresh token
    new_access_token = create_access_token(user_id=user.id)
    new_refresh_token = generate_refresh_token()
    await store_refresh_token(db, user.id, new_refresh_token)

    response = JSONResponse(content={'message': 'Tokens refreshed'})
    response.set_cookie(
        key='access_token',
        value=new_access_token,
        httponly=True,
        secure=not settings.debug,
        samesite="none" if not settings.debug else "lax",
        max_age=settings.access_token_expire_minutes * 60,
        path='/'
    )
    response.set_cookie(
        key='refresh_token',
        value=new_refresh_token,
        httponly=True,
        secure=not settings.debug,
        samesite="none" if not settings.debug else "lax",
        max_age=60 * 60 * 24 * 30,
        path='/'
    )
    return response

@router.post('/logout')
async def logout(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    token = request.cookies.get('access_token')
    if not token:
        raise HTTPException(status_code=401, detail='Not authenticated')

    user_id = verify_access_token(token)

    if not user_id:
        raise HTTPException(status_code=401, detail='Invalid or expired token')

    await logout_user(db, user_id)

    response = JSONResponse(content={'message': 'Logged out successfully'})
    response.delete_cookie('access_token', path='/')
    response.delete_cookie('refresh_token', path='/')
    return response



@router.get('/me')
async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)):
    token = request.cookies.get('access_token')

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
