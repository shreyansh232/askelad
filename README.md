# Askelad

Open-source AI agent platform for solo startup founders.

Askelad is building a virtual extended team for founders who cannot afford to be the CFO, CMO, CPO, and operator at the same time. The product direction is a chat-first workspace where specialized non-coding AI agents share startup context, ask for clarification before making assumptions, and stay coordinated through a cofounder layer.

![Askelad landing preview](./frontend/public/landing-preview.png)

## What Askelad is trying to solve

Solo founders usually have depth in one area and constant gaps in the rest. The failure mode is predictable: business planning, pricing, messaging, customer research, and prioritization all compete for the same time and mental bandwidth.

Askelad is intended to reduce that load by giving founders:

- a finance agent for practical business and runway questions
- a marketing agent for messaging and go-to-market work
- a product agent for prioritization and product thinking
- a cofounder layer that keeps all of that work aligned

The operating principle is clarification first. If the system is missing critical inputs, it should ask instead of guessing.

## Current status

This repository is in the MVP build phase. The codebase already includes real infrastructure and UI work, but the full agent platform described in the implementation plan is not finished yet.

### Implemented in the repo today

- marketing landing page in Next.js with a polished public homepage
- FAQ, footer, floating nav, and smooth scrolling on the frontend
- FastAPI backend with health check and CORS/session middleware
- Google OAuth flow scaffolding with login, callback, refresh, logout, and current-user endpoints
- JWT-based access token handling
- PostgreSQL models for users and projects
- project CRUD API with ownership checks
- Alembic migrations for users and projects
- Docker Compose setup for the Postgres database service

### Planned for the MVP

- specialist agents for finance, marketing, and product
- cofounder orchestration and cross-agent oversight
- BYO API key management for LLM providers
- project document upload and retrieval
- RAG-backed startup context
- chat streaming
- clarification prompts and document-request flows
- in-app notifications for blockers and missing inputs
- founder dashboard and authenticated workspace UI

## Product direction

The MVP direction is:

- founder creates a project and provides startup context once
- agents reuse that shared context instead of starting from scratch on every prompt
- agents ask for clarifications when numbers, assumptions, or documents are missing
- the cofounder layer tracks agent outputs and points out blockers or next decisions

This is meant to feel less like using separate AI tools and more like managing one small operating team.

## Open product decisions

These decisions are still active and should be treated as explicit product review points:

1. `BYO API keys`
Users provide their own provider keys for Grok, Claude, or OpenAI, stored encrypted in Postgres and routed through LiteLLM. This is currently the intended model, but it may need a platform-key fallback for better onboarding.

2. `Vector store`
Pinecone was proposed for the MVP, but `pgvector` remains a simpler alternative if fewer external services are preferred.

3. `Authentication scope`
Google OAuth is the planned MVP auth method. GitHub auth and email/password are explicitly post-MVP.

4. `Notifications`
The MVP scope is in-app notifications only. Slack, Telegram, and similar integrations are intentionally deferred.

## Actual repository structure

This is the current structure of the repo, not the proposed future layout:

```text
askelad/
├── backend/
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/
│   ├── app/
│   │   ├── api/
│   │   │   ├── deps.py
│   │   │   └── v1/projects.py
│   │   ├── auth/
│   │   │   ├── jwt_handler.py
│   │   │   ├── oauth.py
│   │   │   ├── router.py
│   │   │   └── service.py
│   │   ├── db/
│   │   │   ├── database.py
│   │   │   └── models.py
│   │   ├── schemas/
│   │   │   ├── projects.py
│   │   │   └── users.py
│   │   ├── services/
│   │   │   └── projects.py
│   │   ├── config.py
│   │   └── main.py
│   ├── alembic.ini
│   └── pyproject.toml
├── frontend/
│   ├── app/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── FaqSection.tsx
│   │   ├── Footer.tsx
│   │   ├── HowItWorks.tsx
│   │   ├── Landing.tsx
│   │   ├── Navbar.tsx
│   │   ├── SmoothScroll.tsx
│   │   └── ui/
│   ├── lib/
│   │   └── utils.ts
│   ├── public/
│   ├── package.json
│   └── tsconfig.json
├── docs/
│   └── assets/
│       └── landing-preview.svg
├── docker-compose.yml
└── README.md
```

## Tech stack

### Current implementation

- `FastAPI` for the backend API
- `SQLAlchemy` async ORM
- `Alembic` for migrations
- `PostgreSQL` for persistent data
- `Authlib` for Google OAuth integration
- `PyJWT` for token creation and verification
- `Next.js 16` with the App Router
- `React 19`
- `TypeScript`
- `Tailwind CSS 4`
- `shadcn/ui`-style primitives for parts of the frontend
- `Lenis` for smoother scrolling on the landing page
- `Lucide` icons

### Planned additions

- `LangGraph` for agent orchestration
- `LiteLLM` for provider routing
- `Redis` for pub/sub and caching
- `Pinecone` or `pgvector` for retrieval
- document parsing and embedding pipelines

## API surface available now

The backend already exposes a small but real surface area:

### Health

- `GET /health`

### Authentication

- `GET /api/auth/login`
- `GET /api/auth/callback`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Projects

- `POST /api/projects/`
- `GET /api/projects/`
- `GET /api/projects/{project_id}`
- `PATCH /api/projects/{project_id}`
- `DELETE /api/projects/{project_id}`

## Local development

### Requirements

- Python `3.12+`
- Node.js `20+`
- `uv`
- `pnpm`
- Docker

### 1. Start Postgres

From the repo root:

```bash
docker compose up -d db
```

The current `docker-compose.yml` only provisions the database. Backend and frontend are started separately during local development.

### 2. Run the backend

```bash
cd backend
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --port 8000
```

Backend defaults are defined in `backend/app/config.py`, and local overrides can be placed in `.env` or `.env.local`.

Useful settings include:

```env
SECRET_KEY=change-me
DEBUG=true
DATABASE_URL=postgresql+asyncpg://askelad_user:askelad_password@localhost:5432/askelad
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:8000/auth/callback
```

### 3. Run the frontend

```bash
cd frontend
pnpm install
pnpm dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Development notes

- use `uv`, not `pip`, for backend dependency management
- use `pnpm`, not `npm` or `yarn`, for frontend work
- the current frontend is still mostly the public marketing site
- the current backend does not yet implement agent orchestration, RAG, or notifications
- the implementation plan below is directionally correct, but it is not a description of everything already built

## MVP roadmap

The implementation plan you provided maps well to the intended next phases:

1. complete the authenticated founder workspace
2. add document ingestion and shared project context
3. implement finance, marketing, and product agent flows
4. add cofounder supervision and clarification tracking
5. stream agent responses to the frontend
6. add notifications for blockers and missing information
7. ship settings for provider selection and encrypted BYO API keys

## Testing

Current verification is mostly developer-driven:

- backend migrations through Alembic
- frontend linting with ESLint
- frontend type-checking with TypeScript

As the agent layer lands, the repo should add explicit tests for:

- clarification behavior
- auth and token refresh flows
- project ownership and authorization checks
- retrieval and context assembly
- cofounder alerts and notification delivery

## License

MIT
