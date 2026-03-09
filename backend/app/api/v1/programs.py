import logging
import uuid
from datetime import date, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.api.deps import (
    DB,
    CurrentUser,
    require_coordinator_or_above,
    require_internal,
    require_rm_or_above,
)
from app.models.client import Client  # noqa: F401
from app.models.milestone import Milestone
from app.models.program import Program
from app.models.task import Task
from app.schemas.program import (
    MilestoneCreate,
    MilestoneResponse,
    MilestoneUpdate,
    ProgramCreate,
    ProgramDetailResponse,
    ProgramListResponse,
    ProgramResponse,
    ProgramSummary,
    ProgramSummaryMilestone,
    ProgramUpdate,
    TaskCreate,
    TaskResponse,
    TaskUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter()


def compute_rag_status(milestones: list[Milestone]) -> str:
    today = date.today()
    for m in milestones:
        if m.status != "completed" and m.due_date and m.due_date < today:
            return "red"
    for m in milestones:
        if m.status != "completed" and m.due_date and m.due_date <= today + timedelta(days=7):
            return "amber"
    return "green"


def build_program_response(program: Program) -> dict[str, Any]:
    milestones = program.milestones or []
    milestone_count = len(milestones)
    completed_milestone_count = sum(1 for m in milestones if m.status == "completed")
    rag_status = compute_rag_status(milestones)
    client_name = program.client.name if program.client else ""
    return {
        **{c.key: getattr(program, c.key) for c in program.__table__.columns},
        "client_name": client_name,
        "rag_status": rag_status,
        "milestone_count": milestone_count,
        "completed_milestone_count": completed_milestone_count,
    }


def build_milestone_response(milestone: Milestone) -> dict[str, Any]:
    tasks = milestone.tasks or []
    return {
        **{c.key: getattr(milestone, c.key) for c in milestone.__table__.columns},
        "task_count": len(tasks),
        "completed_task_count": sum(1 for t in tasks if t.status == "done"),
    }


def build_program_detail_response(program: Program) -> dict[str, Any]:
    milestones = program.milestones or []
    milestone_count = len(milestones)
    completed_milestone_count = sum(1 for m in milestones if m.status == "completed")
    rag_status = compute_rag_status(milestones)
    client_name = program.client.name if program.client else ""
    milestone_details = []
    for m in milestones:
        tasks = m.tasks or []
        milestone_details.append(
            {
                **{c.key: getattr(m, c.key) for c in m.__table__.columns},
                "task_count": len(tasks),
                "completed_task_count": sum(1 for t in tasks if t.status == "done"),
                "tasks": tasks,
            }
        )
    return {
        **{c.key: getattr(program, c.key) for c in program.__table__.columns},
        "client_name": client_name,
        "rag_status": rag_status,
        "milestone_count": milestone_count,
        "completed_milestone_count": completed_milestone_count,
        "milestones": milestone_details,
    }


@router.post(
    "/",
    response_model=ProgramResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_program(
    data: ProgramCreate,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_rm_or_above),
):
    program = Program(
        client_id=data.client_id,
        title=data.title,
        objectives=data.objectives,
        scope=data.scope,
        budget_envelope=data.budget_envelope,
        start_date=data.start_date,
        end_date=data.end_date,
        created_by=current_user.id,
    )
    db.add(program)
    await db.flush()

    for m_data in data.milestones:
        milestone = Milestone(
            program_id=program.id,
            title=m_data.title,
            description=m_data.description,
            due_date=m_data.due_date,
            position=m_data.position,
        )
        db.add(milestone)

    await db.commit()

    result = await db.execute(
        select(Program)
        .options(
            selectinload(Program.client),
            selectinload(Program.milestones).selectinload(Milestone.tasks),
        )
        .where(Program.id == program.id)
    )
    program = result.scalar_one()

    try:
        from app.services.auto_dispatch_service import (
            on_program_created,
        )

        await on_program_created(db, program)
    except Exception:
        logger.exception(
            "Failed to dispatch program_kickoff for %s",
            program.id,
        )

    return build_program_response(program)


@router.get("/", response_model=ProgramListResponse)
async def list_programs(
    db: DB,
    status_filter: str | None = Query(None, alias="status"),
    client_id: uuid.UUID | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    _: None = Depends(require_internal),
):
    query = select(Program).options(
        selectinload(Program.client),
        selectinload(Program.milestones).selectinload(Milestone.tasks),
    )
    count_query = select(func.count()).select_from(Program)

    if status_filter:
        query = query.where(Program.status == status_filter)
        count_query = count_query.where(Program.status == status_filter)
    if client_id:
        query = query.where(Program.client_id == client_id)
        count_query = count_query.where(Program.client_id == client_id)

    total = (await db.execute(count_query)).scalar_one()
    result = await db.execute(query.order_by(Program.created_at.desc()).offset(skip).limit(limit))
    programs = result.scalars().unique().all()
    return ProgramListResponse(
        programs=[build_program_response(p) for p in programs],
        total=total,
    )


@router.get(
    "/{program_id}",
    response_model=ProgramDetailResponse,
    dependencies=[Depends(require_internal)],
)
async def get_program(program_id: uuid.UUID, db: DB):
    result = await db.execute(
        select(Program)
        .options(
            selectinload(Program.client),
            selectinload(Program.milestones).selectinload(Milestone.tasks),
        )
        .where(Program.id == program_id)
    )
    program = result.scalar_one_or_none()
    if not program:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")
    return build_program_detail_response(program)


@router.patch(
    "/{program_id}",
    response_model=ProgramResponse,
    dependencies=[Depends(require_rm_or_above)],
)
async def update_program(program_id: uuid.UUID, data: ProgramUpdate, db: DB):
    result = await db.execute(
        select(Program)
        .options(
            selectinload(Program.client),
            selectinload(Program.milestones).selectinload(Milestone.tasks),
        )
        .where(Program.id == program_id)
    )
    program = result.scalar_one_or_none()
    if not program:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Program not found",
        )

    old_status = program.status
    update_data = data.model_dump(exclude_unset=True)
    if "status" in update_data and update_data["status"] is not None:
        update_data["status"] = update_data["status"].value

    for field, value in update_data.items():
        setattr(program, field, value)

    await db.commit()
    await db.refresh(program)

    # Dispatch completion notification if status changed
    new_status = program.status
    if old_status != "completed" and new_status == "completed":
        try:
            from app.services.auto_dispatch_service import (
                on_program_completed,
            )

            await on_program_completed(db, program)
        except Exception:
            logger.exception(
                "Failed to dispatch completion_note for %s",
                program.id,
            )

    result = await db.execute(
        select(Program)
        .options(
            selectinload(Program.client),
            selectinload(Program.milestones).selectinload(Milestone.tasks),
        )
        .where(Program.id == program_id)
    )
    program = result.scalar_one()
    return build_program_response(program)


