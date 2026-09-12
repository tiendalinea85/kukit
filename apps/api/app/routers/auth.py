from fastapi import APIRouter, Depends, HTTPException, Query

from .. import auth as auth_mod
from ..audit import list_user_audit, write_audit
from ..auth import (
    AuthUser,
    get_current_user,
    require_workspace_member,
    require_workspace_role,
)
from ..db import get_pool
from ..schemas import (
    AuditEventResponse,
    MemberRoleUpdate,
    MembersResponse,
    ProfileResponse,
    ProfileUpdate,
    RoleResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me", response_model=ProfileResponse)
async def me(user: AuthUser = Depends(get_current_user)) -> ProfileResponse:
    """Perfil del usuario actual. Degrada a los claims del JWT si la DB
    no está disponible (offline server no debería ocurrir, pero no bloquea)."""
    profile = None
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT email, full_name, created_at FROM profiles WHERE id = $1",
                user.id,
            )
            if row:
                profile = {
                    "email": row["email"],
                    "full_name": row["full_name"],
                    "created_at": row["created_at"],
                }
    except RuntimeError:
        pass
    return ProfileResponse(id=user.id, email=user.email, profile=profile)


@router.put("/profile", response_model=ProfileUpdate)
async def update_profile(
    body: ProfileUpdate, user: AuthUser = Depends(get_current_user)
) -> ProfileUpdate:
    """Actualiza el perfil local del usuario (la identidad real vive en
    Supabase; aquí se mantiene un espejo para consultas de la API)."""
    full_name = body.full_name.strip()
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO profiles (id, email, full_name, updated_at)
                VALUES ($1, $2, $3, now())
                ON CONFLICT (id) DO UPDATE
                  SET full_name = excluded.full_name,
                      email = excluded.email,
                      updated_at = now()
                """,
                user.id,
                user.email,
                full_name,
            )
            await write_audit(
                conn,
                user.id,
                "profile.update",
                "profile",
                user.id,
                {"full_name": full_name},
            )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail="Base de datos no disponible") from exc
    return ProfileUpdate(full_name=full_name)


@router.get("/audit", response_model=list[AuditEventResponse])
async def audit(
    limit: int = Query(50, ge=1, le=200),
    user: AuthUser = Depends(get_current_user),
) -> list[AuditEventResponse]:
    """Eventos de auditoría del usuario actual (los más recientes primero)."""
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            events = await list_user_audit(conn, user.id, limit)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail="Base de datos no disponible") from exc
    return [AuditEventResponse(**e) for e in events]


@router.get("/roles", response_model=RoleResponse)
async def my_role(
    workspace_id: str = Query(...),
    user: AuthUser = Depends(get_current_user),
) -> RoleResponse:
    """Rol del usuario en un workspace (requiere ser miembro)."""
    role = await auth_mod.load_workspace_role(user.id, workspace_id)
    if role is None:
        raise HTTPException(status_code=403, detail="No eres miembro de este workspace")
    return RoleResponse(workspace_id=workspace_id, role=role)


@router.get("/workspaces/members", response_model=list[MembersResponse])
async def list_members(
    _: None = Depends(require_workspace_member()),
    workspace_id: str = Query(...),
) -> list[MembersResponse]:
    """Miembros de un workspace (visible para cualquier miembro)."""
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT workspace_id, user_id, role, joined_at
                FROM workspace_members
                WHERE workspace_id = $1
                ORDER BY joined_at, user_id
                """,
                workspace_id,
            )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail="Base de datos no disponible") from exc
    return [MembersResponse(**dict(r)) for r in rows]


@router.put("/workspaces/members", response_model=RoleResponse)
async def set_member_role(
    body: MemberRoleUpdate,
    _: None = Depends(require_workspace_role("OWNER", "ADMIN")),
    workspace_id: str = Query(...),
    user_id: str = Query(...),
    user: AuthUser = Depends(get_current_user),
) -> RoleResponse:
    """Cambia el rol de un miembro. Solo OWNER/ADMIN; el rol OWNER solo
    puede gestionarlo el OWNER."""
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            target = await auth_mod.load_workspace_role(user_id, workspace_id)
            if target is None:
                raise HTTPException(status_code=404, detail="El usuario no es miembro")
            caller = await auth_mod.load_workspace_role(user.id, workspace_id)
            if caller is None:
                raise HTTPException(status_code=403, detail="No eres miembro de este workspace")
            if (target == "OWNER" or body.role == "OWNER") and caller != "OWNER":
                raise HTTPException(status_code=403, detail="Solo el OWNER puede gestionar el rol OWNER")
            await conn.execute(
                "UPDATE workspace_members SET role = $1 WHERE workspace_id = $2 AND user_id = $3",
                body.role,
                workspace_id,
                user_id,
            )
            await write_audit(
                conn,
                user.id,
                "workspace.member.role",
                "workspace_member",
                f"{workspace_id}:{user_id}",
                {"role": body.role},
            )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail="Base de datos no disponible") from exc
    return RoleResponse(workspace_id=workspace_id, role=body.role)


@router.delete("/workspaces/members", status_code=204)
async def remove_member(
    _: None = Depends(require_workspace_role("OWNER", "ADMIN")),
    workspace_id: str = Query(...),
    user_id: str = Query(...),
    user: AuthUser = Depends(get_current_user),
) -> None:
    """Remueve a un miembro. El OWNER solo puede ser removido por otro OWNER."""
    try:
        target = await auth_mod.load_workspace_role(user_id, workspace_id)
        if target is None:
            return
        caller = await auth_mod.load_workspace_role(user.id, workspace_id)
        if caller is None:
            raise HTTPException(status_code=403, detail="No eres miembro de este workspace")
        if target == "OWNER" and caller != "OWNER":
            raise HTTPException(status_code=403, detail="Solo el OWNER puede remover a otro OWNER")
        pool = await get_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                "DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2",
                workspace_id,
                user_id,
            )
            await write_audit(
                conn,
                user.id,
                "workspace.member.remove",
                "workspace_member",
                f"{workspace_id}:{user_id}",
                {},
            )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail="Base de datos no disponible") from exc
