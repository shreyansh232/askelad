import logging
from typing import Any

from tavily import TavilyClient

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def web_search(query: str, search_depth: str = "basic") -> dict[str, Any]:
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


# Tool definition for LLM
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

# Mapping of function names to actual functions
TOOL_MAP = {"web_search": web_search}
