import logging
import uuid
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import selectinload

from app.api.deps import (
    DB,
    CurrentUser,
    RLSContext,
    get_rm_client_ids,
    require_coordinator_or_above,
    require_internal,
    require_rm_or_above,
)
from app.core.exceptions import ForbiddenException, NotFoundException, ValidationException
from app.models.client import Client  # noqa: F401
from app.models.enums import ProgramStatus, UserRole
from app.models.milestone import Milestone
from app.models.program import Program
from app.models.task import Task
from app.schemas.program import (
    MilestoneCreate,
    MilestoneDetailResponse,
    MilestoneResponse,
    MilestoneUpdate,
    ProgramCreate,
    ProgramDetailResponse,
    ProgramListResponse,
    ProgramResponse,
    ProgramUpdate,
    TaskCreate,
    TaskResponse,
    TaskUpdate,
)
from app.services.calendar_service import sync_milestone_to_google_calendar
from app.services.crud_base import paginate
from app.utils.rag import compute_rag_status

logger = logging.getLogger(__name__)

router = APIRouter()

from app.api.v1.programs_budgets import router as programs_budgets_router  # noqa: E402

router.include_router(programs_budgets_router)


def build_program_response(program: Program) -> ProgramResponse:
    milestones = program.milestones or []
    base = ProgramResponse.model_validate(program, from_attributes=True)
    return base.model_copy(
        update={
            "client_name": program.client.name if program.client else "",
            "rag_status": compute_rag_status(milestones),
            "milestone_count": len(milestones),
            "completed_milestone_count": sum(1 for m in milestones if m.status == "completed"),
        }
    )


def build_milestone_response(milestone: Milestone) -> MilestoneResponse:
    tasks = milestone.tasks or []
    base = MilestoneResponse.model_validate(milestone, from_attributes=True)
    return base.model_copy(
        update={
            "task_count": len(tasks),
            "completed_task_count": sum(1 for t in tasks if t.status == "done"),
        }
    )


def build_milestone_detail_response(milestone: Milestone) -> MilestoneDetailResponse:
    tasks = milestone.tasks or []
    base = MilestoneDetailResponse.model_validate(milestone, from_attributes=True)
    return base.model_copy(
        update={
            "task_count": len(tasks),
            "completed_task_count": sum(1 for t in tasks if t.status == "done"),
            "tasks": [TaskResponse.model_validate(t, from_attributes=True) for t in tasks],
        }
    )


def build_program_detail_response(program: Program) -> ProgramDetailResponse:
    milestones = program.milestones or []
    base = ProgramDetailResponse.model_validate(program, from_attributes=True)
    return base.model_copy(
        update={
            "client_name": program.client.name if program.client else "",
            "rag_status": compute_rag_status(milestones),
            "milestone_count": len(milestones),
            "completed_milestone_count": sum(1 for m in milestones if m.status == "completed"),
            "milestones": [build_milestone_detail_response(m) for m in milestones],
        }
    )


@router.post(
    "/",
    response_model=ProgramResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_program(
    data: ProgramCreate,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    _: None = Depends(require_rm_or_above),
) -> Any:
    from app.models.enums import BudgetRequestType
    from app.services.program_budget_service import (
        create_budget_approval_for_program,
        notify_approval_chain,
    )

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

    # --- Budget approval check ---
    # If the budget envelope exceeds a configured threshold the program must go
    # through an approval chain before it can be activated.  We set the status
    # to "design" to hold it in a pre-active state; the state-machine guard on
    # the "active" transition enforces this until all approvals are complete.
    approval_request_id: uuid.UUID | None = None
    if data.budget_envelope is not None:
        budget_amount = Decimal(str(data.budget_envelope))
        approval_request = await create_budget_approval_for_program(
            db=db,
            program=program,
            budget_amount=budget_amount,
            request_type=BudgetRequestType.new_expense,
            requested_by=current_user.id,
            current_budget=Decimal("0"),
        )
        if approval_request:
            approval_request_id = approval_request.id
            program.status = ProgramStatus.design
            logger.info(
                "Program %s created with budget %s — approval required (request %s); "
                "status set to 'design'.",
                program.id,
                budget_amount,
                approval_request_id,
            )

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

    # Notify the approval chain now that the transaction is committed.
    if approval_request_id is not None:
        try:
            from app.models.budget_approval import BudgetApprovalRequest

            req_result = await db.execute(
                select(BudgetApprovalRequest).where(BudgetApprovalRequest.id == approval_request_id)
            )
            approval_request = req_result.scalar_one_or_none()
            if approval_request:
                await notify_approval_chain(db, approval_request, program)
        except Exception:
            logger.exception(
                "Failed to send budget-approval chain notifications for program %s",
                program.id,
            )

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
    _rls: RLSContext,
    status_filter: str | None = Query(None, alias="status"),
    client_id: uuid.UUID | None = None,
    search: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    _: None = Depends(require_internal),
) -> Any:
    query = select(Program).options(
        selectinload(Program.client),
        selectinload(Program.milestones).selectinload(Milestone.tasks),
    )

    if status_filter:
        query = query.where(Program.status == status_filter)
    if client_id:
        query = query.where(Program.client_id == client_id)
    if search:
        query = query.where(Program.title.ilike(f"%{search}%"))

    # RMs only see programs belonging to their clients or programs they created.
    if current_user.role == UserRole.relationship_manager:
        rm_client_ids = await get_rm_client_ids(db, current_user.id)
        query = query.where(
            or_(
                Program.client_id.in_(rm_client_ids),
                Program.created_by == current_user.id,
            )
        )

    query = query.order_by(Program.created_at.desc())
    programs, total = await paginate(db, query, skip=skip, limit=limit, unique=True)
    return ProgramListResponse(
        programs=[build_program_response(p) for p in programs],
        total=total,
    )


