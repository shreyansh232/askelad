from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncEngine
from sqlalchemy.orm import DeclarativeBase
from app.config import get_settings

settings = get_settings()


engine: AsyncEngine = create_async_engine(settings.database_url)

AsyncSessionLocal = async_sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

class Base(DeclarativeBase):
    pass
