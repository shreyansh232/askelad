from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


AgentType = Literal['cofounder', 'finance', 'marketing', 'product']
AgentRunStatus = Literal['pending', 'running', 'completed', 'needs_clarification', 'failed']
ClarificationStatus = Literal['open', 'resolved']
AgentMessageRole = Literal['user', 'assistant']


class AgentMessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=8000)


class AgentMessageResponse(BaseModel):
    id: str
    run_id: str | None
    role: AgentMessageRole
    content: str
    citations: list[str] = Field(default_factory=list)
    created_at: datetime

    model_config = {'from_attributes': True}


class ClarificationRequestResponse(BaseModel):
    id: str
    run_id: str
    agent_type: AgentType
    question: str
    requested_docs: list[str] = Field(default_factory=list)
    status: ClarificationStatus
    resolution_note: str | None
    created_at: datetime
    resolved_at: datetime | None

    model_config = {'from_attributes': True}


class ClarificationResolutionRequest(BaseModel):
    resolution_note: str | None = Field(default=None, max_length=2000)


class AgentRunResponse(BaseModel):
    id: str
    thread_id: str
    agent_type: AgentType
    status: AgentRunStatus
    model_name: str | None
    error_message: str | None
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None

    model_config = {'from_attributes': True}


class AgentMessageCreateResponse(BaseModel):
    run: AgentRunResponse
    user_message: AgentMessageResponse


class AgentHistoryResponse(BaseModel):
    thread_id: str
    agent_type: AgentType
    messages: list[AgentMessageResponse]
    clarifications: list[ClarificationRequestResponse]


class AgentSummaryItemResponse(BaseModel):
    agent_type: AgentType
    latest_run: AgentRunResponse | None
    unresolved_clarifications: int


class AgentSummaryResponse(BaseModel):
    project_id: str
    agents: list[AgentSummaryItemResponse]


class LLMStructuredResponse(BaseModel):
    content: str
    needs_clarification: bool = False
    clarification_question: str | None = None
    requested_docs: list[str] = Field(default_factory=list)
    citations: list[str] = Field(default_factory=list)
