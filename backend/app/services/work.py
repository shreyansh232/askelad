import csv
import io
from datetime import datetime, timedelta, timezone
from typing import cast

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    AgentRunStep,
    ClarificationRequest,
    CofounderDigest,
    CofounderMonitor,
    Task,
    TaskArtifact,
    TaskArtifactVersion,
    TaskEvent,
)
from app.schemas.work import (
    AgentRunStepResponse,
    ArtifactFormat,
    ArtifactResponse,
    ArtifactVersionResponse,
    TaskResponse,
    WorkQueueResponse,
)


class WorkService:
    async def list_tasks(
        self,
        db: AsyncSession,
        project_id: str,
        status: str | None = None,
    ) -> list[Task]:
        statement: Select[tuple[Task]] = select(Task).where(
            Task.project_id == project_id
        )
        if status:
            statement = statement.where(Task.status == status)
        result = await db.execute(
            statement.order_by(
                Task.status.asc(), Task.priority.desc(), Task.created_at.desc()
            )
        )
        return list(result.scalars().all())

    async def create_task(
        self,
        db: AsyncSession,
        project_id: str,
        title: str,
        description: str | None = None,
        status: str = "todo",
        priority: str = "medium",
        owner_agent_type: str | None = None,
        due_at: datetime | None = None,
        blocked_reason: str | None = None,
        source_run_id: str | None = None,
        actor_type: str = "founder",
        actor_label: str | None = None,
    ) -> Task:
        task = Task(
            project_id=project_id,
            source_run_id=source_run_id,
            title=title,
            description=description,
            status=status,
            priority=priority,
            owner_agent_type=owner_agent_type,
            due_at=due_at,
            blocked_reason=blocked_reason,
        )
        db.add(task)
        await db.flush()
        db.add(
            TaskEvent(
                task_id=task.id,
                project_id=project_id,
                actor_type=actor_type,
                actor_label=actor_label,
                event_type="created",
                summary=f"Created task: {title}",
                metadata_json={},
            )
        )
        return task

    async def update_task(
        self,
        db: AsyncSession,
        project_id: str,
        task_id: str,
        actor_type: str = "founder",
        actor_label: str | None = None,
        **updates,
    ) -> Task | None:
        task = await self.get_task(db, project_id, task_id)
        if not task:
            return None

        changed: dict[str, object] = {}
        for field, value in updates.items():
            if value is None:
                continue
            current = getattr(task, field)
            if current != value:
                setattr(task, field, value)
                changed[field] = value

        if changed:
            db.add(
                TaskEvent(
                    task_id=task.id,
                    project_id=project_id,
                    actor_type=actor_type,
                    actor_label=actor_label,
                    event_type="updated",
                    summary=f"Updated {', '.join(changed.keys())}.",
                    metadata_json=changed,
                )
            )
        return task

    async def get_task(
        self, db: AsyncSession, project_id: str, task_id: str
    ) -> Task | None:
        result = await db.execute(
            select(Task).where(Task.id == task_id, Task.project_id == project_id)
        )
        return result.scalar_one_or_none()

    async def list_task_events(
        self, db: AsyncSession, project_id: str, task_id: str
    ) -> list[TaskEvent]:
        result = await db.execute(
            select(TaskEvent)
            .where(TaskEvent.task_id == task_id, TaskEvent.project_id == project_id)
            .order_by(TaskEvent.created_at.asc())
        )
        return list(result.scalars().all())

    async def add_task_event(
        self,
        db: AsyncSession,
        project_id: str,
        task_id: str,
        event_type: str,
        summary: str,
        actor_type: str = "founder",
        actor_label: str | None = None,
        metadata_json: dict | None = None,
    ) -> TaskEvent | None:
        task = await self.get_task(db, project_id, task_id)
        if not task:
            return None
        event = TaskEvent(
            task_id=task_id,
            project_id=project_id,
            actor_type=actor_type,
            actor_label=actor_label,
            event_type=event_type,
            summary=summary,
            metadata_json=metadata_json or {},
        )
        db.add(event)
        return event

    async def create_artifact(
        self,
        db: AsyncSession,
        project_id: str,
        title: str,
        content: str,
        artifact_type: str = "general",
        format: str = "markdown",
        task_id: str | None = None,
        run_id: str | None = None,
        created_by: str = "founder",
        metadata_json: dict | None = None,
    ) -> tuple[TaskArtifact, TaskArtifactVersion]:
        artifact = TaskArtifact(
            project_id=project_id,
            task_id=task_id,
            run_id=run_id,
            title=title,
            artifact_type=artifact_type,
            format=format,
        )
        db.add(artifact)
        await db.flush()
        version = TaskArtifactVersion(
            artifact_id=artifact.id,
            version=1,
            content=content,
            metadata_json=metadata_json or {},
            created_by=created_by,
        )
        db.add(version)
        await db.flush()
        artifact.current_version_id = version.id
        if task_id:
            db.add(
                TaskEvent(
                    task_id=task_id,
                    project_id=project_id,
                    actor_type="agent" if created_by != "founder" else "founder",
                    actor_label=created_by,
                    event_type="artifact_created",
                    summary=f"Created artifact: {title}",
                    metadata_json={"artifact_id": artifact.id},
                )
            )
        return artifact, version

    async def add_artifact_version(
        self,
        db: AsyncSession,
        project_id: str,
        artifact_id: str,
        content: str,
        created_by: str = "founder",
        metadata_json: dict | None = None,
    ) -> tuple[TaskArtifact, TaskArtifactVersion] | None:
        artifact = await self.get_artifact(db, project_id, artifact_id)
        if not artifact:
            return None
        latest = await self.get_current_artifact_version(db, artifact)
        version_number = (latest.version if latest else 0) + 1
        version = TaskArtifactVersion(
            artifact_id=artifact.id,
            version=version_number,
            content=content,
            metadata_json=metadata_json or {},
            created_by=created_by,
        )
        db.add(version)
        await db.flush()
        artifact.current_version_id = version.id
        return artifact, version

    async def get_artifact(
        self, db: AsyncSession, project_id: str, artifact_id: str
    ) -> TaskArtifact | None:
        result = await db.execute(
            select(TaskArtifact).where(
                TaskArtifact.id == artifact_id,
                TaskArtifact.project_id == project_id,
            )
        )
        return result.scalar_one_or_none()

    async def list_artifacts(
        self, db: AsyncSession, project_id: str
    ) -> list[tuple[TaskArtifact, TaskArtifactVersion | None]]:
        result = await db.execute(
            select(TaskArtifact)
            .where(TaskArtifact.project_id == project_id)
            .order_by(TaskArtifact.updated_at.desc())
        )
        artifacts = list(result.scalars().all())
        return [
            (artifact, await self.get_current_artifact_version(db, artifact))
            for artifact in artifacts
        ]

    async def get_current_artifact_version(
        self, db: AsyncSession, artifact: TaskArtifact
    ) -> TaskArtifactVersion | None:
        if not artifact.current_version_id:
            return None
        result = await db.execute(
            select(TaskArtifactVersion).where(
                TaskArtifactVersion.id == artifact.current_version_id,
                TaskArtifactVersion.artifact_id == artifact.id,
            )
        )
        return result.scalar_one_or_none()

    def artifact_response(
        self, artifact: TaskArtifact, version: TaskArtifactVersion | None
    ) -> ArtifactResponse:
        return ArtifactResponse(
            id=artifact.id,
            project_id=artifact.project_id,
            task_id=artifact.task_id,
            run_id=artifact.run_id,
            title=artifact.title,
            artifact_type=artifact.artifact_type,
            format=cast(ArtifactFormat, artifact.format),
            current_version_id=artifact.current_version_id,
            created_at=artifact.created_at,
            updated_at=artifact.updated_at,
            current_version=ArtifactVersionResponse.model_validate(version)
            if version
            else None,
        )

    async def build_work_queue(
        self, db: AsyncSession, project_id: str
    ) -> WorkQueueResponse:
        tasks = await self.list_tasks(db, project_id)
        now = datetime.now(timezone.utc)
        today_cutoff = now + timedelta(days=1)
        today = [
            task
            for task in tasks
            if task.status in {"todo", "in_progress"}
            and (
                task.priority in {"high", "urgent"}
                or (task.due_at is not None and task.due_at <= today_cutoff)
            )
        ]
        today_ids = {task.id for task in today}
        blocked = [task for task in tasks if task.status == "blocked"]
        waiting = [task for task in tasks if task.status == "waiting_for_user"]
        upcoming = [
            task
            for task in tasks
            if task.status in {"todo", "in_progress"} and task.id not in today_ids
        ][:8]

        artifact_pairs = (await self.list_artifacts(db, project_id))[:6]
        step_result = await db.execute(
            select(AgentRunStep)
            .where(AgentRunStep.project_id == project_id)
            .order_by(AgentRunStep.created_at.desc())
            .limit(10)
        )
        clarification_result = await db.execute(
            select(func.count(ClarificationRequest.id)).where(
                ClarificationRequest.project_id == project_id,
                ClarificationRequest.status == "open",
            )
        )
        stale_cutoff = now - timedelta(days=3)
        stale_count = len(
            [
                task
                for task in tasks
                if task.status not in {"done", "archived"}
                and task.updated_at < stale_cutoff
            ]
        )
        return WorkQueueResponse(
            today=[TaskResponse.model_validate(task) for task in today],
            blocked=[TaskResponse.model_validate(task) for task in blocked],
            waiting_for_you=[TaskResponse.model_validate(task) for task in waiting],
            upcoming=[TaskResponse.model_validate(task) for task in upcoming],
            recent_artifacts=[
                self.artifact_response(artifact, version)
                for artifact, version in artifact_pairs
            ],
            recent_steps=[
                AgentRunStepResponse.model_validate(step)
                for step in step_result.scalars().all()
            ],
            unresolved_clarifications=int(clarification_result.scalar_one()),
            stale_task_count=stale_count,
        )

    async def create_digest(
        self, db: AsyncSession, project_id: str, cadence: str
    ) -> CofounderDigest:
        queue = await self.build_work_queue(db, project_id)
        summary = (
            f"{len(queue.today)} priority item(s), {len(queue.blocked)} blocker(s), "
            f"{len(queue.waiting_for_you)} item(s) waiting on the founder, and "
            f"{queue.unresolved_clarifications} unresolved clarification(s)."
        )
        digest = CofounderDigest(
            project_id=project_id,
            cadence=cadence,
            title=f"{cadence.capitalize()} Cofounder Brief",
            summary=summary,
            payload=queue.model_dump(mode="json"),
        )
        db.add(digest)
        await db.commit()
        await db.refresh(digest)
        return digest

    async def list_digests(
        self, db: AsyncSession, project_id: str
    ) -> list[CofounderDigest]:
        result = await db.execute(
            select(CofounderDigest)
            .where(CofounderDigest.project_id == project_id)
            .order_by(CofounderDigest.created_at.desc())
            .limit(20)
        )
        return list(result.scalars().all())

    async def list_monitors(
        self, db: AsyncSession, project_id: str
    ) -> list[CofounderMonitor]:
        result = await db.execute(
            select(CofounderMonitor)
            .where(CofounderMonitor.project_id == project_id)
            .order_by(CofounderMonitor.created_at.desc())
        )
        return list(result.scalars().all())

    async def create_monitor(
        self,
        db: AsyncSession,
        project_id: str,
        title: str,
        monitor_type: str,
        query: str,
        cadence: str,
    ) -> CofounderMonitor:
        monitor = CofounderMonitor(
            project_id=project_id,
            title=title,
            monitor_type=monitor_type,
            query=query,
            cadence=cadence,
            status="active",
        )
        db.add(monitor)
        await db.commit()
        await db.refresh(monitor)
        return monitor

    async def update_monitor(
        self, db: AsyncSession, project_id: str, monitor_id: str, **updates
    ) -> CofounderMonitor | None:
        result = await db.execute(
            select(CofounderMonitor).where(
                CofounderMonitor.id == monitor_id,
                CofounderMonitor.project_id == project_id,
            )
        )
        monitor = result.scalar_one_or_none()
        if not monitor:
            return None
        for field, value in updates.items():
            if value is not None:
                setattr(monitor, field, value)
        await db.commit()
        await db.refresh(monitor)
        return monitor

    def export_markdown(self, artifact: ArtifactResponse) -> str:
        content = artifact.current_version.content if artifact.current_version else ""
        return f"# {artifact.title}\n\n{content}".strip() + "\n"

    def export_csv(self, artifact: ArtifactResponse) -> str:
        content = artifact.current_version.content if artifact.current_version else ""
        if artifact.format == "csv":
            return content
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["title", "artifact_type", "version", "content"])
        writer.writerow(
            [
                artifact.title,
                artifact.artifact_type,
                artifact.current_version.version if artifact.current_version else "",
                content,
            ]
        )
        return output.getvalue()

    def export_pdf_bytes(self, artifact: ArtifactResponse) -> bytes:
        text = self.export_markdown(artifact).replace("\\", "\\\\")
        text = text.replace("(", "\\(").replace(")", "\\)")
        lines = text.splitlines()[:40]
        commands = ["BT", "/F1 12 Tf", "72 760 Td"]
        for index, line in enumerate(lines):
            if index > 0:
                commands.append("0 -16 Td")
            commands.append(f"({line[:95]}) Tj")
        commands.append("ET")
        stream = "\n".join(commands)
        objects = [
            "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
            "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
            (
                "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
                "/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj"
            ),
            "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
            f"5 0 obj << /Length {len(stream.encode('utf-8'))} >> stream\n{stream}\nendstream endobj",
        ]
        body = "%PDF-1.4\n" + "\n".join(objects) + "\n"
        xref_start = len(body.encode("utf-8"))
        pdf = (
            body
            + f"xref\n0 {len(objects) + 1}\n"
            + "0000000000 65535 f \n"
            + "".join("0000000000 00000 n \n" for _ in objects)
            + f"trailer << /Root 1 0 R /Size {len(objects) + 1} >>\n"
            + f"startxref\n{xref_start}\n%%EOF"
        )
        return pdf.encode("utf-8")


work_service = WorkService()
