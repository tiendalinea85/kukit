from typing import Optional

import asyncpg

ROLE_RANK = {"OWNER": 4, "ADMIN": 3, "USER": 2, "READ_ONLY": 1}

VALID_ROLES = frozenset(ROLE_RANK)


async def get_workspace_role(
    conn: asyncpg.Connection, user_id: str, workspace_id: str
) -> Optional[str]:
    """Rol del usuario en un workspace (None si no es miembro)."""
    row = await conn.fetchrow(
        "SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2",
        workspace_id,
        user_id,
    )
    return row["role"] if row else None


async def list_workspace_members(
    conn: asyncpg.Connection, workspace_id: str
) -> list[dict]:
    rows = await conn.fetch(
        """
        SELECT workspace_id, user_id, role, joined_at
        FROM workspace_members
        WHERE workspace_id = $1
        ORDER BY joined_at, user_id
        """,
        workspace_id,
    )
    return [dict(r) for r in rows]
