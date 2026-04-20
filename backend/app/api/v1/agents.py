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
from typing import Annotated, AsyncIterator

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.db.models import User
from app.schemas.agents import (
    AgentHistoryResponse,
    AgentMessageCreate,
    AgentMessageCreateResponse,
    AgentMessageResponse,
    AgentRunResponse,
    AgentSummaryResponse,
    AgentType,
    ClarificationRequestResponse,
    ClarificationResolutionRequest,
)
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


def _encode_sse(event: str, data: dict) -> str:
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


@router.post(
    "/agents/{agent_type}/messages",
    response_model=AgentMessageCreateResponse,
    status_code=201,
)
async def create_agent_message(
    project_id: str,
    agent_type: AgentType,
    body: AgentMessageCreate,
    db: DbSession,
    current_user: CurrentUser,
) -> AgentMessageCreateResponse:
    """
    Send a message to an agent and start a new run.

    What happens:
    1. Validate project ownership
    2. Create run + user message in database
    3. Return immediately with run ID (LLM runs asynchronously via streaming)

    The actual LLM processing happens when client calls /stream endpoint.

    URL: POST /projects/{project_id}/agents/{agent_type}/messages
    Body: {"content": "What should I price my product?"}
    Returns: {run_id, user_message_id} - client uses run_id to stream response
    """
    # Security: check user owns this project
    project = await _get_owned_project(db, current_user, project_id)

    # Delegate to service - creates run + message in DB
    run, user_message = await agent_service.create_message_run(
        db=db,
        project=project,
        agent_type=agent_type,
        content=body.content,
    )

    # Return created objects as response (Pydantic handles serialization)
    return AgentMessageCreateResponse(
        run=AgentRunResponse.model_validate(run),
        user_message=AgentMessageResponse.model_validate(user_message),
    )


@router.get("/agents/{agent_type}/messages", response_model=AgentHistoryResponse)
async def list_agent_messages(
    project_id: str,
    agent_type: AgentType,
    db: DbSession,
    current_user: CurrentUser,
) -> AgentHistoryResponse:
    """
    Get chat history for an agent in a project.

    Returns:
    - thread_id: The conversation ID
    - messages: All messages (user + assistant) in chronological order
    - clarifications: Any questions the agent asked that need answers

    Used when user opens an existing conversation to load past messages.
    """
    # Security check
    await _get_owned_project(db, current_user, project_id)

    # Get messages and clarifications
    thread_id, messages = await agent_service.list_messages(db, project_id, agent_type)
    clarifications = await agent_service.list_clarifications(db, project_id, agent_type)

    return AgentHistoryResponse(
        thread_id=thread_id or "",
        agent_type=agent_type,
        messages=[AgentMessageResponse.model_validate(message) for message in messages],
        clarifications=[
            ClarificationRequestResponse.model_validate(clarification)
            for clarification in clarifications
        ],
    )


@router.get("/agents/{agent_type}/stream")
async def stream_agent_run(
    project_id: str,
    agent_type: AgentType,
    run_id: Annotated[str, Query(min_length=1)],  # Required query param
    db: DbSession,
    current_user: CurrentUser,
) -> StreamingResponse:
    """
    Stream the execution of an agent run in real-time.

    This endpoint:
    1. Checks if run exists and user owns the project
    2. If already completed → replays saved response (no LLM call)
    3. If pending → executes LLM call and streams events

    Uses Server-Sent Events (SSE) for real-time streaming.
    Client connects, server pushes events as they happen.

    URL: GET /projects/{project_id}/agents/{agent_type}/stream?run_id=xxx
    Events: run.started, message.delta, run.completed, etc.
    """
    project = await _get_owned_project(db, current_user, project_id)

    async def event_stream() -> AsyncIterator[str]:
        """
        Generator that yields SSE events as they come from the service.

        Wraps each event with _encode_sse() to format as:
        event: <name>
        data: <json>

        Errors are caught and yielded as run.failed events.
        """
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
    response_model=ClarificationRequestResponse,
)
async def resolve_project_clarification(
    project_id: str,
    clarification_id: str,
    body: ClarificationResolutionRequest,
    db: DbSession,
    current_user: CurrentUser,
) -> ClarificationRequestResponse:
    """
    Mark a clarification as resolved (user answered the question).

    When user provides the info the agent asked for,
    we mark the clarification as resolved so the agent can proceed.

    URL: POST /projects/{project_id}/clarifications/{clarification_id}/resolve
    Body: {"resolution_note": "My burn rate is $5k/month"}
    """
    await _get_owned_project(db, current_user, project_id)
    clarification = await agent_service.resolve_clarification(
        db,
        project_id,
        clarification_id,
        body.resolution_note,
    )
    if not clarification:
        raise HTTPException(status_code=404, detail="Clarification not found")
    return ClarificationRequestResponse.model_validate(clarification)
