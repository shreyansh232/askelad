"""add agent runtime tables

Revision ID: f1a2b3c4d5e6
Revises: 8d7a237d16d3
Create Date: 2026-04-01 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, Sequence[str], None] = '8d7a237d16d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('documents', sa.Column('excerpt', sa.Text(), nullable=True))

    op.create_table(
        'agent_threads',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('project_id', sa.String(), nullable=False),
        sa.Column('agent_type', sa.String(length=50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('project_id', 'agent_type', name='uq_agent_thread_project_agent'),
    )
    op.create_index(op.f('ix_agent_threads_project_id'), 'agent_threads', ['project_id'], unique=False)
    op.create_index(op.f('ix_agent_threads_agent_type'), 'agent_threads', ['agent_type'], unique=False)

    op.create_table(
        'agent_runs',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('thread_id', sa.String(), nullable=False),
        sa.Column('project_id', sa.String(), nullable=False),
        sa.Column('agent_type', sa.String(length=50), nullable=False),
        sa.Column('status', sa.String(length=32), nullable=False),
        sa.Column('model_name', sa.String(length=120), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['thread_id'], ['agent_threads.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_agent_runs_thread_id'), 'agent_runs', ['thread_id'], unique=False)
    op.create_index(op.f('ix_agent_runs_project_id'), 'agent_runs', ['project_id'], unique=False)
    op.create_index(op.f('ix_agent_runs_agent_type'), 'agent_runs', ['agent_type'], unique=False)
    op.create_index(op.f('ix_agent_runs_status'), 'agent_runs', ['status'], unique=False)

    op.create_table(
        'agent_messages',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('thread_id', sa.String(), nullable=False),
        sa.Column('run_id', sa.String(), nullable=True),
        sa.Column('role', sa.String(length=20), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('citations', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['run_id'], ['agent_runs.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['thread_id'], ['agent_threads.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_agent_messages_thread_id'), 'agent_messages', ['thread_id'], unique=False)
    op.create_index(op.f('ix_agent_messages_run_id'), 'agent_messages', ['run_id'], unique=False)

    op.create_table(
        'clarification_requests',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('thread_id', sa.String(), nullable=False),
        sa.Column('run_id', sa.String(), nullable=False),
        sa.Column('project_id', sa.String(), nullable=False),
        sa.Column('agent_type', sa.String(length=50), nullable=False),
        sa.Column('question', sa.Text(), nullable=False),
        sa.Column('requested_docs', sa.JSON(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('resolution_note', sa.Text(), nullable=True),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['run_id'], ['agent_runs.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['thread_id'], ['agent_threads.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_clarification_requests_thread_id'), 'clarification_requests', ['thread_id'], unique=False)
    op.create_index(op.f('ix_clarification_requests_run_id'), 'clarification_requests', ['run_id'], unique=False)
    op.create_index(op.f('ix_clarification_requests_project_id'), 'clarification_requests', ['project_id'], unique=False)
    op.create_index(op.f('ix_clarification_requests_agent_type'), 'clarification_requests', ['agent_type'], unique=False)
    op.create_index(op.f('ix_clarification_requests_status'), 'clarification_requests', ['status'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_clarification_requests_status'), table_name='clarification_requests')
    op.drop_index(op.f('ix_clarification_requests_agent_type'), table_name='clarification_requests')
    op.drop_index(op.f('ix_clarification_requests_project_id'), table_name='clarification_requests')
    op.drop_index(op.f('ix_clarification_requests_run_id'), table_name='clarification_requests')
    op.drop_index(op.f('ix_clarification_requests_thread_id'), table_name='clarification_requests')
    op.drop_table('clarification_requests')

    op.drop_index(op.f('ix_agent_messages_run_id'), table_name='agent_messages')
    op.drop_index(op.f('ix_agent_messages_thread_id'), table_name='agent_messages')
    op.drop_table('agent_messages')

    op.drop_index(op.f('ix_agent_runs_status'), table_name='agent_runs')
    op.drop_index(op.f('ix_agent_runs_agent_type'), table_name='agent_runs')
    op.drop_index(op.f('ix_agent_runs_project_id'), table_name='agent_runs')
    op.drop_index(op.f('ix_agent_runs_thread_id'), table_name='agent_runs')
    op.drop_table('agent_runs')

    op.drop_index(op.f('ix_agent_threads_agent_type'), table_name='agent_threads')
    op.drop_index(op.f('ix_agent_threads_project_id'), table_name='agent_threads')
    op.drop_table('agent_threads')

    op.drop_column('documents', 'excerpt')
