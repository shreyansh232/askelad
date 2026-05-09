from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.agents import AgentType


TaskStatus = Literal[
    "todo",
    "in_progress",
    "blocked",
    "waiting_for_user",
    "done",
    "archived",
]
TaskPriority = Literal["low", "medium", "high", "urgent"]
ActorType = Literal["founder", "agent", "cofounder", "system"]
ArtifactFormat = Literal["markdown", "csv", "pdf", "text"]
ArtifactType = Literal[
    "competitor_analysis",
    "pricing_model",
    "investor_update",
    "landing_page_copy",
    "roadmap",
    "general",
]
DigestCadence = Literal["daily", "weekly"]
MonitorType = Literal["market", "competitor", "follow_up", "risk"]
MonitorStatus = Literal["active", "paused"]


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=8000)
    status: TaskStatus = "todo"
    priority: TaskPriority = "medium"
    owner_agent_type: AgentType | None = None
    due_at: datetime | None = None
    blocked_reason: str | None = Field(default=None, max_length=2000)


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=8000)
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    owner_agent_type: AgentType | None = None
    due_at: datetime | None = None
    blocked_reason: str | None = Field(default=None, max_length=2000)


class TaskResponse(BaseModel):
    id: str
    project_id: str
    source_run_id: str | None
    title: str
    description: str | None
    status: TaskStatus
    priority: TaskPriority
    owner_agent_type: AgentType | None
    due_at: datetime | None
    blocked_reason: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TaskEventCreate(BaseModel):
    event_type: str = Field(min_length=1, max_length=80)
    summary: str = Field(min_length=1, max_length=4000)
    actor_type: ActorType = "founder"
    actor_label: str | None = Field(default=None, max_length=120)
    metadata_json: dict = Field(default_factory=dict)


class TaskEventResponse(BaseModel):
    id: str
    task_id: str
    project_id: str
    actor_type: ActorType
    actor_label: str | None
    event_type: str
    summary: str
    metadata_json: dict
    created_at: datetime

    model_config = {"from_attributes": True}


class AgentRunStepResponse(BaseModel):
    id: str
    run_id: str
    project_id: str
    agent_type: AgentType
    sequence: int
    event_type: str
    title: str
    detail: str | None
    payload: dict
    created_at: datetime

    model_config = {"from_attributes": True}


class ArtifactCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    artifact_type: ArtifactType = "general"
    format: ArtifactFormat = "markdown"
    content: str = Field(min_length=1, max_length=100000)
    task_id: str | None = None
    metadata_json: dict = Field(default_factory=dict)


class ArtifactVersionCreate(BaseModel):
    content: str = Field(min_length=1, max_length=100000)
    created_by: str = Field(default="founder", max_length=120)
    metadata_json: dict = Field(default_factory=dict)


class ArtifactVersionResponse(BaseModel):
    id: str
    artifact_id: str
    version: int
    content: str
    metadata_json: dict
    created_by: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ArtifactResponse(BaseModel):
    id: str
    project_id: str
    task_id: str | None
    run_id: str | None
    title: str
    artifact_type: str
    format: ArtifactFormat
    current_version_id: str | None
    created_at: datetime
    updated_at: datetime
    current_version: ArtifactVersionResponse | None = None

    model_config = {"from_attributes": True}


class WorkQueueResponse(BaseModel):
    today: list[TaskResponse]
    blocked: list[TaskResponse]
    waiting_for_you: list[TaskResponse]
    upcoming: list[TaskResponse]
    recent_artifacts: list[ArtifactResponse]
    recent_steps: list[AgentRunStepResponse]
    unresolved_clarifications: int
    stale_task_count: int


class CofounderDigestCreate(BaseModel):
    cadence: DigestCadence = "daily"


class CofounderDigestResponse(BaseModel):
    id: str
    project_id: str
    cadence: DigestCadence
    title: str
    summary: str
    payload: dict
    created_at: datetime

    model_config = {"from_attributes": True}


class CofounderMonitorCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    monitor_type: MonitorType
    query: str = Field(min_length=1, max_length=4000)
    cadence: DigestCadence = "weekly"


class CofounderMonitorUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    monitor_type: MonitorType | None = None
    query: str | None = Field(default=None, min_length=1, max_length=4000)
    cadence: DigestCadence | None = None
    status: MonitorStatus | None = None
    last_checked_at: datetime | None = None


class CofounderMonitorResponse(BaseModel):
    id: str
    project_id: str
    title: str
    monitor_type: MonitorType
    query: str
    cadence: DigestCadence
    status: MonitorStatus
    last_checked_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
