from fastapi import FastAPI
from starlette.middleware.sessions import SessionMiddleware
from fastapi.responses import JSONResponse
from app.config import get_settings
from app.auth.router import router as auth_router
from app.api.v1.projects import router as projects_router
from fastapi.middleware.cors import CORSMiddleware


settings = get_settings()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.frontend_url,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


app.add_middleware(
    SessionMiddleware, #When a user logs in, their session data is encrypted into a cookie on their browser. Every time they make a request, this middleware automatically decodes that cookie so you know who they are.
    secret_key=settings.secret_key.get_secret_value(),
    same_site="lax",  # Prevents CSRF while allowing OAuth redirects
    https_only=not settings.debug,  # Require HTTPS in production
)

app.include_router(auth_router, prefix='/api')
app.include_router(projects_router, prefix='/api')

@app.get("/health")
async def health_check():
    return JSONResponse(content={"status": "ok"}, status_code=200)


