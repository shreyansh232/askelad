# AGENTS.md - Development Guide for Agentic Coding Agents

This document provides essential information for agentic coding agents (Cursor, Claude, Copilot, Windsurf, etc.) working on the **Askelad** platform.

Askelad is an open-source platform that enables solo startup founders to delegate business tasks and receive departmental advice from specialized non-coding AI agents (Finance, Marketing, Product, etc.), all scoped to a single “project” (startup/idea). A central “Cofounder” agent provides high-level oversight, monitors task status, detects blockers, and proactively notifies the user when clarification or additional documents are needed.

**Current name (February 2026):** Askelad
**Primary domain target:** Askelad.ai or Askelad.io  
**License:** MIT  
**Target audience:** Solo founders, indie hackers, early-stage startup builders (especially in India)

## Codebase Structure (Monorepo)

```
Askelad/
├── backend/                    # FastAPI + LangGraph + business logic
│   ├── agents/                 # Individual agent graphs & prompts
│   │   ├── finance.py
│   │   ├── marketing.py
│   │   ├── product.py
│   │   ├── cofounder.py
│   │   └── __init__.py         # agent registry
│   ├── api/                    # FastAPI routes
│   │   └── v1/                 # versioned endpoints
│   ├── core/                   # config, deps, llm proxy, logging
│   ├── models/                 # SQLAlchemy 2.0 ORM models
│   ├── schemas/                # Pydantic request/response models
│   ├── services/               # RAG, task orchestration, clarification logic
│   └── main.py                 # FastAPI app factory
├── frontend/                   # Next.js 14+ App Router (TypeScript)
│   ├── app/                    # pages & layouts
│   │   ├── dashboard/          # project list + chat tabs
│   │   ├── onboarding/         # new project form
│   │   └── settings/           # API key input
│   ├── components/             # reusable UI (ChatWindow, AgentSelector, etc.)
│   ├── lib/                    # api client, types, utils
│   └── types/                  # global TypeScript interfaces
├── docs/                       # architecture docs, prompt examples
├── .github/workflows/          # CI pipelines
├── docker-compose.yml
├── .env.example
└── AGENTS.md                   # ← this file
```

## Package Managers & Core Commands

### Backend (Python)

Always use **uv** — never pip.

```bash
# Sync dependencies
uv sync

# Add production dependency
uv add fastapi

# Add dev dependency
uv add --dev ruff pytest httpx

# Run backend (development)
uv run --with-editable . uvicorn backend.main:app --reload --port 8000

# Run migrations
cd backend
uv run alembic upgrade head

# Lint & auto-fix
uv run ruff check . --fix
uv run ruff format .
```

### Frontend (Next.js + TypeScript)

Always use **pnpm** — never npm or yarn.

```bash
# Install dependencies
cd frontend && pnpm install

# Add dependency
pnpm add @tanstack/react-query

# Add dev dependency
pnpm add -D typescript @types/node

# Run dev server
pnpm dev

# Lint & format
pnpm lint
pnpm lint --fix

# Type check
pnpm tsc --noEmit
```

## Code Style Guidelines

### Python (Backend)

- Formatting: ruff (Black style + isort + flake8 rules)
- Line length: 88
- Quotes: single quotes
- Import order: stdlib → third-party → local (blank lines between groups)
- Naming: snake_case (vars/functions/modules), PascalCase (classes), UPPER_CASE (constants)
- Type hints: mandatory on public interfaces
- Async: use async/await for I/O (database, external APIs)

```python
from typing import Optional

from fastapi import Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.deps import get_db
from ..models.project import Project

async def get_project_or_404(db: AsyncSession, project_id: int) -> Project:
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project
```

### TypeScript (Frontend)

- Strict mode enabled
- Functional components + interfaces (no `React.FC`)
- Prefer `const` / immutable patterns
- Use Tailwind + shadcn/ui components
- Descriptive tuple query keys including projectId + agentType

```tsx
interface ChatMessageProps {
  role: 'user' | 'assistant' | 'system'
  content: string
  isLoading?: boolean
}

export function ChatMessage({ role, content, isLoading = false }: ChatMessageProps) {
  // implementation
}
```

## Architectural Principles

1. Single Responsibility  
   One file = one concern (e.g. `finance.py` only contains finance agent graph & tools)

2. Open/Closed  
   New agents added without modifying core orchestration (extend via new file + registry)

3. Interface Segregation  
   Small, focused Pydantic schemas and tool interfaces

4. Dependency Inversion  
   Depend on abstractions (LiteLLM proxy, tool registry) not concrete providers

5. Clarification-first behavior  
   **Every agent prompt must include:**

   > If you lack critical information, politely ask the user for clarification or request missing documents before proceeding. Do not guess or hallucinate important values, dates, numbers, or assumptions. Example responses:  
   > - “To provide accurate projections, could you clarify your current monthly revenue?”  
   > - “Please upload your latest expense breakdown or share more details about your burn rate.”

## Common Development Workflows

**Adding a new agent**

1. Create `backend/agents/new_agent.py`
2. Define LangGraph node, prompt (include clarification rule), and tools
3. Register in `backend/agents/__init__.py`
4. Add selector option in `frontend/components/AgentSelector.tsx`
5. Test clarification path

**Adding a new tool**

1. Define in `backend/agents/tools.py`
2. Bind selectively to agents that need it
3. Update cofounder prompt to know when to delegate tool usage

**Implementing clarification / document request flow**

- Agent returns structured output when context is insufficient  
  `{ "needs_clarification": true, "question": "...", "requested_docs": ["expense_sheet.pdf"] }`
- Frontend renders special bubble + file upload prompt
- Cofounder agent monitors these flags and notifies proactively

## Testing Expectations

- Backend: pytest + anyio (async tests)
- Mock LLM calls with `unittest.mock` or response fixtures
- Explicitly test clarification & document-request paths
- Frontend: Vitest + React Testing Library (prefer integration tests)

## Environment & Debugging Tips

- Always include current year in search queries:  
  `f"Indian SaaS funding trends {datetime.now().year}"`

- Common failure points:
  - LiteLLM routing → verify user API key format in settings
  - Pinecone connection → confirm index name & dimension match
  - WebSocket disconnect → check Redis pub/sub channel naming (project_id)
  - Google Auth → ensure redirect URIs match exactly

- When context is missing: politely ask the human for the latest `.env.example`, recent migration, or example project payload.

Help make Askelad the most useful virtual team tool for solo founders.
```