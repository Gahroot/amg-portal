import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select

from app.api.deps import DB, CurrentUser, require_internal, require_rm_or_above
from app.models.client import Client
from app.models.enums import UserRole
from app.schemas.client import ClientCreate, ClientListResponse, ClientResponse, ClientUpdate

router = APIRouter()


@router.post(
    "/",
    response_model=ClientResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_rm_or_above)],
)
async def create_client(data: ClientCreate, db: DB):
    client = Client(
        name=data.name,
        client_type=data.client_type.value,
        rm_id=data.rm_id,
        notes=data.notes,
    )
    db.add(client)
    await db.commit()
    await db.refresh(client)
    return client


@router.get("/", response_model=ClientListResponse)
async def list_clients(
    db: DB,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    _: None = Depends(require_internal),
):
    query = select(Client)
    count_query = select(func.count()).select_from(Client)

    if current_user.role == UserRole.relationship_manager.value:
        query = query.where(Client.rm_id == current_user.id)
        count_query = count_query.where(Client.rm_id == current_user.id)

    total = (await db.execute(count_query)).scalar_one()
    result = await db.execute(
        query.order_by(Client.created_at.desc()).offset(skip).limit(limit)
    )
    clients = result.scalars().all()
    return ClientListResponse(clients=clients, total=total)


@router.get(
    "/{client_id}",
    response_model=ClientResponse,
    dependencies=[Depends(require_internal)],
)
async def get_client(client_id: uuid.UUID, db: DB):
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    return client


@router.patch(
    "/{client_id}",
    response_model=ClientResponse,
    dependencies=[Depends(require_rm_or_above)],
)
async def update_client(client_id: uuid.UUID, data: ClientUpdate, db: DB):
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")

    update_data = data.model_dump(exclude_unset=True)
    if "client_type" in update_data and update_data["client_type"] is not None:
        update_data["client_type"] = update_data["client_type"].value

    for field, value in update_data.items():
        setattr(client, field, value)

    await db.commit()
    await db.refresh(client)
    return client
