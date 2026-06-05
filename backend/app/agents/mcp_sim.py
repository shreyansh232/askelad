import logging
from typing import Any

logger = logging.getLogger(__name__)

# Simulated MCP Registry definition
MCP_SERVERS = {
    "github": {
        "description": "Access repositories, branches, issues, and PR metadata.",
        "tools": {
            "search_repositories": {
                "description": "Search public or private repositories.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "Repository search query.",
                        }
                    },
                    "required": ["query"],
                },
            },
            "list_issues": {
                "description": "Retrieve list of issues or pull requests for a repository.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "repo_name": {
                            "type": "string",
                            "description": "Format: owner/repo",
                        },
                        "state": {"type": "string", "enum": ["open", "closed", "all"]},
                    },
                    "required": ["repo_name"],
                },
            },
        },
    },
    "postgres": {
        "description": "Inspect database schemas, table definitions, and index sizes.",
        "tools": {
            "describe_table": {
                "description": "Get columns, types, and constraints for a database table.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "table_name": {
                            "type": "string",
                            "description": "The table to inspect.",
                        }
                    },
                    "required": ["table_name"],
                },
            },
            "show_indexes": {
                "description": "Show all active indexes and their sizes on a table.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "table_name": {
                            "type": "string",
                            "description": "The table to inspect.",
                        }
                    },
                    "required": ["table_name"],
                },
            },
        },
    },
    "posthog": {
        "description": "Query product analytics funnels and retention rates.",
        "tools": {
            "get_activation_rate": {
                "description": "Calculate weekly/monthly activation rates for user cohorts.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "cohort_days": {
                            "type": "integer",
                            "description": "Cohort window (e.g. 7 or 30 days).",
                        }
                    },
                },
            },
            "get_funnel_dropoff": {
                "description": "Locate user dropoffs in multi-step conversion funnels.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "steps": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "List of event names in the funnel.",
                        }
                    },
                    "required": ["steps"],
                },
            },
        },
    },
}


def list_mcp_servers_impl() -> dict[str, Any]:
    """List all available MCP servers and their capabilities."""
    return {
        "mcp_servers": {
            name: {
                "description": info["description"],
                "available_tools": list(info["tools"].keys()),
            }
            for name, info in MCP_SERVERS.items()
        }
    }


def call_mcp_tool_impl(
    server_name: str, tool_name: str, arguments: dict[str, Any]
) -> dict[str, Any]:
    """Execute a simulated tool call on a registered MCP server."""
    server = MCP_SERVERS.get(server_name)
    if not server:
        return {"error": f"MCP server '{server_name}' not found."}

    if tool_name not in server["tools"]:
        return {"error": f"Tool '{tool_name}' not found on MCP server '{server_name}'."}

    # Simulate tool results
    if server_name == "github":
        if tool_name == "search_repositories":
            query = arguments.get("query", "")
            return {
                "repositories": [
                    {
                        "name": f"user/{query}-app",
                        "stars": 12,
                        "language": "TypeScript",
                        "url": f"https://github.com/user/{query}-app",
                    },
                    {
                        "name": f"organization/shared-{query}",
                        "stars": 88,
                        "language": "Python",
                        "url": f"https://github.com/organization/shared-{query}",
                    },
                ]
            }
        elif tool_name == "list_issues":
            repo = arguments.get("repo_name", "user/repo")
            return {
                "repository": repo,
                "issues": [
                    {
                        "number": 101,
                        "title": "Database connection timeout in production",
                        "state": "open",
                        "assignee": "founder",
                    },
                    {
                        "number": 98,
                        "title": "Fix alignment of landing page hero text",
                        "state": "open",
                        "assignee": None,
                    },
                    {
                        "number": 75,
                        "title": "Upgrade Next.js version to 16",
                        "state": "closed",
                        "assignee": "developer",
                    },
                ],
            }

    elif server_name == "postgres":
        if tool_name == "describe_table":
            table_name = arguments.get("table_name", "users")
            if table_name == "users":
                return {
                    "table": "users",
                    "columns": [
                        {
                            "name": "id",
                            "type": "UUID",
                            "nullable": False,
                            "default": "gen_random_uuid()",
                        },
                        {
                            "name": "email",
                            "type": "VARCHAR(255)",
                            "nullable": False,
                            "default": None,
                        },
                        {
                            "name": "created_at",
                            "type": "TIMESTAMP WITH TIME ZONE",
                            "nullable": False,
                            "default": "now()",
                        },
                        {
                            "name": "tier",
                            "type": "VARCHAR(50)",
                            "nullable": True,
                            "default": "'free'",
                        },
                    ],
                    "constraints": [
                        {
                            "name": "users_pkey",
                            "type": "PRIMARY KEY",
                            "columns": ["id"],
                        },
                        {
                            "name": "users_email_key",
                            "type": "UNIQUE",
                            "columns": ["email"],
                        },
                    ],
                }
            else:
                return {
                    "table": table_name,
                    "columns": [
                        {"name": "id", "type": "INTEGER", "nullable": False},
                        {"name": "created_at", "type": "TIMESTAMP", "nullable": False},
                    ],
                }
        elif tool_name == "show_indexes":
            table_name = arguments.get("table_name", "users")
            return {
                "table": table_name,
                "indexes": [
                    {
                        "name": f"{table_name}_pkey",
                        "columns": ["id"],
                        "unique": True,
                        "size": "48 KB",
                    },
                    {
                        "name": f"{table_name}_email_idx",
                        "columns": ["email"],
                        "unique": True,
                        "size": "32 KB",
                    },
                ],
            }

    elif server_name == "posthog":
        if tool_name == "get_activation_rate":
            cohort_days = arguments.get("cohort_days", 7)
            return {
                "cohort_window_days": cohort_days,
                "metric": "Activation Rate",
                "rate": "42.5%",
                "total_users": 150,
                "activated_users": 64,
                "activation_milestone": "Send first invoice",
            }
        elif tool_name == "get_funnel_dropoff":
            steps = arguments.get("steps", ["pageview", "signup", "complete_profile"])
            return {
                "funnel_steps": steps,
                "metrics": [
                    {
                        "step": 1,
                        "name": steps[0],
                        "count": 1000,
                        "conversion_rate": "100.0%",
                    },
                    {
                        "step": 2,
                        "name": steps[1],
                        "count": 250,
                        "conversion_rate": "25.0%",
                    },
                    {
                        "step": 3,
                        "name": steps[2],
                        "count": 105,
                        "conversion_rate": "42.0%",
                    },
                ],
                "overall_conversion_rate": "10.5%",
                "biggest_dropoff_step": 2,
            }

    return {"error": "Unknown simulated tool execution path."}
