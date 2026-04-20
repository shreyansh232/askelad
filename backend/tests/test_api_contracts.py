from datetime import datetime, timezone

from fastapi.testclient import TestClient

from app.api.deps import get_current_user, get_db
from app.db.models import AgentMessage, AgentRun, Document, Project, User
from app.main import app


def _override_db():
    yield object()


async def _override_current_user():
    return User(id='user-1', email='founder@example.com', name='Founder')


def _make_client() -> TestClient:
    app.dependency_overrides.clear()
    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[get_current_user] = _override_current_user
    return TestClient(app)


def test_app_registers_documents_and_agent_routes():
    routes = {route.path for route in app.routes}

    assert '/api/projects/{project_id}/documents' in routes
    assert '/api/projects/{project_id}/agents/{agent_type}/messages' in routes
    assert '/api/projects/{project_id}/agents/{agent_type}/stream' in routes
    assert '/api/projects/{project_id}/clarifications' in routes


def test_create_agent_message_returns_pending_run(monkeypatch):
    client = _make_client()
    created_at = datetime.now(timezone.utc)
    project = Project(
        id='project-1',
        user_id='user-1',
        name='Askelad',
        description='AI team for solo founders',
        industry='SaaS',
        created_at=created_at,
        updated_at=created_at,
    )
    run = AgentRun(
        id='run-1',
        thread_id='thread-1',
        project_id='project-1',
        agent_type='cofounder',
        status='pending',
        model_name='gpt-4o-mini',
        created_at=created_at,
        updated_at=created_at,
    )
    message = AgentMessage(
        id='msg-1',
        thread_id='thread-1',
        run_id='run-1',
        role='user',
        content='Help me prioritize GTM.',
        citations=[],
        created_at=created_at,
    )

    async def fake_get_project_for_user(db, project_id, user_id):
        assert project_id == 'project-1'
        assert user_id == 'user-1'
        return project

    async def fake_create_message_run(db, project, agent_type, content):
        assert agent_type == 'cofounder'
        assert content == 'Help me prioritize GTM.'
        return run, message

    monkeypatch.setattr('app.api.v1.agents.get_project_for_user', fake_get_project_for_user)
    monkeypatch.setattr('app.api.v1.agents.agent_service.create_message_run', fake_create_message_run)

    response = client.post(
        '/api/projects/project-1/agents/cofounder/messages',
        json={'content': 'Help me prioritize GTM.'},
    )

    assert response.status_code == 201
    assert response.json()['run']['status'] == 'pending'
    assert response.json()['user_message']['content'] == 'Help me prioritize GTM.'


def test_stream_agent_run_emits_sse_events(monkeypatch):
    client = _make_client()
    created_at = datetime.now(timezone.utc)
    project = Project(
        id='project-1',
        user_id='user-1',
        name='Askelad',
        description='AI team for solo founders',
        industry='SaaS',
        created_at=created_at,
        updated_at=created_at,
    )

    async def fake_get_project_for_user(db, project_id, user_id):
        return project

    async def fake_stream_run(db, project, agent_type, run_id):
        yield {'event': 'run.started', 'data': {'run_id': run_id}}
        yield {'event': 'message.delta', 'data': {'run_id': run_id, 'delta': 'Hello'}}
        yield {'event': 'run.completed', 'data': {'run_id': run_id, 'status': 'completed'}}

    monkeypatch.setattr('app.api.v1.agents.get_project_for_user', fake_get_project_for_user)
    monkeypatch.setattr('app.api.v1.agents.agent_service.stream_run', fake_stream_run)

    with client.stream(
        'GET',
        '/api/projects/project-1/agents/cofounder/stream?run_id=run-1',
    ) as response:
        body = ''.join(chunk.decode() if isinstance(chunk, bytes) else chunk for chunk in response.iter_text())

    assert response.status_code == 200
    assert 'event: run.started' in body
    assert 'event: message.delta' in body
    assert 'Hello' in body
    assert 'event: run.completed' in body


def test_list_documents_serializes_document_response(monkeypatch):
    client = _make_client()
    created_at = datetime.now(timezone.utc)
    project = Project(
        id='project-1',
        user_id='user-1',
        name='Askelad',
        description='AI team for solo founders',
        industry='SaaS',
        created_at=created_at,
        updated_at=created_at,
    )
    document = Document(
        id='doc-1',
        project_id='project-1',
        filename='deck.pdf',
        file_type='application/pdf',
        storage_url='https://example.com/deck.pdf',
        excerpt='Pitch deck summary',
        vector_id='vec-1',
        created_at=created_at,
        updated_at=created_at,
    )

    async def fake_get_project_for_user(db, project_id, user_id):
        return project

    async def fake_get_project_documents(db, project_id):
        return [document]

    monkeypatch.setattr('app.api.v1.documents.get_project_for_user', fake_get_project_for_user)
    monkeypatch.setattr(
        'app.api.v1.documents.document_service.get_project_documents',
        fake_get_project_documents,
    )

    response = client.get('/api/projects/project-1/documents')

    assert response.status_code == 200
    payload = response.json()
    assert payload[0]['filename'] == 'deck.pdf'
    assert payload[0]['excerpt'] == 'Pitch deck summary'
