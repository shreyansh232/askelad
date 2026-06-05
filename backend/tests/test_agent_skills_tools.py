from app.agents.tools import (
    list_skills,
    access_skill_file,
    list_mcp_servers,
    call_mcp_tool,
)


def test_list_skills():
    result = list_skills()
    assert "skills" in result
    assert "cofounder" in result["skills"]
    assert "finance" in result["skills"]
    assert "marketing" in result["skills"]
    assert "product" in result["skills"]

    # Check that it found first-principles-thinking in cofounder
    cofounder_skills = [s["name"] for s in result["skills"]["cofounder"]]
    assert "first-principles-thinking" in cofounder_skills


def test_access_skill_file():
    # Test valid skill
    result = access_skill_file("first-principles-thinking")
    assert "content" in result
    assert "First Principles Thinking" in result["content"]

    # Test invalid skill
    result_invalid = access_skill_file("non-existent-skill-name-12345")
    assert "error" in result_invalid


def test_list_mcp_servers():
    result = list_mcp_servers()
    assert "mcp_servers" in result
    assert "github" in result["mcp_servers"]
    assert "postgres" in result["mcp_servers"]
    assert "posthog" in result["mcp_servers"]


def test_call_mcp_tool():
    # Test valid tool execution on github
    result_github = call_mcp_tool("github", "list_issues", {"repo_name": "owner/repo"})
    assert "issues" in result_github
    assert len(result_github["issues"]) > 0

    # Test valid tool execution on posthog
    result_posthog = call_mcp_tool("posthog", "get_activation_rate", {"cohort_days": 7})
    assert "rate" in result_posthog
    assert "42.5%" in result_posthog["rate"]

    # Test invalid server
    result_invalid_server = call_mcp_tool("non_existent_server", "tool", {})
    assert "error" in result_invalid_server

    # Test invalid tool
    result_invalid_tool = call_mcp_tool("github", "non_existent_tool", {})
    assert "error" in result_invalid_tool
