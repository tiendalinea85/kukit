from typing import Optional

import asyncpg


async def write_audit(
    conn: asyncpg.Connection,
    user_id: str,
    action: str,
    entity_type: str = "",
    entity_id: str = "",
    metadata: Optional[dict] = None,
) -> None:
    """Registra un evento de auditoría para un usuario."""
    await conn.execute(
        """
        INSERT INTO audit_events (user_id, action, entity_type, entity_id, metadata, created_at)
        VALUES ($1, $2, $3, $4, $5, now())
        """,
        user_id,
        action,
        entity_type,
        entity_id,
        metadata,
    )


async def list_user_audit(
    conn: asyncpg.Connection, user_id: str, limit: int = 50
) -> list[dict]:
    rows = await conn.fetch(
        """
        SELECT id, action, entity_type, entity_id, metadata, created_at
        FROM audit_events
        WHERE user_id = $1
        ORDER BY created_at DESC, id DESC
        LIMIT $2
        """,
        user_id,
        limit,
    )
    return [dict(r) for r in rows]
