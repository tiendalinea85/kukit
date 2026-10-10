"""Tests de integracion aislada de apply_change (sync del gasto).

Sin Postgres: un FakeConn con semantica de upsert por user_id en memoria.
Cubre los escenarios del cronograma de compatibilidad de estados legacy:

  - gasto legacy persiste normalizado a canonicos
  - idempotencia al reintentar el mismo cambio (sin duplicados)
  - estado canonico conservado
  - estado desconocido -> rechazado (permanece en la outbox, nada se persiste)
  - INSERT sin status no cae en el DEFAULT legacy 'activo'
  - UPDATE parcial sin status no revive un anulado
  - aislamiento user/workspace (miembro del workspace o dueno)
  - workspace_id/user_id forzados al valor validado (nunca del payload)
  - expense_details quedan vinculadas y se reemplazan como unidad
  - politica LWW: un update obsoleto puede sobrescribir un anulado (documentado)

Nota: los nombres de caso usan espanol, como el resto de strings de dominio.
"""

import asyncio
import re

from app.sync_service import _mobile_row, apply_change

VALID_USER = "u1"
OTHER_USER = "u2"
WORKSPACE = "w1"

ITEM_A = {
    "id": "ed1",
    "expense_id": "e1",
    "product_name": "Aceite",
    "quantity": 1,
    "unit_price": 8000,
    "subtotal": 8000,
}
ITEM_B = {
    "id": "ed2",
    "expense_id": "e1",
    "product_name": "Filtro",
    "quantity": 2,
    "unit_price": 5000,
    "subtotal": 10000,
}

INSERT_RE = re.compile(r"INSERT INTO (\w+)\s*\(([^)]*)\)\s*VALUES")
DELETE_RE = re.compile(r"DELETE FROM (\w+)")
FROM_RE = re.compile(r"FROM (\w+)")


class FakeConn:
    """Minimo sustituto de asyncpg.Connection con upsert por user_id."""

    def __init__(self, workspaces, workspace_members):
        self.tables = {}
        self.workspaces = {w["id"]: w for w in workspaces}
        self.members = {(m["workspace_id"], m["user_id"]): m for m in workspace_members}

    async def fetchval(self, sql, *args):
        if "workspace_members" in sql:
            return 1 if (args[0], args[1]) in self.members else None
        if "workspaces" in sql:
            workspace = self.workspaces.get(args[0])
            return (
                1
                if workspace
                and workspace.get("user_id") == args[1]
                and workspace.get("deleted") is False
                else None
            )
        match = FROM_RE.search(sql)
        row = self.tables.get(match.group(1), {}).get(args[0]) if match else None
        return 1 if row and row.get("user_id") == args[1] else None

    async def execute(self, sql, *args):
        if sql.lstrip().startswith("DELETE"):
            table = DELETE_RE.search(sql).group(1)
            condition = sql[sql.index("WHERE") :]
            pairs = re.findall(r"(\w+) = \$(\d+)", condition)
            store = self.tables.setdefault(table, {})
            for rid in list(store):
                row = store[rid]
                if all(row.get(col) == args[int(idx) - 1] for col, idx in pairs):
                    del store[rid]
            return "DELETE 0"

        match = INSERT_RE.search(sql)
        table = match.group(1)
        cols = [c.strip() for c in match.group(2).split(",")]
        row = dict(zip(cols, args))
        store = self.tables.setdefault(table, {})
        if row.get("id") in store and "ON CONFLICT" in sql:
            existing = store[row["id"]]
            if existing.get("user_id") == args[-1]:
                for col, value in zip(cols, args):
                    if col not in ("id", "user_id", "workspace_id"):
                        existing[col] = value
            return "INSERT 0"
        store[row["id"]] = row
        return "INSERT 0"


def make_conn():
    workspaces = [
        {"id": WORKSPACE, "name": "Personal", "type": "PERSONAL", "user_id": VALID_USER, "deleted": False}
    ]
    members = [{"workspace_id": WORKSPACE, "user_id": VALID_USER, "role": "OWNER"}]
    return FakeConn(workspaces, members)


def expense_change(operation, payload):
    return {
        "entity_type": "expense",
        "entity_id": payload["id"],
        "operation": operation,
        "payload": payload,
    }


def expense_payload(**overrides):
    payload = {
        "id": "e1",
        "code": "G-0001",
        "name": "Gasolina",
        "amount": 12000,
        "category_id": "c1",
        "payment_method": "tarjeta",
        "status": "activo",
        "date": "2026-01-10",
        "time": "12:30",
        "notes": "",
        "voided_at": None,
        "deleted": 0,
        "created_at": "2026-01-10T12:30:00.000Z",
        "updated_at": "2026-01-10T12:30:00.000Z",
        "workspace_id": WORKSPACE,
    }
    payload.update(overrides)
    return payload


