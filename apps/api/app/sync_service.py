import json

from datetime import datetime, timezone



import asyncpg



TABLES: dict[str, str] = {

    "category": "categories",

    "custom_icon": "custom_icons",

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



# Tablas sin columna user_id: solo llegan embebidas dentro de su padre.

NO_USER_TABLES: frozenset[str] = frozenset({"workspace_modules"})



CHILD_REF: dict[str, dict[str, str]] = {

    "purchase": {"table": "purchase_items", "fk": "purchase_id"},

    "sale": {"table": "sale_items", "fk": "sale_id"},

    "expense": {"table": "expense_details", "fk": "expense_id"},

    "workspace": {"table": "workspace_modules", "fk": "workspace_id"},

}



PARENT_TYPES = {"purchase", "sale", "expense", "workspace"}



_CHILD_TABLES = {"purchase_items", "sale_items", "expense_details", "workspace_modules"}



VALID_ROLES = frozenset({"OWNER", "ADMIN", "USER", "READ_ONLY"})



# ============================================================

# Mapeo de columnas MÓVIL -> API por tabla.

# El payload del cliente llega con las claves del SQLite de la app móvil;

# estas claves NUNCA se interpolan en SQL ni se escriben tal cual. El dict

# traduce cada clave móvil a la columna real de la API (los montos del móvil

# son enteros en centavos: *_cents), y su inversa devuelve el pull al mismo

# vocabulario para que el móvil lo escriba sin conocer el esquema Postgres.

# ============================================================



PUSH_MAP: dict[str, dict[str, str]] = {

    "categories": {

        "id": "id", "name": "name", "color": "color", "icon": "icon",

        "deleted": "deleted", "created_at": "created_at", "updated_at": "updated_at",

        "sync_status": "sync_status", "workspace_id": "workspace_id",

    },

    "custom_icons": {

        "id": "id", "name": "name", "data_url": "data_url", "deleted": "deleted",

        "created_at": "created_at", "updated_at": "updated_at",

        "sync_status": "sync_status", "workspace_id": "workspace_id",

    },

    "products": {

        "id": "id", "code": "code", "name": "name", "description": "description",

        "sku": "sku", "category_id": "category_id", "unit": "unit",

        "cost_price": "purchase_price_cents", "sale_price": "price_cents",

        "tax_rate": "tax_rate", "stock": "stock", "min_stock": "min_stock",

        "active": "active", "deleted": "deleted", "created_at": "created_at",

        "updated_at": "updated_at", "sync_status": "sync_status",

        "workspace_id": "workspace_id",

    },

    "purchases": {

        "id": "id", "code": "code", "supplier": "supplier", "invoice": "invoice",

        "date": "date", "time": "time", "status": "status",

        "payment_method": "payment_method", "total_amount": "total_cents",

        "items_count": "items_count", "notes": "notes", "deleted": "deleted",

        "created_at": "created_at", "updated_at": "updated_at",

        "sync_status": "sync_status", "workspace_id": "workspace_id",

    },

    "purchase_items": {

        "id": "id", "purchase_id": "purchase_id", "product_id": "product_id",

        "product_name": "product_name", "quantity": "quantity",

        "unit_price": "unit_price_cents", "subtotal": "total_cents",

    },

    "expenses": {

        "id": "id", "code": "code", "name": "name", "description": "description",

        "amount": "amount_cents", "total_amount": "total_amount_cents",

        "items_count": "items_count", "has_details": "has_details",

        "category_id": "category_id", "type_id": "type_id",

        "payment_method": "payment_method", "status": "status", "date": "date",

        "time": "time", "notes": "notes", "voided_at": "voided_at",

        "receipt_url": "receipt_url", "receipt_thumb_url": "receipt_thumb_url",

        "deleted": "deleted", "created_at": "created_at", "updated_at": "updated_at",

        "sync_status": "sync_status", "workspace_id": "workspace_id",

    },

    "expense_details": {

        "id": "id", "expense_id": "expense_id", "product_name": "product_name",

        "quantity": "quantity", "unit_price": "unit_price_cents",

        "subtotal": "subtotal_cents",

    },

    "expense_types": {

        "id": "id", "name": "name", "created_at": "created_at",

        "updated_at": "updated_at", "sync_status": "sync_status",

        "workspace_id": "workspace_id",

    },

    "investments": {

        "id": "id", "code": "code", "asset_name": "asset_name",

        "asset_type": "asset_type", "amount": "amount_cents",

        "current_value": "current_value_cents", "return_rate": "return_rate",

        "category": "category", "supplier": "supplier",

        "payment_method": "payment_method", "status": "status",

        "voided_at": "voided_at", "date": "date", "notes": "notes",

        "deleted": "deleted", "created_at": "created_at", "updated_at": "updated_at",

        "sync_status": "sync_status", "workspace_id": "workspace_id",

    },

    "stock_movements": {

        "id": "id", "product_id": "product_id", "movement_type": "movement_type",

        "quantity": "quantity", "reference_type": "reference_type",

        "reference_id": "reference_id", "date": "date", "notes": "notes",

        "created_at": "created_at", "sync_status": "sync_status",

        "workspace_id": "workspace_id",

    },

    "clients": {

        "id": "id", "code": "code", "name": "name", "phone": "phone",

        "email": "email", "address": "address", "notes": "notes",

        "deleted": "deleted", "created_at": "created_at", "updated_at": "updated_at",

        "sync_status": "sync_status", "workspace_id": "workspace_id",

    },

    "sales": {

        "id": "id", "code": "code", "client_id": "client_id", "date": "date",

        "time": "time", "status": "status", "subtotal": "subtotal_cents",

        "discount": "discount_cents", "tax": "tax_cents",

        "total_amount": "total_cents", "items_count": "items_count",

        "payment_method": "payment_method", "notes": "notes",

        "deleted": "deleted", "created_at": "created_at", "updated_at": "updated_at",

        "sync_status": "sync_status", "workspace_id": "workspace_id",

    },

    "sale_items": {

        "id": "id", "sale_id": "sale_id", "product_id": "product_id",

        "product_name": "product_name", "quantity": "quantity",

        "unit_price": "unit_price_cents", "discount": "discount_cents",

        "subtotal": "total_cents",

    },

    "workspaces": {

        "id": "id", "name": "name", "type": "type", "parent_id": "parent_id",

        "model_key": "model_key", "description": "description", "role": "role",

        "status": "status", "deleted": "deleted", "created_at": "created_at",

        "updated_at": "updated_at",

    },

    "workspace_modules": {

        "workspace_id": "workspace_id", "module_key": "module_key",

        "status": "status", "created_at": "created_at",

    },

}



# Inversa: columna API -> clave móvil (para el payload de pull).

# Las columnas de la API sin equivalente móvil (brand, paid_date, debt_cents…)

# se omiten a propósito: el SQLite del móvil no tiene esas columnas.

PULL_MAP: dict[str, dict[str, str]] = {

    table: {api: mobile for mobile, api in mapping.items()}

    for table, mapping in PUSH_MAP.items()

}



# Columnas API NOT NULL que el móvil no envía con su nombre exacto:

# (columna_api, (clave_movil_origen, valor_por_defecto))

COLUMN_DEFAULTS: dict[str, dict[str, tuple[str | None, object]]] = {

    "purchase_items": {"name": ("product_name", "")},

    "sale_items": {"name": ("product_name", "")},

    "expense_details": {"description": ("product_name", "")},

    "expenses": {"description": ("name", "Sin descripción")},

    "investments": {"name": ("asset_name", "")},

}



# Fechas que en el móvil viajan como "YYYY-MM-DD" y deben subir como timestamptz.

DATE_FIELDS = {"date"}



# Timestamps que deben coercionarse a datetime (timestamptz de Postgres).

TS_FIELDS = {"created_at", "updated_at", "voided_at"}



# Columnas cuyo valor cambia de representación entre móvil y API.

BOOL_AS_INT: dict[str, set[str]] = {"workspaces": {"deleted"}}

# Estados legacy del SQLite del móvil (v7 y anteriores) renombrados al
# vocabulario canónico (pagado/pendiente/anulado) que ya usa Supabase (00004).
EXPENSE_STATUS_LEGACY: dict[str, str] = {"activo": "pagado", "cancelado": "anulado"}

# Vocabulario que aceptan los clientes (schema z) y el CHECK v8 del SQLite.
EXPENSE_STATUS_CANONICAL: frozenset[str] = frozenset({"pagado", "pendiente", "anulado"})





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

    for key in DATE_FIELDS:

        value = payload.get(key)

        if isinstance(value, str):

            try:

                parsed = datetime.fromisoformat(value)

                # "YYYY-MM-DD" -> medianoche UTC; un ISO completo pasa tal cual.

                if parsed.tzinfo is None:

                    parsed = parsed.replace(tzinfo=timezone.utc)

                payload[key] = parsed

            except ValueError:

                pass

    return payload





def _map_fields(mapping: dict[str, str], source: dict) -> dict:

    """Traduce un dict móvil -> API (o API -> móvil) según un mapeo de claves."""

    return {

        target: source[key]

        for key, target in mapping.items()

        if key in source

    }





def _apply_defaults(table: str, mapped: dict, source: dict) -> None:

    for api_col, (src_key, fallback) in COLUMN_DEFAULTS.get(table, {}).items():

        if api_col not in mapped:

            mapped[api_col] = source.get(src_key, fallback) if src_key else fallback

def _normalize_legacy_status(table: str, mapped: dict[str, object]) -> None:
    """Renombra estados legacy del móvil (activo/cancelado) al vocabulario canónico."""
    if (
        table == "expenses"
        and "status" in mapped
        and mapped["status"] in EXPENSE_STATUS_LEGACY
    ):
        mapped["status"] = EXPENSE_STATUS_LEGACY[mapped["status"]]



def _canonicalize_expense_status(
    table: str,
    mapped: dict[str, object],
    operation: str,
) -> bool:
    """Garantiza que expenses.status use el vocabulario canónico.

    Devuelve False si el estado no se admite (fuera de registro) y la operación
    debe rechazarse: un estado desconocido persistiría y, al volver por el pull,
    rompería el CHECK v8 del SQLite (error permanente que bloquea la fila).
    """
    if table != "expenses":
        return True

    _normalize_legacy_status(table, mapped)

    if "status" not in mapped:
        # Un INSERT sin status caería en el DEFAULT legacy 'activo' de la tabla.
        # Un UPDATE parcial no lo toca: no debe poder revivir un anulado.
        if operation == "INSERT":
            mapped["status"] = "pagado"
        return True

    return mapped["status"] in EXPENSE_STATUS_CANONICAL






def _mobile_row(table: str, api_row: dict) -> dict:

    """Convierte una fila de la API al vocabulario del payload del móvil."""

    mapped = _map_fields(PULL_MAP[table], api_row)

    for col in BOOL_AS_INT.get(table, set()):

        if col in mapped:

            mapped[col] = 1 if mapped[col] else 0

    # Nunca devolver estados legacy al móvil: el CHECK v8 rechaza la fila.
    _normalize_legacy_status(table, mapped)

    return mapped





async def _can_access_workspace(

    conn: asyncpg.Connection, user_id: str, workspace_id: str

) -> bool:

    """El usuario es miembro del workspace o lo creó (es su dueño)."""

    member = await conn.fetchval(

        "SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2",

        workspace_id,

        user_id,

    )

    if member:

        return True

    owner = await conn.fetchval(

        "SELECT 1 FROM workspaces WHERE id = $1 AND user_id = $2 AND deleted = false",

        workspace_id,

        user_id,

    )

    return bool(owner)





async def _register_workspace_owner(

    conn: asyncpg.Connection, user_id: str, workspace_id: str, role: str

) -> None:

    """Al crear/actualizar un workspace vía sync se registra su OWNER como

    miembro: sin esto la validación de membresía del resto de entidades falla

    siempre y el modelo de permisos queda vacío."""

    safe_role = role if role in VALID_ROLES else "OWNER"

    await conn.execute(

        """

        INSERT INTO workspace_members (workspace_id, user_id, role)

        VALUES ($1, $2, $3)

        ON CONFLICT (workspace_id, user_id) DO UPDATE

          SET role = workspace_members.role

        """,

        workspace_id,

        user_id,

        safe_role,

    )





async def apply_change(

    conn: asyncpg.Connection,

    user_id: str,

    change: dict,

    batch_workspaces: set[str] | None = None,

) -> bool:

    """Aplica un cambio del outbox. Devuelve True si el cambio se aplicó.



    Aislamiento multi-tenant garantizado en SQL:

      - DELETE filtra por user_id (y los hijos embebidos también).

      - El upsert solo sobrescribe si la fila ya pertenece al usuario

        (ON CONFLICT ... DO UPDATE ... WHERE {tabla}.user_id = excluded.user_id).

      - workspace_id se valida contra membresía/propiedad y se fuerza al

        valor autorizado (nunca se confía en el payload).

    """

    entity_type = change["entity_type"]

    entity_id = change["entity_id"]

    operation = change["operation"]

    table = TABLES.get(entity_type)

    if table is None:

        return False



    if operation == "DELETE":

        child = CHILD_REF.get(entity_type)

        if child:

            child_table = child["table"]

            child_fk = child["fk"]

            if table in NO_USER_TABLES:

                owned = await conn.fetchval(

                    f"SELECT 1 FROM {table} WHERE id = $1 AND user_id = $2",

                    entity_id,

                    user_id,

                )

                if not owned:

                    return False

                await conn.execute(

                    f"DELETE FROM {child_table} WHERE {child_fk} = $1", entity_id

                )

            elif child_table in NO_USER_TABLES:

                owned = await conn.fetchval(

                    f"SELECT 1 FROM {table} WHERE id = $1 AND user_id = $2",

                    entity_id,

                    user_id,

                )

                if not owned:

                    return False

                await conn.execute(

                    f"DELETE FROM {child_table} WHERE {child_fk} = $1", entity_id

                )

            else:

                await conn.execute(

                    f"DELETE FROM {child_table} WHERE {child_fk} = $1 AND user_id = $2",

                    entity_id,

                    user_id,

                )

        await conn.execute(

            f"DELETE FROM {table} WHERE id = $1 AND user_id = $2", entity_id, user_id

        )

        return True



    if table in NO_USER_TABLES:

        # Las tablas sin user_id solo llegan embebidas en su padre.

        return False



    payload = _coerce_timestamps(dict(change.get("payload") or {}))

    items = payload.pop("items", None)

    mapped = _map_fields(PUSH_MAP[table], payload)

    _apply_defaults(table, mapped, payload)



    # Validación de workspace: se fuerza al valor autorizado.

    raw_workspace_id = payload.get("workspace_id") or mapped.get("workspace_id")

    if raw_workspace_id is not None:

        allowed = batch_workspaces and raw_workspace_id in batch_workspaces

        if not allowed and not await _can_access_workspace(

            conn, user_id, str(raw_workspace_id)

        ):

            return False

        mapped["workspace_id"] = raw_workspace_id



    # workspaces.deleted: el móvil manda INT 0/1, la API lo guarda como boolean.

    for col in BOOL_AS_INT.get(table, set()):

        if col in mapped:

            mapped[col] = bool(mapped[col])


    # expenses.status: normaliza legacy (móvil v7 y anteriores) y rechaza un
    # estado fuera de registro antes de validar workspace y persistir.
    if not _canonicalize_expense_status(table, mapped, operation):

        return False



    if entity_type in PARENT_TYPES and items:

        child = CHILD_REF[entity_type]

        child_table = child["table"]

        child_fk = child["fk"]

        await conn.execute(

            f"DELETE FROM {child_table} WHERE {child_fk} = $1 AND user_id = $2",

            entity_id,

            user_id,

        )

        for item in items:

            item_source = _coerce_timestamps(dict(item))

            clean = _map_fields(PUSH_MAP[child_table], item_source)

            _apply_defaults(child_table, clean, item_source)

            if child_table not in NO_USER_TABLES:

                clean["user_id"] = user_id

            cols = list(clean.keys())

            if not cols:

                continue

            placeholders = ", ".join(f"${i + 1}" for i in range(len(cols)))

            await conn.execute(

                f"INSERT INTO {child_table} ({', '.join(cols)}) VALUES ({placeholders})",

                *[clean[c] for c in cols],

            )



    cols = [c for c in mapped.keys() if c not in ("id", "user_id")]

    mapped_id = mapped.get("id") or entity_id

    if not cols and not mapped_id:

        return False

    insert_cols = cols + ["id", "user_id"]

    insert_vals = [mapped.get(c) for c in cols] + [mapped_id, user_id]

    placeholders = ", ".join(f"${i + 1}" for i in range(len(insert_cols)))

    update_sets = ", ".join(

        f"{c} = excluded.{c}" for c in cols if c not in ("user_id", "workspace_id")

    )

    if not update_sets:

        update_sets = "updated_at = excluded.updated_at"

    await conn.execute(

        f"""

        INSERT INTO {table} ({', '.join(insert_cols)})

        VALUES ({placeholders})

        ON CONFLICT (id) DO UPDATE SET {update_sets}

          WHERE {table}.user_id = excluded.user_id

        """,

        *insert_vals,

    )



    if entity_type == "workspace":

        await _register_workspace_owner(conn, user_id, entity_id, str(mapped.get("role") or "OWNER"))



    return True





async def apply_outbox(

    conn: asyncpg.Connection, user_id: str, outbox: list[dict]

) -> list[int]:

    applied: list[int] = []

    batch_workspaces = {

        entry["entity_id"]

        for entry in outbox

        if entry.get("entity_type") == "workspace" and entry.get("operation") != "DELETE"

    }

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

        if await apply_change(conn, user_id, change, batch_workspaces):

            applied.append(entry["id"])

    return applied





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

                rows = await conn.fetch(

                    f"SELECT * FROM {table} WHERE user_id = $1"

                )

        else:

            rows = await conn.fetch(f"SELECT * FROM {table} WHERE user_id = $1")



        for row in rows:

            payload = _mobile_row(table, dict(row))

            if entity_type in PARENT_TYPES:

                child = CHILD_REF[entity_type]

                items = await conn.fetch(

                    f"SELECT * FROM {child['table']} WHERE {child['fk']} = $1 ORDER BY id",

                    payload["id"],

                )

                payload["items"] = [_mobile_row(child["table"], dict(i)) for i in items]

            changes.append(

                {

                    "entity_type": entity_type,

                    "entity_id": payload["id"],

                    "operation": "INSERT",

                    "payload": payload,

                }

            )



    return changes, server_time

