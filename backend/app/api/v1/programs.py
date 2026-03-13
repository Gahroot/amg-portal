import logging
import uuid
from datetime import date, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
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
from app.models.enums import UserRole
from app.models.milestone import Milestone
from app.models.program import Program
from app.models.program_closure import ProgramClosure
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
    RetentionInfo,
    TaskCreate,
    TaskResponse,
    TaskUpdate,
)
from app.services.archival_service import get_retention_info
from app.services.audit_service import log_action, model_to_dict
from app.services.program_lifecycle_service import validate_status_transition

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


def build_program_response(program: Program, *, user_role: str | None = None) -> dict[str, Any]:
    milestones = program.milestones or []
    milestone_count = len(milestones)
    completed_milestone_count = sum(1 for m in milestones if m.status == "completed")
    rag_status = compute_rag_status(milestones)
    client_name = program.client.name if program.client else ""
    resp = {
        **{c.key: getattr(program, c.key) for c in program.__table__.columns},
        "client_name": client_name,
        "rag_status": rag_status,
        "milestone_count": milestone_count,
        "completed_milestone_count": completed_milestone_count,
    }
    # Coordinators must not see client financial data / billing
    if user_role == UserRole.coordinator.value:
        resp["budget_envelope"] = None
    return resp


def build_milestone_response(milestone: Milestone) -> dict[str, Any]:
    tasks = milestone.tasks or []
    return {
        **{c.key: getattr(milestone, c.key) for c in milestone.__table__.columns},
        "task_count": len(tasks),
        "completed_task_count": sum(1 for t in tasks if t.status == "done"),
    }


def build_program_detail_response(
    program: Program, *, user_role: str | None = None
) -> dict[str, Any]:
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
    resp = {
        **{c.key: getattr(program, c.key) for c in program.__table__.columns},
        "client_name": client_name,
        "rag_status": rag_status,
        "milestone_count": milestone_count,
        "completed_milestone_count": completed_milestone_count,
        "milestones": milestone_details,
    }
    # Coordinators must not see client financial data / billing
    if user_role == UserRole.coordinator.value:
        resp["budget_envelope"] = None
    return resp