@router.post(
    "/compare",
    response_model=list[ProgramDetailResponse],
    dependencies=[Depends(require_internal)],
)
async def compare_programs(
    ids: list[uuid.UUID],
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
) -> Any:
    """Return detailed data for 2-4 programs for side-by-side comparison."""
    if len(ids) < 2 or len(ids) > 4:
        raise ValidationException("Please select 2 to 4 programs to compare")

    result = await db.execute(
        select(Program)
        .options(
            selectinload(Program.client),
            selectinload(Program.milestones).selectinload(Milestone.tasks),
        )
        .where(Program.id.in_(ids))
    )
    programs = result.scalars().unique().all()

    if len(programs) != len(ids):
        raise NotFoundException("One or more programs not found")

    # RM scope check
    if current_user.role == UserRole.relationship_manager:
        rm_client_ids = await get_rm_client_ids(db, current_user.id)
        for p in programs:
            if p.client_id not in rm_client_ids and p.created_by != current_user.id:
                raise ForbiddenException("Access denied to one or more programs")

    return [build_program_detail_response(p) for p in programs]


@router.get(
    "/{program_id}",
    response_model=ProgramDetailResponse,
    dependencies=[Depends(require_internal)],
)
async def get_program(
    program_id: uuid.UUID, db: DB, current_user: CurrentUser, _rls: RLSContext
) -> Any:  # noqa: E501
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
        raise NotFoundException("Program not found")
    if current_user.role == UserRole.relationship_manager:
        rm_client_ids = await get_rm_client_ids(db, current_user.id)
        if program.client_id not in rm_client_ids and program.created_by != current_user.id:
            raise ForbiddenException("Access denied: program not in your portfolio")
    return build_program_detail_response(program)


@router.patch(
    "/{program_id}",
    response_model=ProgramResponse,
)
async def update_program(
    program_id: uuid.UUID,
    data: ProgramUpdate,
    db: DB,
    current_user: CurrentUser,
    _rls: RLSContext,
    _: None = Depends(require_rm_or_above),
) -> Any:
    from app.models.enums import BudgetRequestType
    from app.services.program_budget_service import (
        create_budget_approval_for_program,
        has_pending_budget_approval,
        notify_approval_chain,
    )

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
        raise NotFoundException("Program not found")

    update_data = data.model_dump(exclude_unset=True)

    # Capture current budget before any updates are applied.
    old_budget = (
        Decimal(str(program.budget_envelope))
        if program.budget_envelope is not None
        else Decimal("0")
    )

    # Handle status transitions through the state machine
    if "status" in update_data and update_data["status"] is not None:
        new_status = update_data.pop("status")
        # ProgramStatus enum → plain string value
        new_status_str = new_status.value if hasattr(new_status, "value") else str(new_status)
        from app.services.program_state_machine import transition_program

        await transition_program(db, program, new_status_str, current_user)

    # Apply remaining non-status field updates
    for field, value in update_data.items():
        setattr(program, field, value)

    # --- Budget approval check for increases ---
    # When budget_envelope has increased, re-check whether the delta crosses a
    # threshold.  If it does, create a new approval request (unless one is
    # already pending) and hold the program in a non-active state.
    approval_request_id: uuid.UUID | None = None
    new_budget_raw = update_data.get("budget_envelope")
    if new_budget_raw is not None:
        new_budget = Decimal(str(new_budget_raw))
        budget_delta = new_budget - old_budget
        if budget_delta > Decimal("0"):
            already_pending = await has_pending_budget_approval(db, program.id)
            if not already_pending:
                approval_request = await create_budget_approval_for_program(
                    db=db,
                    program=program,
                    budget_amount=budget_delta,
                    request_type=BudgetRequestType.budget_increase,
                    requested_by=current_user.id,
                    current_budget=old_budget,
                )
                if approval_request:
                    approval_request_id = approval_request.id
                    current_program_status = str(program.status)
                    if current_program_status in ("intake", "design"):
                        program.status = ProgramStatus.design
                    elif current_program_status == "active":
                        # Put an active program on hold until the budget increase
                        # is approved — active → on_hold is a valid transition.
                        program.status = ProgramStatus.on_hold
                    logger.info(
                        "Program %s budget increased by %s — approval required (request %s); "
                        "status set to '%s'.",
                        program.id,
                        budget_delta,
                        approval_request_id,
                        program.status,
                    )

    await db.commit()

    result = await db.execute(
        select(Program)
        .options(
            selectinload(Program.client),
            selectinload(Program.milestones).selectinload(Milestone.tasks),
        )
        .where(Program.id == program_id)
    )
    program = result.scalar_one()

    # Notify the approval chain now that the transaction is committed.
    if approval_request_id is not None:
        try:
            from app.models.budget_approval import BudgetApprovalRequest

            req_result = await db.execute(
                select(BudgetApprovalRequest).where(BudgetApprovalRequest.id == approval_request_id)
            )
            approval_request = req_result.scalar_one_or_none()
            if approval_request:
                await notify_approval_chain(db, approval_request, program)
        except Exception:
            logger.exception(
                "Failed to send budget-approval chain notifications for program %s",
                program.id,
            )

    return build_program_response(program)