def run(coro):
    return asyncio.run(coro)


def apply(conn, operation, payload, user=VALID_USER):
    return run(apply_change(conn, user, expense_change(operation, payload)))


def seed_anulado(conn):
    assert apply(conn, "INSERT", expense_payload(status="anulado")) is True
    return conn.tables["expenses"]["e1"]


def test_legacy_expense_persists_as_canonical():
    conn = make_conn()
    assert apply(conn, "INSERT", expense_payload(status="activo")) is True
    stored = conn.tables["expenses"]["e1"]
    assert stored["status"] == "pagado"
    assert stored["workspace_id"] == WORKSPACE
    assert stored["user_id"] == VALID_USER


def test_repeated_push_is_idempotent():
    conn = make_conn()
    change = expense_change("INSERT", expense_payload(status="activo"))
    assert run(apply_change(conn, VALID_USER, change)) is True
    first = dict(conn.tables["expenses"]["e1"])
    assert run(apply_change(conn, VALID_USER, change)) is True
    assert dict(conn.tables["expenses"]["e1"]) == first
    assert len(conn.tables["expenses"]) == 1


def test_canonical_status_preserved():
    conn = make_conn()
    for status in ("pagado", "pendiente", "anulado"):
        payload = expense_payload(id="e-" + status, status=status)
        assert apply(conn, "INSERT", payload) is True
        assert conn.tables["expenses"]["e-" + status]["status"] == status


def test_unknown_status_rejected_and_nothing_persisted():
    conn = make_conn()
    payload = expense_payload(status="en_proceso", items=[ITEM_A])
    assert apply(conn, "INSERT", payload) is False
    assert "expenses" not in conn.tables or "e1" not in conn.tables["expenses"]
    assert "expense_details" not in conn.tables or not conn.tables["expense_details"]


def test_insert_without_status_uses_canonical_default():
    conn = make_conn()
    payload = expense_payload()
    del payload["status"]
    assert apply(conn, "INSERT", payload) is True
    assert conn.tables["expenses"]["e1"]["status"] == "pagado"


def test_partial_update_without_status_preserves_anulado():
    conn = make_conn()
    seed_anulado(conn)
    payload = expense_payload(status="anulado", notes="cambiado")
    del payload["status"]
    assert apply(conn, "UPDATE", payload) is True
    assert conn.tables["expenses"]["e1"]["status"] == "anulado"


def test_foreign_user_rejected_and_nothing_persisted():
    conn = make_conn()
    assert apply(conn, "INSERT", expense_payload(), user=OTHER_USER) is False
    assert "e1" not in conn.tables.get("expenses", {})


def test_expense_details_are_linked_and_replaced_as_unit():
    conn = make_conn()
    assert apply(conn, "INSERT", expense_payload(items=[ITEM_A])) is True
    stored_a = conn.tables["expense_details"]["ed1"]
    assert stored_a["expense_id"] == "e1"
    assert stored_a["user_id"] == VALID_USER

    assert apply(conn, "UPDATE", expense_payload(items=[ITEM_B])) is True
    assert "ed1" not in conn.tables["expense_details"]
    stored_b = conn.tables["expense_details"]["ed2"]
    assert stored_b["expense_id"] == "e1"
    assert stored_b["user_id"] == VALID_USER


def test_update_without_items_preserves_details():
    conn = make_conn()
    assert apply(conn, "INSERT", expense_payload(items=[ITEM_A])) is True
    payload = expense_payload(status="pagado", notes="sin items")
    assert apply(conn, "UPDATE", payload) is True
    assert conn.tables["expense_details"]["ed1"]["expense_id"] == "e1"


def test_stale_update_can_resurrect_anulado_lww_documented():
    conn = make_conn()
    seed_anulado(conn)
    assert conn.tables["expenses"]["e1"]["status"] == "anulado"
    # Politica actual: LWW por cliente, sin comparar updated_at. Un update
    # obsoleto (fecha anterior) sobrescribe y revive el anulado.
    payload = expense_payload(
        status="pagado",
        updated_at="2026-01-10T12:00:00.000Z",
    )
    assert apply(conn, "UPDATE", payload) is True
    assert conn.tables["expenses"]["e1"]["status"] == "pagado"


def test_pull_roundtrip_returns_canonical_status():
    conn = make_conn()
    assert apply(conn, "INSERT", expense_payload(status="activo")) is True
    row = _mobile_row("expenses", dict(conn.tables["expenses"]["e1"]))
    assert row["status"] == "pagado"