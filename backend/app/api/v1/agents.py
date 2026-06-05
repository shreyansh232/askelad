"""
Agents API - FastAPI endpoints for AI agent interactions.

This file is the "outer layer" - it handles:
- HTTP requests/responses
- Authentication (who is making the request)
- Authorization (do they own this project?)
- Input validation (Pydantic schemas)
- Streaming responses (SSE - Server-Sent Events)

It delegates actual work to AgentService (the "inner layer").
Think of it as: API layer = "request handler", Service layer = "business logic"

First principles:
- Routes follow REST patterns (/projects/{id}/agents/{type}/messages)
- All routes require authentication (get_current_user dependency)
- All routes check project ownership (user owns this project)
- Responses use Pydantic models (automatic validation + documentation)
"""

import json
from typing import Annotated, Any, AsyncIterator, cast

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.config import get_settings
from app.db.models import AgentMessage, AgentThread, Document, User
from app.schemas.agents import (
    AgentHistoryResponse,
    AgentMessageCreate,
    AgentMessageCreateResponse,
    AgentMessageResponse,
    AgentMessageRole,
    AgentRunResponse,
    AgentSummaryResponse,
    AgentType,
    AgentThreadResponse,
    AgentThreadCreate,
    AgentThreadUpdate,
    ClarificationRequestResponse,
    ClarificationResolutionRequest,
    ClarificationResolutionResponse,
)
from app.schemas.documents import DocumentResponse
from app.services.agents import agent_service
from app.services.projects import get_project_for_user


# Create router with prefix - all routes start with /projects/{project_id}
# 'Agents' tag groups these in OpenAPI docs
router = APIRouter(prefix="/projects/{project_id}", tags=["Agents"])

# Type aliases for dependency injection - cleaner syntax
# Instead of: async def foo(db: AsyncSession = Depends(get_db))
# We can write: async def foo(db: DbSession)
DbSession = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]

# Rate limiter instance - uses request object to get client IP
limiter = Limiter(key_func=get_remote_address)

# App settings (plan limits etc.)
_settings = get_settings()

# Plan → message limit per agent mapping.  -1 means unlimited.
_PLAN_LIMITS: dict[str, int] = {
    "free": _settings.plan_limit_free,
    "premium": _settings.plan_limit_premium,
    "admin": _settings.plan_limit_admin,
}


def _encode_sse(event: str, data: dict[str, Any]) -> str:
    """
    Encode data as Server-Sent Events (SSE) format.

    SSE format:
    event: <event_name>
    data: <json_data>
    <blank line>

    Used for streaming - allows client to receive events incrementally.
    """
    return f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"


