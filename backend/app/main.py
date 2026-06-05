from typing import Any
from contextlib import asynccontextmanager

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
from app.api.v1.settings import router as settings_router
from app.api.v1.work import router as work_router
from fastapi.middleware.cors import CORSMiddleware


settings = get_settings()

limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])

app = FastAPI()
app.state.limiter = limiter


def rate_limit_exceeded_handler(request: Request, exc: Any) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={
            "detail": "Rate limit exceeded. Please try again later.",
            "retry_after": exc.detail,
        },
    )


app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    SessionMiddleware,
    secret_key=settings.secret_key.get_secret_value(),
    same_site="lax",
    https_only=not settings.debug,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app.include_router(auth_router, prefix="/api")
app.include_router(projects_router, prefix="/api")
app.include_router(documents_router, prefix="/api")
app.include_router(agents_router, prefix="/api")
app.include_router(settings_router, prefix="/api")
app.include_router(work_router, prefix="/api")


@app.get("/health")
async def health_check():
    return JSONResponse(content={"status": "ok"}, status_code=200)
