from dataclasses import dataclass, field
from typing import Any

from app.agents.prompts import (
    COFOUNDER_SYSTEM_PROMPT,
    FINANCE_SYSTEM_PROMPT,
    MARKETING_SYSTEM_PROMPT,
    PRODUCT_SYSTEM_PROMPT,
)
from app.agents.tools import (
    WEB_SEARCH_TOOL,
    LIST_SKILLS_TOOL,
    ACCESS_SKILL_FILE_TOOL,
    LIST_MCP_SERVERS_TOOL,
    CALL_MCP_TOOL_TOOL,
)
from app.schemas.agents import AgentType


@dataclass(frozen=True)  # By doing frozen true, the fields become immutable
class AgentDefinition:
    agent_type: AgentType
    label: str
    system_prompt: str
    tools: list[dict[str, Any]] = field(
        default_factory=list
    )  # Every time a new instance is created and no value is provided for tools, call list() to create a fresh, new empty list.


AGENT_TOOLS = [
    WEB_SEARCH_TOOL,
    LIST_SKILLS_TOOL,
    ACCESS_SKILL_FILE_TOOL,
    LIST_MCP_SERVERS_TOOL,
    CALL_MCP_TOOL_TOOL,
]

AGENT_DEFINITIONS: dict[AgentType, AgentDefinition] = {
    "cofounder": AgentDefinition(
        agent_type="cofounder",
        label="Co-Founder",
        system_prompt=COFOUNDER_SYSTEM_PROMPT,
        tools=AGENT_TOOLS,
    ),
    "finance": AgentDefinition(
        agent_type="finance",
        label="Finance",
        system_prompt=FINANCE_SYSTEM_PROMPT,
        tools=AGENT_TOOLS,
    ),
    "marketing": AgentDefinition(
        agent_type="marketing",
        label="Marketing",
        system_prompt=MARKETING_SYSTEM_PROMPT,
        tools=AGENT_TOOLS,
    ),
    "product": AgentDefinition(
        agent_type="product",
        label="Product",
        system_prompt=PRODUCT_SYSTEM_PROMPT,
        tools=AGENT_TOOLS,
    ),
}


def get_agent_definition(agent_type: AgentType) -> AgentDefinition:
    return AGENT_DEFINITIONS[agent_type]