async def _get_owned_project(
    db: DbSession,
    current_user: CurrentUser,
    project_id: str,
):
    """
    Security check: Ensure project exists AND belongs to current user.

    This is called at the start of every endpoint that handles a project.
    Returns the project if valid, raises 404 if not found or not owned.

    Why separate function?
    - Called by multiple routes (get messages, send message, stream, etc.)
    - Single place to check ownership
    """
    project = await get_project_for_user(db, project_id, current_user.id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.get("/threads", response_model=list[AgentThreadResponse])
async def list_agent_threads(
    project_id: str,
    db: DbSession,
    current_user: CurrentUser,
    agent_type: AgentType | None = None,
) -> list[AgentThreadResponse]:
    """List all conversation threads for a project, optionally filtered by agent type."""
    await _get_owned_project(db, current_user, project_id)
    threads = await agent_service.list_threads(db, project_id, agent_type)
    return [AgentThreadResponse.model_validate(t) for t in threads]


@router.post("/threads", response_model=AgentThreadResponse, status_code=201)
async def create_agent_thread(
    project_id: str,
    body: AgentThreadCreate,
    db: DbSession,
    current_user: CurrentUser,
) -> AgentThreadResponse:
    """Create a new conversation thread for a specific agent."""
    await _get_owned_project(db, current_user, project_id)
    thread = await agent_service.create_thread(
        db, project_id, body.agent_type, body.title
    )
    return AgentThreadResponse.model_validate(thread)


@router.patch("/threads/{thread_id}", response_model=AgentThreadResponse)
async def rename_agent_thread(
    project_id: str,
    thread_id: str,
    body: AgentThreadUpdate,
    db: DbSession,
    current_user: CurrentUser,
) -> AgentThreadResponse:
    """Rename an existing conversation thread."""
    await _get_owned_project(db, current_user, project_id)
    thread = await agent_service.rename_thread(db, project_id, thread_id, body.title)
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    return AgentThreadResponse.model_validate(thread)


@router.delete("/threads/{thread_id}", status_code=204)
async def delete_agent_thread(
    project_id: str,
    thread_id: str,
    db: DbSession,
    current_user: CurrentUser,
):
    """Delete a conversation thread."""
    await _get_owned_project(db, current_user, project_id)
    success = await agent_service.delete_thread(db, project_id, thread_id)
    if not success:
        raise HTTPException(status_code=404, detail="Thread not found")
    return None


@router.post(
    "/threads/{thread_id}/messages",
    response_model=AgentMessageCreateResponse,
    status_code=201,
)
@limiter.limit("10/minute")  # Rate limit: 10 messages per minute per IP
async def create_agent_message(
    request: Request,
    project_id: str,
    thread_id: str,
    body: AgentMessageCreate,
    db: DbSession,
    current_user: CurrentUser,
) -> AgentMessageCreateResponse:
    """
    Send a message to an agent inside a specific thread and start a new run.
    """
    # Security: check user owns this project
    project = await _get_owned_project(db, current_user, project_id)

    # Fetch thread to check ownership and get agent type for limit checks
    result = await db.execute(
        select(AgentThread).where(
            AgentThread.id == thread_id,
            AgentThread.project_id == project.id,
        )
    )
    thread = result.scalar_one_or_none()
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    agent_type = thread.agent_type

    # ── Plan-limit enforcement ───────────────────────────────────────────────
    user_plan = current_user.user_type.value  # 'free' | 'premium' | 'admin'
    limit = _PLAN_LIMITS.get(user_plan, _settings.plan_limit_free)

    if limit != -1:
        # Count user messages sent in THIS project for this agent type
        stmt = (
            select(func.count())
            .select_from(AgentMessage)
            .join(AgentThread, AgentMessage.thread_id == AgentThread.id)
            .where(
                AgentThread.project_id == project.id,
                AgentThread.agent_type == agent_type,
                AgentMessage.role == "user",
            )
        )
        result = await db.execute(stmt)
        used = result.scalar_one()

        if used >= limit:
            plan_display = user_plan.capitalize()
            raise HTTPException(
                status_code=403,
                detail=(
                    f"You have reached your {plan_display} plan limit of "
                    f"{limit} prompt(s) per agent. "
                    "Upgrade to Premium for more messages."
                ),
            )
    # ── End plan-limit enforcement ───────────────────────────────────────────

    # Delegate to service - creates run + message in DB
    try:
        run, user_message = await agent_service.create_message_run(
            db=db,
            project=project,
            thread_id=thread_id,
            content=body.content,
            attachment_ids=body.attachment_ids,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    # Return created objects as response (Pydantic handles serialization)
    return AgentMessageCreateResponse(
        run=AgentRunResponse.model_validate(run),
        user_message=AgentMessageResponse.model_validate(user_message),
    )


async def _load_message_attachments(
    db: AsyncSession, message: AgentMessage
) -> list[Document]:
    """Load attached documents for a message."""
    if not message.attachment_ids:
        return []
    result = await db.execute(
        select(Document).where(Document.id.in_(message.attachment_ids))
    )
    return list(result.scalars().all())


@router.get("/threads/{thread_id}/messages", response_model=AgentHistoryResponse)
async def list_agent_messages(
    project_id: str,
    thread_id: str,
    db: DbSession,
    current_user: CurrentUser,
) -> AgentHistoryResponse:
    """
    Get chat history for a thread in a project.
    """
    # Security check
    await _get_owned_project(db, current_user, project_id)

    # Get messages and clarifications
    try:
        thread_id, messages = await agent_service.list_messages(
            db, project_id, thread_id
        )
        clarifications = await agent_service.list_clarifications(
            db, project_id, thread_id=thread_id
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    # Load attachments for each message
    message_responses = []
    for message in messages:
        attachments = await _load_message_attachments(db, message)
        message_responses.append(
            AgentMessageResponse(
                id=message.id,
                run_id=message.run_id,
                role=cast(AgentMessageRole, message.role),
                content=message.content,
                citations=message.citations,
                attachments=[
                    DocumentResponse.model_validate(doc) for doc in attachments
                ],
                created_at=message.created_at,
            )
        )

    # Get agent type from thread
    result = await db.execute(
        select(AgentThread.agent_type).where(AgentThread.id == thread_id)
    )
    agent_type = result.scalar_one()

    return AgentHistoryResponse(
        thread_id=thread_id,
        agent_type=agent_type,
        messages=message_responses,
        clarifications=[
            ClarificationRequestResponse.model_validate(clarification)
            for clarification in clarifications
        ],
    )


@router.get("/threads/{thread_id}/stream")
@limiter.limit("30/minute")  # Rate limit: 30 streams per minute per IP
async def stream_agent_run(
    request: Request,
    project_id: str,
    thread_id: str,
    run_id: Annotated[str, Query(min_length=1)],  # Required query param
    db: DbSession,
    current_user: CurrentUser,
) -> StreamingResponse:
    """
    Stream the execution of an agent run in real-time.
    """
    project = await _get_owned_project(db, current_user, project_id)

    # Load thread to check ownership and get agent type
    result = await db.execute(
        select(AgentThread).where(
            AgentThread.id == thread_id,
            AgentThread.project_id == project.id,
        )
    )
    thread = result.scalar_one_or_none()
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    agent_type = thread.agent_type

    async def event_stream() -> AsyncIterator[str]:
        try:
            # Iterate over events from agent_service.stream_run()
            async for item in agent_service.stream_run(db, project, agent_type, run_id):
                yield _encode_sse(item["event"], item["data"])
        except ValueError:
            # Run not found
            yield _encode_sse(
                "run.failed", {"run_id": run_id, "error": "Run not found"}
            )
        except RuntimeError as exc:
            # Run already running (concurrent call)
            yield _encode_sse("run.failed", {"run_id": run_id, "error": str(exc)})

    # Return streaming response with SSE content type
    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",  # Don't cache SSE
            "Connection": "keep-alive",  # Keep connection open
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )


@router.get("/agents/summary", response_model=AgentSummaryResponse)
async def get_agent_summary(
    project_id: str,
    db: DbSession,
    current_user: CurrentUser,
) -> AgentSummaryResponse:
    """
    Get summary of all agents for a project.

    Used by the dashboard to show:
    - Which agents have been used
    - Last activity (latest run status)
    - Open clarifications count

    This is what shows in the agent selector UI.
    """
    await _get_owned_project(db, current_user, project_id)
    return await agent_service.build_summary(db, project_id)


@router.get("/clarifications", response_model=list[ClarificationRequestResponse])
async def list_project_clarifications(
    project_id: str,
    db: DbSession,
    current_user: CurrentUser,
    status: Annotated[str, Query(pattern="^(open|resolved|all)$")] = "open",
) -> list[ClarificationRequestResponse]:
    """
    List all clarification requests for a project.

    Clarifications are questions the agent asked the user that need answering.

    Query param:
    - status: Filter by 'open' (default), 'resolved', or 'all'

    Used by UI to show pending questions to answer.
    """
    await _get_owned_project(db, current_user, project_id)
    clarifications = await agent_service.list_clarifications(
        db, project_id, status_filter=status
    )
    return [
        ClarificationRequestResponse.model_validate(clarification)
        for clarification in clarifications
    ]


@router.post(
    "/clarifications/{clarification_id}/resolve",
    response_model=ClarificationResolutionResponse,
)
async def resolve_project_clarification(
    project_id: str,
    clarification_id: str,
    body: ClarificationResolutionRequest,
    db: DbSession,
    current_user: CurrentUser,
) -> ClarificationResolutionResponse:
    """
    Mark a clarification as resolved (user answered the question).

    When user provides the info the agent asked for,
    we mark the clarification as resolved so the agent can proceed.

    URL: POST /projects/{project_id}/clarifications/{clarification_id}/resolve
    Body: {"resolution_note": "My burn rate is $5k/month"}
    """
    await _get_owned_project(db, current_user, project_id)
    resolution = await agent_service.resolve_clarification(
        db,
        project_id,
        clarification_id,
        body.resolution_note,
        body.attachment_ids,
    )
    if not resolution:
        raise HTTPException(status_code=404, detail="Clarification not found")

    clarification, run, user_message = resolution
    return ClarificationResolutionResponse(
        clarification=ClarificationRequestResponse.model_validate(clarification),
        run=AgentRunResponse.model_validate(run),
        user_message=AgentMessageResponse.model_validate(user_message),
    )