@router.post(
    "/",
    response_model=ProgramResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_program(
    data: ProgramCreate,
    db: DB,
    current_user: CurrentUser,
    request: Request,
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

    await log_action(
        db,
        user_id=current_user.id,
        user_email=current_user.email,
        action="create",
        entity_type="program",
        entity_id=str(program.id),
        after_state=model_to_dict(program),
        request=request,
    )
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
    current_user: CurrentUser,
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
        programs=[build_program_response(p, user_role=current_user.role) for p in programs],
        total=total,
    )


@router.get(
    "/{program_id}",
    response_model=ProgramDetailResponse,
)
async def get_program(
    program_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    _: None = Depends(require_internal),
):
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

    resp = build_program_detail_response(program, user_role=current_user.role)

    # Attach retention info for closed/archived programs
    closure_completed_at = None
    if program.status in ("closed", "archived"):
        closure_result = await db.execute(
            select(ProgramClosure.completed_at).where(ProgramClosure.program_id == program_id)
        )
        closure_completed_at = closure_result.scalar_one_or_none()

    info = get_retention_info(program.status, closure_completed_at)
    resp["retention_info"] = RetentionInfo(
        is_archived=info.is_archived,
        retention_period_days=info.retention_period_days,
        days_until_archival=info.days_until_archival,
        closure_completed_at=info.closure_completed_at,
    )
    return resp


@router.patch(
    "/{program_id}",
    response_model=ProgramResponse,
    dependencies=[Depends(require_rm_or_above)],
)
async def update_program(
    program_id: uuid.UUID,
    data: ProgramUpdate,
    db: DB,
    current_user: CurrentUser,
    request: Request,
):
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

    # Archived programs are read-only
    if program.status == "archived":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Archived programs are read-only and cannot be modified.",
        )

    before = model_to_dict(program)
    old_status = program.status
    update_data = data.model_dump(exclude_unset=True)

    # Validate status transition before applying any changes
    if "status" in update_data and update_data["status"] is not None:
        new_status_raw = update_data["status"].value
        await validate_status_transition(db, program, new_status_raw)
        update_data["status"] = new_status_raw

    for field, value in update_data.items():
        setattr(program, field, value)

    await log_action(
        db,
        user_id=current_user.id,
        user_email=current_user.email,
        action="update",
        entity_type="program",
        entity_id=str(program_id),
        before_state=before,
        after_state=model_to_dict(program),
        request=request,
    )
    await db.commit()
    await db.refresh(program)

    # Dispatch lifecycle notifications on status change
    new_status = program.status
    if old_status != "active" and new_status == "active":
        try:
            from app.services.auto_dispatch_service import (
                on_program_activated,
            )

            await on_program_activated(db, program)
        except Exception:
            logger.exception(
                "Failed to dispatch program_kickoff for %s",
                program.id,
            )

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
async def get_program_summary(program_id: uuid.UUID, db: DB, current_user: CurrentUser) -> Any:
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
async def add_milestone(
    program_id: uuid.UUID,
    data: MilestoneCreate,
    db: DB,
    current_user: CurrentUser,
    request: Request,
):
    result = await db.execute(select(Program).where(Program.id == program_id))
    program = result.scalar_one_or_none()
    if not program:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")
    if program.status == "archived":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Archived programs are read-only and cannot be modified.",
        )

    milestone = Milestone(
        program_id=program_id,
        title=data.title,
        description=data.description,
        due_date=data.due_date,
        position=data.position,
    )
    db.add(milestone)
    await db.flush()
    await log_action(
        db,
        user_id=current_user.id,
        user_email=current_user.email,
        action="create",
        entity_type="milestone",
        entity_id=str(milestone.id),
        after_state=model_to_dict(milestone),
        request=request,
    )
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
async def update_milestone(
    milestone_id: uuid.UUID,
    data: MilestoneUpdate,
    db: DB,
    current_user: CurrentUser,
    request: Request,
):
    result = await db.execute(
        select(Milestone).options(selectinload(Milestone.tasks)).where(Milestone.id == milestone_id)
    )
    milestone = result.scalar_one_or_none()
    if not milestone:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Milestone not found")

    # Check if parent program is archived
    prog_result = await db.execute(select(Program.status).where(Program.id == milestone.program_id))
    if prog_result.scalar_one_or_none() == "archived":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Archived programs are read-only and cannot be modified.",
        )

    before = model_to_dict(milestone)
    old_milestone_status = milestone.status
    update_data = data.model_dump(exclude_unset=True)
    if "status" in update_data and update_data["status"] is not None:
        update_data["status"] = update_data["status"].value

    for field, value in update_data.items():
        setattr(milestone, field, value)

    await log_action(
        db,
        user_id=current_user.id,
        user_email=current_user.email,
        action="update",
        entity_type="milestone",
        entity_id=str(milestone_id),
        before_state=before,
        after_state=model_to_dict(milestone),
        request=request,
    )
    await db.commit()
    await db.refresh(milestone)

    # Dispatch milestone_alert when milestone is completed
    if old_milestone_status != "completed" and milestone.status == "completed":
        try:
            from app.services.auto_dispatch_service import (
                on_milestone_completed,
            )

            await on_milestone_completed(db, milestone)
        except Exception:
            logger.exception(
                "Failed to dispatch milestone_alert for %s",
                milestone_id,
            )

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
async def delete_milestone(
    milestone_id: uuid.UUID, db: DB, current_user: CurrentUser, request: Request
):
    result = await db.execute(select(Milestone).where(Milestone.id == milestone_id))
    milestone = result.scalar_one_or_none()
    if not milestone:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Milestone not found")

    # Check if parent program is archived
    prog_result = await db.execute(select(Program.status).where(Program.id == milestone.program_id))
    if prog_result.scalar_one_or_none() == "archived":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Archived programs are read-only and cannot be modified.",
        )

    before = model_to_dict(milestone)
    await db.delete(milestone)
    await log_action(
        db,
        user_id=current_user.id,
        user_email=current_user.email,
        action="delete",
        entity_type="milestone",
        entity_id=str(milestone_id),
        before_state=before,
        request=request,
    )
    await db.commit()


