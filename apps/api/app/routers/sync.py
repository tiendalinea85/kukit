from fastapi import APIRouter, Depends, HTTPException

from ..auth import AuthUser, get_current_user
from ..db import get_pool
from ..schemas import PullRequest, PullResponse, PushRequest, PushResponse
from ..sync_service import apply_outbox, pull_changes

router = APIRouter(prefix="/sync", tags=["sync"])


@router.post("/push", response_model=PushResponse)
async def push(req: PushRequest, user: AuthUser = Depends(get_current_user)) -> PushResponse:
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            applied = await apply_outbox(conn, user.id, [c.model_dump() for c in req.changes])
        return PushResponse(applied_ids=applied)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error aplicando cambios: {exc}") from exc


@router.post("/pull", response_model=PullResponse)
async def pull(req: PullRequest, user: AuthUser = Depends(get_current_user)) -> PullResponse:
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            changes, server_time = await pull_changes(conn, user.id, req.cursors)
        return PullResponse(changes=changes, server_time=server_time)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error sincronizando: {exc}") from exc
