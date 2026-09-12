import json
from datetime import datetime, timezone

import asyncpg

TABLES: dict[str, str] = {
    "category": "categories",
    "product": "products",
    "purchase": "purchases",
    "purchase_item": "purchase_items",
    "expense": "expenses",
    "expense_detail": "expense_details",
    "expense_type": "expense_types",
    "investment": "investments",
    "stock_movement": "stock_movements",
    "client": "clients",
    "sale": "sales",
    "sale_item": "sale_items",
    "workspace": "workspaces",
    "workspace_module": "workspace_modules",
}

# Lista blanca de columnas por tabla: los nombres de columna del payload del
# cliente NUNCA se interpolan en SQL. Cualquier clave no listada se descarta
# (mitiga inyección SQL por nombres de columna y columnas no previstas).
COLUMNS: dict[str, frozenset[str]] = {
    "categories": frozenset(
        {"id", "name", "color", "icon", "deleted", "created_at", "updated_at",
         "sync_status", "workspace_id"}
    ),
    "products": frozenset(
        {
            "id", "code", "name", "description", "sku", "category_id", "unit",
            "cost_price", "sale_price", "tax_rate", "stock", "min_stock",
            "active", "deleted", "created_at", "updated_at", "sync_status",
            "workspace_id",
        }
    ),
    "purchases": frozenset(
        {"id", "code", "supplier", "date", "time", "status", "total_amount",
         "items_count", "notes", "deleted", "created_at", "updated_at",
         "sync_status", "workspace_id"}
    ),
    "purchase_items": frozenset(
        {"id", "purchase_id", "product_id", "product_name", "quantity",
         "unit_price", "subtotal", "created_at", "updated_at"}
    ),
    "expenses": frozenset(
        {"id", "code", "name", "description", "amount", "total_amount",
         "items_count", "has_details", "category_id", "type_id",
         "payment_method", "status", "date", "time", "notes", "deleted",
         "voided_at", "receipt_url", "receipt_thumb_url",
         "created_at", "updated_at", "sync_status", "workspace_id"}
    ),
    "expense_details": frozenset(
        {"id", "expense_id", "product_name", "quantity", "unit_price",
         "subtotal", "created_at", "updated_at"}
    ),
    "expense_types": frozenset(
        {"id", "name", "created_at", "updated_at", "sync_status",
         "workspace_id"}
    ),
    "investments": frozenset(
        {"id", "code", "asset_name", "asset_type", "amount",
         "current_value", "return_rate", "date", "notes", "deleted",
         "created_at", "updated_at", "sync_status", "workspace_id"}
    ),
    "stock_movements": frozenset(
        {"id", "product_id", "movement_type", "quantity", "reference_type",
         "reference_id", "date", "notes", "created_at", "sync_status",
         "workspace_id"}
    ),
    "clients": frozenset(
        {"id", "code", "name", "phone", "email", "address", "notes",
         "deleted", "created_at", "updated_at", "sync_status",
         "workspace_id"}
    ),
    "sales": frozenset(
        {"id", "code", "client_id", "date", "time", "status", "subtotal",
         "discount", "tax", "total_amount", "items_count", "payment_method",
         "notes", "deleted", "created_at", "updated_at", "sync_status",
         "workspace_id"}
    ),
    "sale_items": frozenset(
        {"id", "sale_id", "product_id", "product_name", "quantity",
         "unit_price", "discount", "subtotal", "created_at", "updated_at"}
    ),
    "workspaces": frozenset(
        {"id", "name", "type", "parent_id", "model_key", "description",
         "role", "status", "created_at", "updated_at", "deleted",
         "sync_status"}
    ),
    "workspace_modules": frozenset(
        {"workspace_id", "module_key", "status", "created_at"}
    ),
}

CHILD_REF: dict[str, dict[str, str]] = {
    "purchase": {"table": "purchase_items", "fk": "purchase_id"},
    "sale": {"table": "sale_items", "fk": "sale_id"},
    "expense": {"table": "expense_details", "fk": "expense_id"},
    "workspace": {"table": "workspace_modules", "fk": "workspace_id"},
}

# Entity types that carry embedded children in the pull payload.
PARENT_TYPES = {"purchase", "sale", "expense", "workspace"}

# Timestamps must be coerced to Python datetime to match Postgres timestamptz.
TS_FIELDS = {"created_at", "updated_at"}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _coerce_timestamps(payload: dict) -> dict:
    for key in TS_FIELDS:
        value = payload.get(key)
        if isinstance(value, str):
            try:
                payload[key] = datetime.fromisoformat(value)
            except ValueError:
                pass
    return payload