# --- Task endpoints ---


@router.post(
    "/milestones/{milestone_id}/tasks",
    response_model=TaskResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_coordinator_or_above)],
)
async def add_task(
    milestone_id: uuid.UUID, data: TaskCreate, db: DB, current_user: CurrentUser, request: Request
):
    result = await db.execute(select(Milestone).where(Milestone.id == milestone_id))
    ms = result.scalar_one_or_none()
    if not ms:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Milestone not found")

    # Check if parent program is archived
    prog_result = await db.execute(select(Program.status).where(Program.id == ms.program_id))
    if prog_result.scalar_one_or_none() == "archived":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Archived programs are read-only and cannot be modified.",
        )

    task = Task(
        milestone_id=milestone_id,
        title=data.title,
        description=data.description,
        due_date=data.due_date,
        assigned_to=data.assigned_to,
        priority=data.priority.value,
    )
    db.add(task)
    await db.flush()
    await log_action(
        db,
        user_id=current_user.id,
        user_email=current_user.email,
        action="create",
        entity_type="task",
        entity_id=str(task.id),
        after_state=model_to_dict(task),
        request=request,
    )
    await db.commit()
    await db.refresh(task)
    return task


@router.patch(
    "/tasks/{task_id}",
    response_model=TaskResponse,
    dependencies=[Depends(require_coordinator_or_above)],
)
async def update_task(
    task_id: uuid.UUID, data: TaskUpdate, db: DB, current_user: CurrentUser, request: Request
):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    # Check if parent program is archived (task → milestone → program)
    prog_result = await db.execute(
        select(Program.status)
        .join(Milestone, Milestone.program_id == Program.id)
        .where(Milestone.id == task.milestone_id)
    )
    if prog_result.scalar_one_or_none() == "archived":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Archived programs are read-only and cannot be modified.",
        )

    before = model_to_dict(task)
    update_data = data.model_dump(exclude_unset=True)
    if "status" in update_data and update_data["status"] is not None:
        update_data["status"] = update_data["status"].value
    if "priority" in update_data and update_data["priority"] is not None:
        update_data["priority"] = update_data["priority"].value

    for field, value in update_data.items():
        setattr(task, field, value)

    await log_action(
        db,
        user_id=current_user.id,
        user_email=current_user.email,
        action="update",
        entity_type="task",
        entity_id=str(task_id),
        before_state=before,
        after_state=model_to_dict(task),
        request=request,
    )
    await db.commit()
    await db.refresh(task)
    return task


@router.delete(
    "/tasks/{task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_coordinator_or_above)],
)
async def delete_task(
    task_id: uuid.UUID, db: DB, current_user: CurrentUser, request: Request
) -> Any:
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    # Check if parent program is archived (task → milestone → program)
    prog_result = await db.execute(
        select(Program.status)
        .join(Milestone, Milestone.program_id == Program.id)
        .where(Milestone.id == task.milestone_id)
    )
    if prog_result.scalar_one_or_none() == "archived":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Archived programs are read-only and cannot be modified.",
        )

    before = model_to_dict(task)
    await db.delete(task)
    await log_action(
        db,
        user_id=current_user.id,
        user_email=current_user.email,
        action="delete",
        entity_type="task",
        entity_id=str(task_id),
        before_state=before,
        request=request,
    )
    await db.commit()
