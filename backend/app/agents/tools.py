import logging
from pathlib import Path
from typing import Any, Literal

from tavily import TavilyClient

from app.config import get_settings
from app.agents.mcp_sim import list_mcp_servers_impl, call_mcp_tool_impl

logger = logging.getLogger(__name__)
settings = get_settings()


def web_search(
    query: str,
    search_depth: Literal["basic", "advanced", "fast", "ultra-fast"] = "basic",
) -> dict[str, Any]:
    """
    Search the web for information using Tavily.

    Args:
        query: The search query.
        search_depth: "basic" or "advanced". "advanced" is slower but more thorough.

    Returns:
        A dictionary containing search results.
    """
    if not settings.tavily_api_key:
        logger.warning("Tavily API key is not configured")
        return {"error": "Search tool not configured"}

    client = TavilyClient(api_key=settings.tavily_api_key.get_secret_value())
    try:
        # Search the web
        response = client.search(query=query, search_depth=search_depth)
        return response
    except Exception as e:
        logger.error(f"Tavily search failed: {e}")
        return {"error": str(e)}


def list_skills() -> dict[str, Any]:
    """
    List all available skills that the agent can access.

    Returns:
        A dictionary containing available skills by agent category.
    """
    skills_dir = Path(__file__).resolve().parent / "skills"
    if not skills_dir.exists():
        return {"skills": {}}

    skills_by_agent = {}
    for agent_dir in skills_dir.iterdir():
        if agent_dir.is_dir():
            skills = []
            for skill_file in agent_dir.glob("*.md"):
                try:
                    content = skill_file.read_text()
                    name = skill_file.stem
                    description = "No description provided."
                    if content.startswith("---"):
                        parts = content.split("---", 2)
                        if len(parts) >= 3:
                            frontmatter = parts[1]
                            for line in frontmatter.splitlines():
                                if ":" in line:
                                    k, v = line.split(":", 1)
                                    if k.strip() == "description":
                                        description = v.strip().strip('"').strip("'")
                except Exception as e:
                    logger.error(
                        f"Failed to parse skill file metadata {skill_file}: {e}"
                    )
                    name = skill_file.stem
                    description = "No description provided."
                skills.append({"name": name, "description": description})
            skills_by_agent[agent_dir.name] = skills

    return {"skills": skills_by_agent}


def access_skill_file(skill_name: str) -> dict[str, Any]:
    """
    Read the contents of a specific skill markdown file.

    Args:
        skill_name: The name of the skill file (excluding extension).

    Returns:
        A dictionary containing the markdown content of the skill file.
    """
    skills_dir = Path(__file__).resolve().parent / "skills"
    if not skills_dir.exists():
        return {"error": "Skills directory not found."}

    # Search recursively for skill_name.md
    for skill_file in skills_dir.glob(f"**/{skill_name}.md"):
        try:
            return {"skill_name": skill_name, "content": skill_file.read_text()}
        except Exception as e:
            return {"error": f"Failed to read skill file: {e}"}

    return {"error": f"Skill file '{skill_name}' not found."}


def list_mcp_servers() -> dict[str, Any]:
    """
    List all available MCP servers and their available tools.

    Returns:
        A dictionary listing available MCP servers and tool descriptions.
    """
    return list_mcp_servers_impl()


def call_mcp_tool(
    server_name: str, tool_name: str, arguments: dict[str, Any]
) -> dict[str, Any]:
    """
    Execute a tool on an MCP server.

    Args:
        server_name: The name of the MCP server.
        tool_name: The name of the tool to run.
        arguments: A dictionary of arguments to pass to the tool.

    Returns:
        The result of the tool execution.
    """
    return call_mcp_tool_impl(server_name, tool_name, arguments)


# Tool definitions for LLM
WEB_SEARCH_TOOL = {
    "type": "function",
    "function": {
        "name": "web_search",
        "description": "Search the web for real-time information, market trends, or company data. Use this when you need data from outside your provided context.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query to look up on the web.",
                },
                "search_depth": {
                    "type": "string",
                    "enum": ["basic", "advanced"],
                    "description": "The depth of the search. Use 'advanced' for deep research.",
                },
            },
            "required": ["query"],
        },
    },
}

LIST_SKILLS_TOOL = {
    "type": "function",
    "function": {
        "name": "list_skills",
        "description": "List all available skills that the agent can access to guide decision making.",
        "parameters": {"type": "object", "properties": {}},
    },
}

ACCESS_SKILL_FILE_TOOL = {
    "type": "function",
    "function": {
        "name": "access_skill_file",
        "description": "Read the instructions and guidelines from a specific skill file.",
        "parameters": {
            "type": "object",
            "properties": {
                "skill_name": {
                    "type": "string",
                    "description": "The name of the skill file (e.g. pricing-strategy).",
                }
            },
            "required": ["skill_name"],
        },
    },
}

LIST_MCP_SERVERS_TOOL = {
    "type": "function",
    "function": {
        "name": "list_mcp_servers",
        "description": "List all available MCP servers and the tools they expose.",
        "parameters": {"type": "object", "properties": {}},
    },
}

CALL_MCP_TOOL_TOOL = {
    "type": "function",
    "function": {
        "name": "call_mcp_tool",
        "description": "Execute a tool on a specific MCP server (e.g. github, postgres, posthog).",
        "parameters": {
            "type": "object",
            "properties": {
                "server_name": {
                    "type": "string",
                    "description": "The name of the MCP server.",
                },
                "tool_name": {
                    "type": "string",
                    "description": "The name of the tool to run.",
                },
                "arguments": {
                    "type": "object",
                    "description": "Arguments required by the tool.",
                },
            },
            "required": ["server_name", "tool_name", "arguments"],
        },
    },
}

# Mapping of function names to actual functions
TOOL_MAP = {
    "web_search": web_search,
    "list_skills": list_skills,
    "access_skill_file": access_skill_file,
    "list_mcp_servers": list_mcp_servers,
    "call_mcp_tool": call_mcp_tool,
}
