from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.db.models import User
from app.schemas.work import (
    ArtifactCreate,
    ArtifactResponse,
    ArtifactVersionCreate,
    ArtifactVersionResponse,
    CofounderDigestCreate,
    CofounderDigestResponse,
    CofounderMonitorCreate,
    CofounderMonitorResponse,
    CofounderMonitorUpdate,
    TaskCreate,
    TaskEventCreate,
    TaskEventResponse,
    TaskResponse,
    TaskUpdate,
    WorkQueueResponse,
)
from app.services.projects import get_project_for_user
from app.services.work import work_service


router = APIRouter(prefix="/projects/{project_id}", tags=["Founder Work"])

DbSession = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]


async def _ensure_project(db: AsyncSession, project_id: str, user: User) -> None:
    project = await get_project_for_user(db, project_id, user.id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")


@router.get("/work-queue", response_model=WorkQueueResponse)
async def get_work_queue(
    project_id: str,
    db: DbSession,
    current_user: CurrentUser,
) -> WorkQueueResponse:
    await _ensure_project(db, project_id, current_user)
    return await work_service.build_work_queue(db, project_id)


@router.get("/tasks", response_model=list[TaskResponse])
async def list_tasks(
    project_id: str,
    db: DbSession,
    current_user: CurrentUser,
    status: Annotated[str | None, Query(max_length=40)] = None,
) -> list[TaskResponse]:
    await _ensure_project(db, project_id, current_user)
    tasks = await work_service.list_tasks(db, project_id, status)
    return [TaskResponse.model_validate(task) for task in tasks]


@router.post("/tasks", response_model=TaskResponse, status_code=201)
async def create_task(
    project_id: str,
    body: TaskCreate,
    db: DbSession,
    current_user: CurrentUser,
) -> TaskResponse:
    await _ensure_project(db, project_id, current_user)
    task = await work_service.create_task(
        db,
        project_id,
        title=body.title,
        description=body.description,
        status=body.status,
        priority=body.priority,
        owner_agent_type=body.owner_agent_type,
        due_at=body.due_at,
        blocked_reason=body.blocked_reason,
        actor_type="founder",
        actor_label=current_user.email,
    )
    await db.commit()
    await db.refresh(task)
    return TaskResponse.model_validate(task)


@router.patch("/tasks/{task_id}", response_model=TaskResponse)
async def update_task(
    project_id: str,
    task_id: str,
    body: TaskUpdate,
    db: DbSession,
    current_user: CurrentUser,
) -> TaskResponse:
    await _ensure_project(db, project_id, current_user)
    task = await work_service.update_task(
        db,
        project_id,
        task_id,
        actor_type="founder",
        actor_label=current_user.email,
        **body.model_dump(exclude_unset=True),
    )
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    await db.commit()
    await db.refresh(task)
    return TaskResponse.model_validate(task)


@router.get("/tasks/{task_id}/events", response_model=list[TaskEventResponse])
async def list_task_events(
    project_id: str,
    task_id: str,
    db: DbSession,
    current_user: CurrentUser,
) -> list[TaskEventResponse]:
    await _ensure_project(db, project_id, current_user)
    events = await work_service.list_task_events(db, project_id, task_id)
    return [TaskEventResponse.model_validate(event) for event in events]


@router.post(
    "/tasks/{task_id}/events",
    response_model=TaskEventResponse,
    status_code=201,
)
async def add_task_event(
    project_id: str,
    task_id: str,
    body: TaskEventCreate,
    db: DbSession,
    current_user: CurrentUser,
) -> TaskEventResponse:
    await _ensure_project(db, project_id, current_user)
    event = await work_service.add_task_event(
        db,
        project_id,
        task_id,
        body.event_type,
        body.summary,
        actor_type=body.actor_type,
        actor_label=body.actor_label or current_user.email,
        metadata_json=body.metadata_json,
    )
    if not event:
        raise HTTPException(status_code=404, detail="Task not found")
    await db.commit()
    await db.refresh(event)
    return TaskEventResponse.model_validate(event)


@router.get("/artifacts", response_model=list[ArtifactResponse])
async def list_artifacts(
    project_id: str,
    db: DbSession,
    current_user: CurrentUser,
) -> list[ArtifactResponse]:
    await _ensure_project(db, project_id, current_user)
    artifacts = await work_service.list_artifacts(db, project_id)
    return [
        work_service.artifact_response(artifact, version)
        for artifact, version in artifacts
    ]


@router.post("/artifacts", response_model=ArtifactResponse, status_code=201)
async def create_artifact(
    project_id: str,
    body: ArtifactCreate,
    db: DbSession,
    current_user: CurrentUser,
) -> ArtifactResponse:
    await _ensure_project(db, project_id, current_user)
    artifact, version = await work_service.create_artifact(
        db,
        project_id,
        title=body.title,
        artifact_type=body.artifact_type,
        format=body.format,
        content=body.content,
        task_id=body.task_id,
        created_by=current_user.email,
        metadata_json=body.metadata_json,
    )
    await db.commit()
    await db.refresh(artifact)
    await db.refresh(version)
    return work_service.artifact_response(artifact, version)


@router.post(
    "/artifacts/{artifact_id}/versions",
    response_model=ArtifactVersionResponse,
    status_code=201,
)
async def add_artifact_version(
    project_id: str,
    artifact_id: str,
    body: ArtifactVersionCreate,
    db: DbSession,
    current_user: CurrentUser,
) -> ArtifactVersionResponse:
    await _ensure_project(db, project_id, current_user)
    result = await work_service.add_artifact_version(
        db,
        project_id,
        artifact_id,
        content=body.content,
        created_by=body.created_by or current_user.email,
        metadata_json=body.metadata_json,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Artifact not found")
    _artifact, version = result
    await db.commit()
    await db.refresh(version)
    return ArtifactVersionResponse.model_validate(version)


@router.get("/artifacts/{artifact_id}/export")
async def export_artifact(
    project_id: str,
    artifact_id: str,
    db: DbSession,
    current_user: CurrentUser,
    format: Annotated[str, Query(pattern="^(markdown|csv|pdf)$")] = "markdown",
) -> Response:
    await _ensure_project(db, project_id, current_user)
    artifact = await work_service.get_artifact(db, project_id, artifact_id)
    if not artifact:
        raise HTTPException(status_code=404, detail="Artifact not found")
    version = await work_service.get_current_artifact_version(db, artifact)
    artifact_response = work_service.artifact_response(artifact, version)
    filename = artifact_response.title.lower().replace(" ", "-")
    if format == "csv":
        return Response(
            work_service.export_csv(artifact_response),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}.csv"'},
        )
    if format == "pdf":
        return Response(
            work_service.export_pdf_bytes(artifact_response),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}.pdf"'},
        )
    return Response(
        work_service.export_markdown(artifact_response),
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{filename}.md"'},
    )