@router.get("/{program_id}/summary", response_model=ProgramSummary)
async def get_program_summary(program_id: uuid.UUID, db: DB, current_user: CurrentUser):
    result = await db.execute(
        select(Program).options(selectinload(Program.milestones)).where(Program.id == program_id)
    )
    program = result.scalar_one_or_none()
    if not program:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")

    milestones = program.milestones or []
    total = len(milestones)
    completed = sum(1 for m in milestones if m.status == "completed")
    progress = (completed / total * 100) if total > 0 else 0.0

    return ProgramSummary(
        id=program.id,
        title=program.title,
        status=program.status,
        start_date=program.start_date,
        end_date=program.end_date,
        milestone_progress=progress,
        milestones=[
            ProgramSummaryMilestone(title=m.title, status=m.status, due_date=m.due_date)
            for m in milestones
        ],
    )


# --- Milestone endpoints ---


@router.post(
    "/{program_id}/milestones",
    response_model=MilestoneResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_coordinator_or_above)],
)
async def add_milestone(program_id: uuid.UUID, data: MilestoneCreate, db: DB):
    result = await db.execute(select(Program).where(Program.id == program_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")

    milestone = Milestone(
        program_id=program_id,
        title=data.title,
        description=data.description,
        due_date=data.due_date,
        position=data.position,
    )
    db.add(milestone)
    await db.commit()

    result = await db.execute(
        select(Milestone).options(selectinload(Milestone.tasks)).where(Milestone.id == milestone.id)
    )
    milestone = result.scalar_one()
    return build_milestone_response(milestone)


@router.patch(
    "/milestones/{milestone_id}",
    response_model=MilestoneResponse,
    dependencies=[Depends(require_coordinator_or_above)],
)
async def update_milestone(milestone_id: uuid.UUID, data: MilestoneUpdate, db: DB):
    result = await db.execute(
        select(Milestone).options(selectinload(Milestone.tasks)).where(Milestone.id == milestone_id)
    )
    milestone = result.scalar_one_or_none()
    if not milestone:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Milestone not found")

    update_data = data.model_dump(exclude_unset=True)
    if "status" in update_data and update_data["status"] is not None:
        update_data["status"] = update_data["status"].value

    for field, value in update_data.items():
        setattr(milestone, field, value)

    await db.commit()
    await db.refresh(milestone)

    result = await db.execute(
        select(Milestone).options(selectinload(Milestone.tasks)).where(Milestone.id == milestone_id)
    )
    milestone = result.scalar_one()
    return build_milestone_response(milestone)


@router.delete(
    "/milestones/{milestone_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_rm_or_above)],
)
async def delete_milestone(milestone_id: uuid.UUID, db: DB):
    result = await db.execute(select(Milestone).where(Milestone.id == milestone_id))
    milestone = result.scalar_one_or_none()
    if not milestone:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Milestone not found")

    await db.delete(milestone)
    await db.commit()


# --- Task endpoints ---


@router.post(
    "/milestones/{milestone_id}/tasks",
    response_model=TaskResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_coordinator_or_above)],
)
async def add_task(milestone_id: uuid.UUID, data: TaskCreate, db: DB):
    result = await db.execute(select(Milestone).where(Milestone.id == milestone_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Milestone not found")

    task = Task(
        milestone_id=milestone_id,
        title=data.title,
        description=data.description,
        due_date=data.due_date,
        assigned_to=data.assigned_to,
        priority=data.priority.value,
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task


@router.patch(
    "/tasks/{task_id}",
    response_model=TaskResponse,
    dependencies=[Depends(require_coordinator_or_above)],
)
async def update_task(task_id: uuid.UUID, data: TaskUpdate, db: DB):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    update_data = data.model_dump(exclude_unset=True)
    if "status" in update_data and update_data["status"] is not None:
        update_data["status"] = update_data["status"].value
    if "priority" in update_data and update_data["priority"] is not None:
        update_data["priority"] = update_data["priority"].value

    for field, value in update_data.items():
        setattr(task, field, value)

    await db.commit()
    await db.refresh(task)
    return task


@router.delete(
    "/tasks/{task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_coordinator_or_above)],
)
async def delete_task(task_id: uuid.UUID, db: DB):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    await db.delete(task)
    await db.commit()
