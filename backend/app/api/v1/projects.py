from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.db.models import User
from app.schemas.projects import ProjectCreate, ProjectUpdate, ProjectResponse
from app.services.projects import (
    create_project,
    get_project,
    get_user_projects,
    update_project,
    delete_project,
)


router = APIRouter(prefix='/projects', tags=['Projects'])


@router.post('/', response_model=ProjectResponse, status_code=201)
async def create_new_project(
    body: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = await create_project(
        db=db,
        user_id=current_user.id,
        name=body.name,
        description=body.description,
        industry=body.industry,
    )
    return ProjectResponse.model_validate(project)


@router.get('/', response_model=list[ProjectResponse])
async def list_projects(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    projects = await get_user_projects(db=db, user_id=current_user.id)
    return [ProjectResponse.model_validate(p) for p in projects]


@router.get('/{project_id}', response_model=ProjectResponse)
async def get_single_project(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = await get_project(db=db, project_id=project_id)

    if not project:
        raise HTTPException(status_code=404, detail='Project not found')

    if project.user_id != current_user.id:
        raise HTTPException(status_code=403, detail='Not authorized')

    return ProjectResponse.model_validate(project)


@router.patch('/{project_id}', response_model=ProjectResponse)
async def update_existing_project(
    project_id: str,
    body: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = await update_project(
        db=db,
        project_id=project_id,
        user_id=current_user.id,
        name=body.name,
        description=body.description,
        industry=body.industry,
    )

    if not project:
        raise HTTPException(status_code=404, detail='Project not found')

    return ProjectResponse.model_validate(project)


@router.delete('/{project_id}', status_code=204)
async def delete_existing_project(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deleted = await delete_project(db=db, project_id=project_id, user_id=current_user.id)

    if not deleted:
        raise HTTPException(status_code=404, detail='Project not found')
