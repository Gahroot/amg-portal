import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundException
from app.models.enums import OpportunityStage
from app.models.opportunity import Opportunity
from app.schemas.opportunity import (
    OpportunityCreate,
    OpportunityReorderRequest,
    OpportunityUpdate,
    PipelineSummary,
)
from app.services.crud_base import CRUDBase


class OpportunityService(CRUDBase[Opportunity, OpportunityCreate, OpportunityUpdate]):
    def __init__(self) -> None:
        super().__init__(Opportunity)

    async def create_for_owner(
        self,
        db: AsyncSession,
        *,
        data: OpportunityCreate,
        default_owner_id: uuid.UUID,
    ) -> Opportunity:
        payload: dict[str, Any] = data.model_dump(exclude_unset=True)
        if not payload.get("owner_id"):
            payload["owner_id"] = default_owner_id

        stage_value = payload.get("stage", OpportunityStage.qualifying.value)
        if isinstance(stage_value, OpportunityStage):
            stage_value = stage_value.value
        max_pos = (
            await db.execute(
                select(func.coalesce(func.max(Opportunity.position), -1)).where(
                    Opportunity.stage == stage_value
                )
            )
        ).scalar_one()
        payload["position"] = int(max_pos) + 1

        db_obj = Opportunity(**payload)
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def update_with_stage_side_effects(
        self,
        db: AsyncSession,
        *,
        db_obj: Opportunity,
        obj_in: OpportunityUpdate,
    ) -> Opportunity:
        data = obj_in.model_dump(exclude_unset=True)
        new_stage = data.get("stage")
        if new_stage is not None and new_stage != db_obj.stage:
            if new_stage == OpportunityStage.won:
                data["won_at"] = datetime.now(UTC)
                data["probability"] = 100
            elif new_stage == OpportunityStage.lost:
                data["lost_at"] = datetime.now(UTC)
                data["probability"] = 0
        return await self.update(db, db_obj=db_obj, obj_in=data)

    async def reorder(
        self,
        db: AsyncSession,
        *,
        opportunity_id: uuid.UUID,
        request: OpportunityReorderRequest,
    ) -> Opportunity:
        """Move an opportunity to a stage and position. Used by kanban drag-and-drop."""
        opp = await self.get(db, opportunity_id)
        if not opp:
            raise NotFoundException("Opportunity not found")

        new_stage_value: str = request.new_stage.value
        stage_changed = opp.stage != new_stage_value

        if request.after_opportunity_id is not None:
            anchor = await self.get(db, request.after_opportunity_id)
            new_position = anchor.position + 1 if anchor and anchor.stage == new_stage_value else 0
        else:
            new_position = 0

        result = await db.execute(
            select(Opportunity)
            .where(Opportunity.stage == new_stage_value)
            .where(Opportunity.id != opp.id)
            .order_by(Opportunity.position)
        )
        dest_items = list(result.scalars().all())
        for idx, item in enumerate(dest_items):
            target = idx if idx < new_position else idx + 1
            if item.position != target:
                item.position = target

        opp.stage = OpportunityStage(new_stage_value)
        opp.position = new_position

        if stage_changed:
            if new_stage_value == OpportunityStage.won.value:
                opp.won_at = datetime.now(UTC)
                opp.probability = 100
            elif new_stage_value == OpportunityStage.lost.value:
                opp.lost_at = datetime.now(UTC)
                opp.probability = 0

        await db.commit()
        await db.refresh(opp)
        return opp

    async def pipeline_summary(
        self, db: AsyncSession, *, owner_id: uuid.UUID | None = None
    ) -> list[PipelineSummary]:
        query = select(
            Opportunity.stage,
            func.count(Opportunity.id),
            func.coalesce(func.sum(Opportunity.value), 0),
            func.coalesce(func.sum(Opportunity.value * Opportunity.probability / 100), 0),
        ).group_by(Opportunity.stage)
        if owner_id is not None:
            query = query.where(Opportunity.owner_id == owner_id)

        result = await db.execute(query)
        rows = {row[0]: row for row in result.all()}
        summaries: list[PipelineSummary] = []
        for stage in OpportunityStage:
            row = rows.get(stage.value)
            if row is None:
                summaries.append(
                    PipelineSummary(
                        stage=stage,
                        count=0,
                        total_value=Decimal("0"),
                        weighted_value=Decimal("0"),
                    )
                )
            else:
                summaries.append(
                    PipelineSummary(
                        stage=stage,
                        count=int(row[1]),
                        total_value=Decimal(row[2]),
                        weighted_value=Decimal(row[3]),
                    )
                )
        return summaries


opportunity_service = OpportunityService()
