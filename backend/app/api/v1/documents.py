import logging
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.config import get_settings
from app.db.models import User
from app.schemas.documents import DocumentResponse
from app.services.documents import document_service
from app.services.projects import get_project_for_user

logger = logging.getLogger(__name__)
settings = get_settings()


router = APIRouter(prefix='/projects/{project_id}/documents', tags=['Documents'])

DbSession = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]


async def _get_owned_project(project_id: str, user: User, db: AsyncSession):
    project = await get_project_for_user(db=db, project_id=project_id, user_id=user.id)
    if not project:
        raise HTTPException(status_code=404, detail='Project not found')
    return project


@router.post('', response_model=DocumentResponse, status_code=201)
async def upload_document(
    project_id: str,
    file: Annotated[UploadFile, File(...)],
    db: DbSession,
    current_user: CurrentUser,
) -> DocumentResponse:
    await _get_owned_project(project_id, current_user, db)
    content = await file.read()
    try:
        doc = await document_service.upload_and_index(
            db=db,
            project_id=project_id,
            file_content=content,
            filename=file.filename,
        )
        await db.commit()
        await db.refresh(doc)
        return DocumentResponse.model_validate(doc)
    except Exception as exc:
        await db.rollback()
        # Best-effort: remove the file from Supabase if it was already uploaded
        # before the DB commit failed, to avoid orphaned storage objects.
        if document_service.supabase and file.filename:
            try:
                path = f'{project_id}/{file.filename}'
                document_service.supabase.storage.from_(settings.supabase_bucket).remove([path])
            except Exception:
                logger.warning('Orphan cleanup failed for %s/%s', project_id, file.filename)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get('', response_model=list[DocumentResponse])
async def list_documents(
    project_id: str,
    db: DbSession,
    current_user: CurrentUser,
) -> list[DocumentResponse]:
    await _get_owned_project(project_id, current_user, db)
    docs = await document_service.get_project_documents(db, project_id)
    return [DocumentResponse.model_validate(doc) for doc in docs]


@router.delete('/{document_id}', status_code=204)
async def delete_document(
    project_id: str,
    document_id: str,
    db: DbSession,
    current_user: CurrentUser,
):
    await _get_owned_project(project_id, current_user, db)
    success = await document_service.delete_document(db, document_id, project_id)
    if not success:
        raise HTTPException(status_code=404, detail='Document not found')
