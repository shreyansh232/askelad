from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Project



async def create_project(db: AsyncSession, user_id: str, name: str, description: Optional[str] = None, industry: Optional[str] = None) -> Project:
    project = Project(
        user_id=user_id,
        name=name,
        description=description,
        industry=industry
        )

    db.add(project)
    await db.flush() # Use flush instead of commit to get the ID without ending the transaction
    await db.refresh(project)
    return project



async def get_project(db: AsyncSession, project_id: str) -> Optional[Project]:
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()

    return project


async def get_project_for_user(
    db: AsyncSession,
    project_id: str,
    user_id: str,
) -> Optional[Project]:
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def get_user_projects(db: AsyncSession, user_id: str) -> list[Project]:
    result = await db.execute(select(Project).where(Project.user_id == user_id))
    projects = result.scalars().all()

    return projects

async def update_project(db: AsyncSession, project_id: str, user_id: str, name: Optional[str] = None, description: Optional[str] = None, industry: Optional[str] = None) -> Optional[Project]:
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == user_id)
    )
    project = result.scalar_one_or_none()

    if not project:
        return None

    if name is not None:
        project.name = name
    if description is not None:
        project.description = description
    if industry is not None:
        project.industry = industry

    await db.commit()
    await db.refresh(project)
    return project


async def delete_project(db: AsyncSession, project_id: str, user_id: str) -> bool:
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == user_id)
    )
    project = result.scalar_one_or_none()

    if not project:
        return False

    await db.delete(project)
    await db.commit()
    return True

    