@router.get("/cofounder/digests", response_model=list[CofounderDigestResponse])
async def list_cofounder_digests(
    project_id: str,
    db: DbSession,
    current_user: CurrentUser,
) -> list[CofounderDigestResponse]:
    await _ensure_project(db, project_id, current_user)
    digests = await work_service.list_digests(db, project_id)
    return [CofounderDigestResponse.model_validate(digest) for digest in digests]


@router.post(
    "/cofounder/digests",
    response_model=CofounderDigestResponse,
    status_code=201,
)
async def create_cofounder_digest(
    project_id: str,
    body: CofounderDigestCreate,
    db: DbSession,
    current_user: CurrentUser,
) -> CofounderDigestResponse:
    await _ensure_project(db, project_id, current_user)
    digest = await work_service.create_digest(db, project_id, body.cadence)
    return CofounderDigestResponse.model_validate(digest)


@router.get("/cofounder/monitors", response_model=list[CofounderMonitorResponse])
async def list_cofounder_monitors(
    project_id: str,
    db: DbSession,
    current_user: CurrentUser,
) -> list[CofounderMonitorResponse]:
    await _ensure_project(db, project_id, current_user)
    monitors = await work_service.list_monitors(db, project_id)
    return [CofounderMonitorResponse.model_validate(monitor) for monitor in monitors]


@router.post(
    "/cofounder/monitors",
    response_model=CofounderMonitorResponse,
    status_code=201,
)
async def create_cofounder_monitor(
    project_id: str,
    body: CofounderMonitorCreate,
    db: DbSession,
    current_user: CurrentUser,
) -> CofounderMonitorResponse:
    await _ensure_project(db, project_id, current_user)
    monitor = await work_service.create_monitor(
        db,
        project_id,
        title=body.title,
        monitor_type=body.monitor_type,
        query=body.query,
        cadence=body.cadence,
    )
    return CofounderMonitorResponse.model_validate(monitor)


@router.patch(
    "/cofounder/monitors/{monitor_id}",
    response_model=CofounderMonitorResponse,
)
async def update_cofounder_monitor(
    project_id: str,
    monitor_id: str,
    body: CofounderMonitorUpdate,
    db: DbSession,
    current_user: CurrentUser,
) -> CofounderMonitorResponse:
    await _ensure_project(db, project_id, current_user)
    monitor = await work_service.update_monitor(
        db,
        project_id,
        monitor_id,
        **body.model_dump(exclude_unset=True),
    )
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")
    return CofounderMonitorResponse.model_validate(monitor)