# --- Milestone endpoints ---


@router.post(
    "/{program_id}/milestones",
    response_model=MilestoneResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_coordinator_or_above)],
)
async def add_milestone(
    program_id: uuid.UUID, data: MilestoneCreate, db: DB, _rls: RLSContext
) -> Any:  # noqa: E501
    program_result = await db.execute(select(Program).where(Program.id == program_id))
    program = program_result.scalar_one_or_none()
    if not program:
        raise NotFoundException("Program not found")

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

    # Sync to Google Calendar — best-effort, does not fail the request
    await sync_milestone_to_google_calendar(
        db=db,
        milestone=milestone,
        program_name=program.title,
        rm_user_id=program.created_by,
    )

    return build_milestone_response(milestone)


@router.patch(
    "/milestones/{milestone_id}",
    response_model=MilestoneResponse,
    dependencies=[Depends(require_coordinator_or_above)],
)
async def update_milestone(
    milestone_id: uuid.UUID, data: MilestoneUpdate, db: DB, _rls: RLSContext
) -> Any:
    result = await db.execute(
        select(Milestone).options(selectinload(Milestone.tasks)).where(Milestone.id == milestone_id)
    )
    milestone = result.scalar_one_or_none()
    if not milestone:
        raise NotFoundException("Milestone not found")

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

    # Sync changes to Google Calendar — best-effort, does not fail the request
    program_result = await db.execute(select(Program).where(Program.id == milestone.program_id))
    program = program_result.scalar_one_or_none()
    if program:
        await sync_milestone_to_google_calendar(
            db=db,
            milestone=milestone,
            program_name=program.title,
            rm_user_id=program.created_by,
        )

    return build_milestone_response(milestone)


@router.delete(
    "/milestones/{milestone_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    dependencies=[Depends(require_rm_or_above)],
)
async def delete_milestone(milestone_id: uuid.UUID, db: DB, _rls: RLSContext) -> None:
    result = await db.execute(select(Milestone).where(Milestone.id == milestone_id))
    milestone = result.scalar_one_or_none()
    if not milestone:
        raise NotFoundException("Milestone not found")

    await db.delete(milestone)
    await db.commit()


# --- Task endpoints ---


@router.post(
    "/milestones/{milestone_id}/tasks",
    response_model=TaskResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_coordinator_or_above)],
)
async def add_task(milestone_id: uuid.UUID, data: TaskCreate, db: DB, _rls: RLSContext) -> Any:
    result = await db.execute(select(Milestone).where(Milestone.id == milestone_id))
    if not result.scalar_one_or_none():
        raise NotFoundException("Milestone not found")

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

    # Reverse cascade: revert a completed milestone when a new task is added
    try:
        from app.services.task_cascade_service import on_task_created

        await on_task_created(db, task.id)
    except Exception:
        logger.exception(
            "Task cascade (on_task_created) failed for task %s.",
            task.id,
        )

    return task


@router.patch(
    "/tasks/{task_id}",
    response_model=TaskResponse,
    dependencies=[Depends(require_coordinator_or_above)],
)
async def update_task(task_id: uuid.UUID, data: TaskUpdate, db: DB, _rls: RLSContext) -> Any:
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise NotFoundException("Task not found")

    update_data = data.model_dump(exclude_unset=True)
    if "status" in update_data and update_data["status"] is not None:
        update_data["status"] = update_data["status"].value
    if "priority" in update_data and update_data["priority"] is not None:
        update_data["priority"] = update_data["priority"].value

    status_changed = "status" in update_data

    for field, value in update_data.items():
        setattr(task, field, value)

    await db.commit()
    await db.refresh(task)

    # Cascade milestone status when a task's status changes
    if status_changed:
        try:
            from app.services.task_cascade_service import on_task_status_change

            await on_task_status_change(db, task_id, task.status)
        except Exception:
            logger.exception(
                "Task cascade failed for task %s — milestone status not updated.",
                task_id,
            )

    return task


@router.delete(
    "/tasks/{task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    dependencies=[Depends(require_coordinator_or_above)],
)
async def delete_task(task_id: uuid.UUID, db: DB, _rls: RLSContext) -> None:
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise NotFoundException("Task not found")

    await db.delete(task)
    await db.commit()
