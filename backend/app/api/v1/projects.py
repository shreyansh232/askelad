from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
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
from app.services.documents import document_service


router = APIRouter(prefix='/projects', tags=['Projects'])


@router.post('/', response_model=ProjectResponse, status_code=201)
async def create_new_project(
    name: str = Form(...),
    description: Optional[str] = Form(None),
    industry: Optional[str] = Form(None),
    files: List[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 1. Create project record (flushes, but doesn't commit yet)
    project = await create_project(
        db=db,
        user_id=current_user.id,
        name=name,
        description=description,
        industry=industry,
    )

    # 2. Index project metadata for RAG (Side effect: Pinecone)
    try:
        await document_service.index_project_metadata(
            project_id=project.id,
            name=name,
            industry=industry or "General",
            description=description or ""
        )
    except Exception as e:
        # Log error but don't fail the whole request
        print(f"Error indexing metadata to Pinecone: {e}")

    # 3. Handle file uploads if any
    if files:
        for file in files:
            try:
                content = await file.read()
                await document_service.upload_and_index(
                    db=db,
                    project_id=project.id,
                    file_content=content,
                    filename=file.filename
                )
            except Exception as e:
                # Log file-specific error
                print(f"Error indexing file {file.filename}: {e}")
    
    # Final Commit for all DB changes (Project + Documents)
    await db.commit()
    await db.refresh(project)

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
