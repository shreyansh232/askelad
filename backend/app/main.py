from fastapi import FastAPI, Request
from starlette.middleware.sessions import SessionMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from app.config import get_settings
from app.auth.router import router as auth_router
from app.api.v1.agents import router as agents_router
from app.api.v1.projects import router as projects_router
from app.api.v1.documents import router as documents_router
from fastapi.middleware.cors import CORSMiddleware


settings = get_settings()

# Initialize rate limiter - uses IP address by default
limiter = Limiter(key_func=get_remote_address)

app = FastAPI()

# Add rate limiter to app state for access in routes
app.state.limiter = limiter


def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    """Custom handler for rate limit exceeded errors."""
    return JSONResponse(
        status_code=429,
        content={
            "detail": "Rate limit exceeded. Please try again later.",
            "retry_after": exc.detail,
        },
    )


# Add rate limit exception handler
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.add_middleware(
    SessionMiddleware,  # When a user logs in, their session data is encrypted into a cookie on their browser. Every time they make a request, this middleware automatically decodes that cookie so you know who they are.
    secret_key=settings.secret_key.get_secret_value(),
    same_site="none"
    if not settings.debug
    else "lax",  # Prevents CSRF while allowing OAuth redirects
    https_only=not settings.debug,  # Require HTTPS in production
)

app.include_router(auth_router, prefix="/api")
app.include_router(projects_router, prefix="/api")
app.include_router(documents_router, prefix="/api")
app.include_router(agents_router, prefix="/api")


@app.get("/health")
async def health_check():
    return JSONResponse(content={"status": "ok"}, status_code=200)