async def apply_change(conn: asyncpg.Connection, user_id: str, change: dict) -> None:
    entity_type = change["entity_type"]
    entity_id = change["entity_id"]
    operation = change["operation"]
    table = TABLES.get(entity_type)
    if table is None:
        return

    if operation == "DELETE":
        child = CHILD_REF.get(entity_type)
        if child:
            await conn.execute(
                f"DELETE FROM {child['table']} WHERE {child['fk']} = $1", entity_id
            )
        await conn.execute(f"DELETE FROM {table} WHERE id = $1", entity_id)
        return

    payload = _coerce_timestamps(dict(change.get("payload") or {}))
    items = payload.pop("items", None)
    allowed = COLUMNS[table]
    payload = {k: v for k, v in payload.items() if k in allowed}

    if entity_type in PARENT_TYPES and items:
        child = CHILD_REF[entity_type]
        child_allowed = COLUMNS[child["table"]]
        await conn.execute(
            f"DELETE FROM {child['table']} WHERE {child['fk']} = $1", entity_id
        )
        for item in items:
            clean = {
                k: v
                for k, v in _coerce_timestamps(dict(item)).items()
                if k in child_allowed
            }
            cols = list(clean.keys())
            placeholders = ", ".join(f"${i + 1}" for i in range(len(cols)))
            await conn.execute(
                f"INSERT INTO {child['table']} ({', '.join(cols)}) VALUES ({placeholders})",
                *[clean[c] for c in cols],
            )

    cols = list(payload.keys())
    if not cols:
        return
    insert_cols = cols + ["user_id"]
    insert_vals = [payload[c] for c in cols] + [user_id]
    placeholders = ", ".join(f"${i + 1}" for i in range(len(insert_cols)))
    update_sets = ", ".join(
        f"{c} = excluded.{c}" for c in cols if c not in ("id", "user_id")
    )
    await conn.execute(
        f"""
        INSERT INTO {table} ({', '.join(insert_cols)})
        VALUES ({placeholders})
        ON CONFLICT (id) DO UPDATE SET {update_sets or 'updated_at = excluded.updated_at'}
        """,
        *insert_vals,
    )


async def apply_outbox(
    conn: asyncpg.Connection, user_id: str, outbox: list[dict]
) -> list[int]:
    applied: list[int] = []
    for entry in outbox:
        try:
            payload = json.loads(entry["payload"])
        except (json.JSONDecodeError, TypeError):
            payload = {}
        change = {
            "entity_type": entry["entity_type"],
            "entity_id": entry["entity_id"],
            "operation": entry["operation"],
            "payload": payload,
        }
        await apply_change(conn, user_id, change)
        applied.append(entry["id"])
    return applied


# Tablas hijas que se embeben en el padre durante pull (no se consultan solas).
_CHILD_TABLES = {"purchase_items", "sale_items", "expense_details", "workspace_modules"}


async def pull_changes(
    conn: asyncpg.Connection, user_id: str, cursors: dict[str, str]
) -> tuple[list[dict], str]:
    changes: list[dict] = []
    server_time = now_iso()

    for entity_type, table in TABLES.items():
        if table in _CHILD_TABLES:
            continue  # embedded in parents
        cursor = cursors.get(entity_type)
        if cursor:
            try:
                cursor_dt = datetime.fromisoformat(cursor)
            except ValueError:
                cursor_dt = None
            if cursor_dt is not None:
                rows = await conn.fetch(
                    f"""
                    SELECT * FROM {table}
                    WHERE user_id = $1 AND updated_at >= $2
                    ORDER BY updated_at ASC
                    """,
                    user_id,
                    cursor_dt,
                )
            else:
                rows = await conn.fetch(f"SELECT * FROM {table} WHERE user_id = $1")
        else:
            rows = await conn.fetch(f"SELECT * FROM {table} WHERE user_id = $1")

        for row in rows:
            payload = dict(row)
            payload.pop("user_id", None)
            if entity_type in PARENT_TYPES:
                child = CHILD_REF[entity_type]
                items = await conn.fetch(
                    f"SELECT * FROM {child['table']} WHERE {child['fk']} = $1 ORDER BY id",
                    payload["id"],
                )
                payload["items"] = [dict(i) for i in items]
            changes.append(
                {
                    "entity_type": entity_type,
                    "entity_id": payload["id"],
                    "operation": "INSERT",
                    "payload": payload,
                }
            )

    return changes, server_time
