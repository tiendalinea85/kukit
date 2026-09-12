from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from ..auth import AuthUser, get_current_user
from ..audit import write_audit
from ..db import get_pool

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


class WorkspaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    type: str = Field(pattern="^(NEGOCIO|BUSINESS)$")
    parent_id: Optional[str] = None
    model_key: Optional[str] = None
    description: str = ""
    modules: list[str] = []


class WorkspaceUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    description: Optional[str] = None
    status: Optional[str] = Field(default=None, pattern="^(active|archived)$")


class WorkspaceResponse(BaseModel):
    id: str
    name: str
    type: str
    parent_id: Optional[str] = None
    model_key: Optional[str] = None
    description: str = ""
    role: str = "OWNER"
    status: str = "active"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    modules: list[dict] = []


@router.get("", response_model=list[WorkspaceResponse])
async def list_workspaces(
    user: AuthUser = Depends(get_current_user),
) -> list[WorkspaceResponse]:
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT id, name, type, parent_id, model_key, description,
                          role, status, created_at, updated_at
                   FROM workspaces WHERE user_id = $1 AND deleted = false
                   ORDER BY created_at""",
                user.id,
            )
            result = []
            for row in rows:
                modules = await conn.fetch(
                    "SELECT module_key, status FROM workspace_modules WHERE workspace_id = $1",
                    row["id"],
                )
                result.append(
                    WorkspaceResponse(
                        **{k: v for k, v in dict(row).items() if k in WorkspaceResponse.model_fields},
                        modules=[dict(m) for m in modules],
                    )
                )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail="Base de datos no disponible") from exc
    return result


@router.post("", response_model=WorkspaceResponse, status_code=201)
async def create_workspace(
    body: WorkspaceCreate,
    user: AuthUser = Depends(get_current_user),
) -> WorkspaceResponse:
    import uuid

    ws_id = str(uuid.uuid4())
    now = datetime.now().astimezone()
    ws_type = body.type
    parent_id = body.parent_id

    if ws_type == "BUSINESS" and not parent_id:
        raise HTTPException(status_code=422, detail="BUSINESS requiere parent_id")

    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO workspaces
                   (id, user_id, name, type, parent_id, model_key, description,
                    role, status, created_at, updated_at, deleted)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,'OWNER','active',$8,$9,false)""",
                ws_id, user.id, body.name.strip(), ws_type, parent_id,
                body.model_key, body.description, now, now,
            )
            for module_key in body.modules:
                await conn.execute(
                    """INSERT INTO workspace_modules (workspace_id, module_key, status, created_at)
                       VALUES ($1, $2, 'active', $3)""",
                    ws_id, module_key, now,
                )
            await write_audit(
                conn, user.id, "workspace.create", "workspace", ws_id,
                {"name": body.name.strip(), "type": ws_type, "modules": body.modules},
            )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail="Base de datos no disponible") from exc

    return WorkspaceResponse(
        id=ws_id, name=body.name.strip(), type=ws_type, parent_id=parent_id,
        model_key=body.model_key, description=body.description,
        role="OWNER", status="active", created_at=now, updated_at=now,
        modules=[{"module_key": m, "status": "active"} for m in body.modules],
    )


@router.put("/{workspace_id}", response_model=WorkspaceResponse)
async def update_workspace(
    workspace_id: str,
    body: WorkspaceUpdate,
    user: AuthUser = Depends(get_current_user),
) -> WorkspaceResponse:
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            existing = await conn.fetchrow(
                "SELECT * FROM workspaces WHERE id = $1 AND user_id = $2 AND deleted = false",
                workspace_id, user.id,
            )
            if not existing:
                raise HTTPException(status_code=404, detail="Workspace no encontrado")

            updates = []
            params: list = []
            idx = 1
            if body.name is not None:
                updates.append(f"name = ${idx}")
                params.append(body.name.strip())
                idx += 1
            if body.description is not None:
                updates.append(f"description = ${idx}")
                params.append(body.description)
                idx += 1
            if body.status is not None:
                updates.append(f"status = ${idx}")
                params.append(body.status)
                idx += 1

            if updates:
                params.extend([workspace_id, user.id])
                await conn.execute(
                    f"UPDATE workspaces SET {', '.join(updates)} WHERE id = ${idx} AND user_id = ${idx+1}",
                    *params,
                )
                await write_audit(
                    conn, user.id, "workspace.update", "workspace", workspace_id,
                    {k: v for k, v in body.model_dump().items() if v is not None},
                )

            row = await conn.fetchrow(
                "SELECT * FROM workspaces WHERE id = $1", workspace_id
            )
            modules = await conn.fetch(
                "SELECT module_key, status FROM workspace_modules WHERE workspace_id = $1",
                workspace_id,
            )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail="Base de datos no disponible") from exc

    return WorkspaceResponse(
        id=row["id"], name=row["name"], type=row["type"],
        parent_id=row["parent_id"], model_key=row["model_key"],
        description=row["description"], role=row["role"], status=row["status"],
        created_at=row["created_at"], updated_at=row["updated_at"],
        modules=[dict(m) for m in modules],
    )


@router.delete("/{workspace_id}", status_code=204)
async def archive_workspace(
    workspace_id: str,
    user: AuthUser = Depends(get_current_user),
) -> None:
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            existing = await conn.fetchrow(
                "SELECT * FROM workspaces WHERE id = $1 AND user_id = $2 AND deleted = false",
                workspace_id, user.id,
            )
            if not existing:
                raise HTTPException(status_code=404, detail="Workspace no encontrado")
            if existing["type"] in ("PERSONAL", "TRABAJO", "ESTUDIO"):
                raise HTTPException(status_code=403, detail="No se puede archivar un espacio principal")

            await conn.execute(
                "UPDATE workspaces SET status = 'archived', updated_at = now() WHERE id = $1",
                workspace_id,
            )
            await write_audit(
                conn, user.id, "workspace.archive", "workspace", workspace_id, {},
            )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail="Base de datos no disponible") from exc
