from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_db, get_current_user
from app.db.models import User, Project
from app.services.documents import document_service
from sqlalchemy import select

# Use a more specific prefix and handle routing carefully
router = APIRouter(prefix="/projects/{project_id}/documents", tags=["documents"])

async def get_project_for_user(project_id: str, user: User, db: AsyncSession) -> Project:
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == user.id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.post("")
@router.post("/")
async def upload_document(
    project_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify project ownership
    await get_project_for_user(project_id, current_user, db)
    
    content = await file.read()
    try:
        doc = await document_service.upload_and_index(
            db=db,
            project_id=project_id,
            file_content=content,
            filename=file.filename
        )
        # Commit DB addition (project.py handles commit for onboarding, but this is a direct upload)
        await db.commit()
        await db.refresh(doc)
        return doc
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("")
@router.get("/")
async def list_documents(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify project ownership
    await get_project_for_user(project_id, current_user, db)
    
    docs = await document_service.get_project_documents(db, project_id)
    return docs

@router.delete("/{document_id}")
async def delete_document(
    project_id: str,
    document_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify project ownership
    await get_project_for_user(project_id, current_user, db)
    
    success = await document_service.delete_document(db, document_id, project_id)
    if not success:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return {"status": "deleted"}
