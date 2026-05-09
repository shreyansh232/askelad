"""add founder work system

Revision ID: b8c9d0e1f2a3
Revises: 78515111bbfd
Create Date: 2026-05-04 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b8c9d0e1f2a3"
down_revision: Union[str, Sequence[str], None] = "78515111bbfd"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _timestamps() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    ]


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "user_settings",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("default_provider", sa.String(length=40), nullable=False),
        sa.Column("default_model", sa.String(length=120), nullable=False),
        sa.Column("platform_key_fallback", sa.Boolean(), nullable=False),
        sa.Column("monthly_prompt_limit", sa.Integer(), nullable=True),
        *_timestamps(),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )

    op.create_table(
        "provider_keys",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("provider", sa.String(length=40), nullable=False),
        sa.Column("encrypted_api_key", sa.Text(), nullable=False),
        sa.Column("key_hint", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("last_tested_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        *_timestamps(),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id", "provider", name="uq_provider_key_user_provider"
        ),
    )
    op.create_index(op.f("ix_provider_keys_user_id"), "provider_keys", ["user_id"])
    op.create_index(op.f("ix_provider_keys_provider"), "provider_keys", ["provider"])
    op.create_index(op.f("ix_provider_keys_status"), "provider_keys", ["status"])

    op.create_table(
        "agent_run_steps",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("run_id", sa.String(), nullable=False),
        sa.Column("project_id", sa.String(), nullable=False),
        sa.Column("agent_type", sa.String(length=50), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.String(length=80), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["run_id"], ["agent_runs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_agent_run_steps_run_id"), "agent_run_steps", ["run_id"])
    op.create_index(
        op.f("ix_agent_run_steps_project_id"), "agent_run_steps", ["project_id"]
    )
    op.create_index(
        op.f("ix_agent_run_steps_agent_type"), "agent_run_steps", ["agent_type"]
    )
    op.create_index(
        op.f("ix_agent_run_steps_event_type"), "agent_run_steps", ["event_type"]
    )

    op.create_table(
        "tasks",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("project_id", sa.String(), nullable=False),
        sa.Column("source_run_id", sa.String(), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=40), nullable=False),
        sa.Column("priority", sa.String(length=20), nullable=False),
        sa.Column("owner_agent_type", sa.String(length=50), nullable=True),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("blocked_reason", sa.Text(), nullable=True),
        *_timestamps(),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["source_run_id"], ["agent_runs.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_tasks_project_id"), "tasks", ["project_id"])
    op.create_index(op.f("ix_tasks_source_run_id"), "tasks", ["source_run_id"])
    op.create_index(op.f("ix_tasks_status"), "tasks", ["status"])
    op.create_index(op.f("ix_tasks_priority"), "tasks", ["priority"])
    op.create_index(op.f("ix_tasks_owner_agent_type"), "tasks", ["owner_agent_type"])

    op.create_table(
        "task_events",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("task_id", sa.String(), nullable=False),
        sa.Column("project_id", sa.String(), nullable=False),
        sa.Column("actor_type", sa.String(length=40), nullable=False),
        sa.Column("actor_label", sa.String(length=120), nullable=True),
        sa.Column("event_type", sa.String(length=80), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("metadata_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_task_events_task_id"), "task_events", ["task_id"])
    op.create_index(op.f("ix_task_events_project_id"), "task_events", ["project_id"])
    op.create_index(op.f("ix_task_events_event_type"), "task_events", ["event_type"])

    op.create_table(
        "task_artifacts",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("project_id", sa.String(), nullable=False),
        sa.Column("task_id", sa.String(), nullable=True),
        sa.Column("run_id", sa.String(), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("artifact_type", sa.String(length=80), nullable=False),
        sa.Column("format", sa.String(length=40), nullable=False),
        sa.Column("current_version_id", sa.String(), nullable=True),
        *_timestamps(),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["run_id"], ["agent_runs.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_task_artifacts_project_id"), "task_artifacts", ["project_id"]
    )
    op.create_index(op.f("ix_task_artifacts_task_id"), "task_artifacts", ["task_id"])
    op.create_index(op.f("ix_task_artifacts_run_id"), "task_artifacts", ["run_id"])
    op.create_index(
        op.f("ix_task_artifacts_artifact_type"), "task_artifacts", ["artifact_type"]
    )
    op.create_index(
        op.f("ix_task_artifacts_current_version_id"),
        "task_artifacts",
        ["current_version_id"],
    )

    op.create_table(
        "task_artifact_versions",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("artifact_id", sa.String(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("metadata_json", sa.JSON(), nullable=False),
        sa.Column("created_by", sa.String(length=120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["artifact_id"], ["task_artifacts.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_task_artifact_versions_artifact_id"),
        "task_artifact_versions",
        ["artifact_id"],
    )

    op.create_table(
        "cofounder_digests",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("project_id", sa.String(), nullable=False),
        sa.Column("cadence", sa.String(length=20), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_cofounder_digests_project_id"),
        "cofounder_digests",
        ["project_id"],
    )

    op.create_table(
        "cofounder_monitors",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("project_id", sa.String(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("monitor_type", sa.String(length=50), nullable=False),
        sa.Column("query", sa.Text(), nullable=False),
        sa.Column("cadence", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("last_checked_at", sa.DateTime(timezone=True), nullable=True),
        *_timestamps(),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_cofounder_monitors_project_id"),
        "cofounder_monitors",
        ["project_id"],
    )
    op.create_index(
        op.f("ix_cofounder_monitors_monitor_type"),
        "cofounder_monitors",
        ["monitor_type"],
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(
        op.f("ix_cofounder_monitors_monitor_type"), table_name="cofounder_monitors"
    )
    op.drop_index(
        op.f("ix_cofounder_monitors_project_id"), table_name="cofounder_monitors"
    )
    op.drop_table("cofounder_monitors")

    op.drop_index(
        op.f("ix_cofounder_digests_project_id"), table_name="cofounder_digests"
    )
    op.drop_table("cofounder_digests")

    op.drop_index(
        op.f("ix_task_artifact_versions_artifact_id"),
        table_name="task_artifact_versions",
    )
    op.drop_table("task_artifact_versions")

    op.drop_index(
        op.f("ix_task_artifacts_current_version_id"), table_name="task_artifacts"
    )
    op.drop_index(op.f("ix_task_artifacts_artifact_type"), table_name="task_artifacts")
    op.drop_index(op.f("ix_task_artifacts_run_id"), table_name="task_artifacts")
    op.drop_index(op.f("ix_task_artifacts_task_id"), table_name="task_artifacts")
    op.drop_index(op.f("ix_task_artifacts_project_id"), table_name="task_artifacts")
    op.drop_table("task_artifacts")

    op.drop_index(op.f("ix_task_events_event_type"), table_name="task_events")
    op.drop_index(op.f("ix_task_events_project_id"), table_name="task_events")
    op.drop_index(op.f("ix_task_events_task_id"), table_name="task_events")
    op.drop_table("task_events")

    op.drop_index(op.f("ix_tasks_owner_agent_type"), table_name="tasks")
    op.drop_index(op.f("ix_tasks_priority"), table_name="tasks")
    op.drop_index(op.f("ix_tasks_status"), table_name="tasks")
    op.drop_index(op.f("ix_tasks_source_run_id"), table_name="tasks")
    op.drop_index(op.f("ix_tasks_project_id"), table_name="tasks")
    op.drop_table("tasks")

    op.drop_index(op.f("ix_agent_run_steps_event_type"), table_name="agent_run_steps")
    op.drop_index(op.f("ix_agent_run_steps_agent_type"), table_name="agent_run_steps")
    op.drop_index(op.f("ix_agent_run_steps_project_id"), table_name="agent_run_steps")
    op.drop_index(op.f("ix_agent_run_steps_run_id"), table_name="agent_run_steps")
    op.drop_table("agent_run_steps")

    op.drop_index(op.f("ix_provider_keys_status"), table_name="provider_keys")
    op.drop_index(op.f("ix_provider_keys_provider"), table_name="provider_keys")
    op.drop_index(op.f("ix_provider_keys_user_id"), table_name="provider_keys")
    op.drop_table("provider_keys")

    op.drop_table("user_settings")
