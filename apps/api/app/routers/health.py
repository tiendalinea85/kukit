from fastapi import APIRouter, Depends

from ..auth import get_current_user
from ..db import get_pool

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "catoledger-api"}


@router.get("/health/ready")
async def readiness() -> dict:
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        return {"status": "ready", "database": "ok"}
    except Exception as exc:
        return {"status": "error", "database": str(exc)}
