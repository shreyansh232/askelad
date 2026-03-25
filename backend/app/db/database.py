from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings

settings = get_settings()

def _normalize_asyncpg_url(database_url: str) -> str:
    url = make_url(database_url)
    sslmode = url.query.get('sslmode')

    if not sslmode:
        return database_url

    query = dict(url.query)
    query.pop('sslmode', None)
    query['ssl'] = sslmode
    return str(url.set(query=query))


engine: AsyncEngine = create_async_engine(_normalize_asyncpg_url(settings.database_url))

AsyncSessionLocal = async_sessionmaker(
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
    bind=engine
)

class Base(DeclarativeBase):
    pass
