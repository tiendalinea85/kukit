"""Tests for the sync column mapping (mobile <-> API) and prod config guard.

The mapping logic in sync_service is pure (no DB needed); these tests pin the
lossless round-trip of each entity and the cross-tenant safety rules.
"""

import pytest

from app.config import Settings
from app.sync_service import (
    EXPENSE_STATUS_CANONICAL,
    EXPENSE_STATUS_LEGACY,
    PULL_MAP,
    PUSH_MAP,
    _apply_defaults,
    _canonicalize_expense_status,
    _map_fields,
    _mobile_row,
    _normalize_legacy_status,
)

# Payloads tal como los manda la app móvil (vocabulario SQLite, centavos enteros).
MOBILE_PAYLOADS: dict[str, dict] = {
    "expenses": {
        "id": "e1", "code": "G-0001", "name": "Gasolina", "description": "Tanqueo",
        "amount": 12000, "total_amount": 12000, "items_count": 1, "has_details": 0,
        "category_id": "c1", "type_id": None, "payment_method": "tarjeta",
        "status": "pagado", "date": "2026-01-10", "time": "12:30", "notes": "",
        "voided_at": None, "receipt_url": None, "receipt_thumb_url": None,
        "deleted": 0, "created_at": "2026-01-10T12:30:00.000Z",
        "updated_at": "2026-01-10T12:30:00.000Z", "sync_status": "pending",
        "workspace_id": "w1",
    },
    "purchases": {
        "id": "p1", "code": "C-0001", "supplier": "Repuestos SAC", "invoice": "F001",
        "date": "2026-01-11", "time": "09:00", "status": "recibida",
        "payment_method": "efectivo", "total_amount": 50000, "items_count": 2,
        "notes": "", "deleted": 0, "created_at": "2026-01-11T09:00:00.000Z",
        "updated_at": "2026-01-11T09:00:00.000Z", "sync_status": "pending",
        "workspace_id": "w1",
    },
    "purchase_items": {
        "id": "pi1", "purchase_id": "p1", "product_id": "pr1", "product_name": "Filtro",
        "quantity": 2, "unit_price": 15000, "subtotal": 30000,
    },
    "sales": {
        "id": "s1", "code": "V-0001", "client_id": "cl1", "date": "2026-01-12",
        "time": "15:00", "status": "completada", "subtotal": 80000, "discount": 0,
        "tax": 0, "total_amount": 80000, "items_count": 1,
        "payment_method": "transferencia", "notes": "", "deleted": 0,
        "created_at": "2026-01-12T15:00:00.000Z", "updated_at": "2026-01-12T15:00:00.000Z",
        "sync_status": "pending", "workspace_id": "w1",
    },
    "sale_items": {
        "id": "si1", "sale_id": "s1", "product_id": "pr1", "product_name": "Bujía",
        "quantity": 4, "unit_price": 20000, "discount": 0, "subtotal": 80000,
    },
    "products": {
        "id": "pr1", "code": "PR-1", "name": "Filtro de aceite", "description": "",
        "sku": "SKU-1", "category_id": "c1", "unit": "unidad", "cost_price": 12000,
        "sale_price": 18000, "tax_rate": 0, "stock": 10, "min_stock": 2, "active": 1,
        "deleted": 0, "created_at": "2026-01-01T00:00:00.000Z",
        "updated_at": "2026-01-01T00:00:00.000Z", "sync_status": "synced",
        "workspace_id": "w1",
    },
    "investments": {
        "id": "i1", "code": "INV-1", "asset_name": "Torno", "asset_type": "equipo",
        "amount": 2000000, "current_value": 2100000, "return_rate": 5.0,
        "category": "Maquinaria", "supplier": "", "payment_method": "transferencia",
        "status": "pagado", "voided_at": None, "date": "2026-01-20", "notes": "",
        "deleted": 0, "created_at": "2026-01-20T10:00:00.000Z",
        "updated_at": "2026-01-20T10:00:00.000Z", "sync_status": "pending",
        "workspace_id": "w1",
    },
    "expense_types": {
        "id": "t1", "name": "Operativo", "created_at": "2026-01-01T00:00:00.000Z",
        "updated_at": "2026-01-01T00:00:00.000Z", "sync_status": "synced",
        "workspace_id": "w1",
    },
    "expense_details": {
        "id": "ed1", "expense_id": "e1", "product_name": "Aceite",
        "quantity": 1, "unit_price": 8000, "subtotal": 8000,
    },
    "clients": {
        "id": "cl1", "code": "CL-1", "name": "Juan", "phone": "999", "email": "",
        "address": "", "notes": "", "deleted": 0,
        "created_at": "2026-01-01T00:00:00.000Z", "updated_at": "2026-01-01T00:00:00.000Z",
        "sync_status": "synced", "workspace_id": "w1",
    },
    "stock_movements": {
        "id": "m1", "product_id": "pr1", "movement_type": "entrada", "quantity": 5,
        "reference_type": "purchase", "reference_id": "p1", "date": "2026-01-11",
        "notes": "", "created_at": "2026-01-11T09:00:00.000Z",
        "sync_status": "synced", "workspace_id": "w1",
    },
    "categories": {
        "id": "c1", "name": "Repuestos", "color": "#22c55e", "icon": "icon",
        "deleted": 0, "created_at": "2026-01-01T00:00:00.000Z",
        "updated_at": "2026-01-01T00:00:00.000Z", "sync_status": "synced",
        "workspace_id": "w1",
    },
    "custom_icons": {
        "id": "ci1", "name": "logo", "data_url": "data:image/png;base64,AAAA",
        "deleted": 0, "created_at": "2026-01-01T00:00:00.000Z",
        "updated_at": "2026-01-01T00:00:00.000Z", "sync_status": "synced",
        "workspace_id": "w1",
    },
    "workspaces": {
        "id": "w1", "name": "Personal", "type": "PERSONAL", "parent_id": None,
        "model_key": None, "description": "", "role": "OWNER", "status": "active",
        "deleted": 0, "created_at": "2026-01-01T00:00:00.000Z",
        "updated_at": "2026-01-01T00:00:00.000Z",
    },
    "workspace_modules": {
        "workspace_id": "w1", "module_key": "expenses", "status": "active",
        "created_at": "2026-01-01T00:00:00.000Z",
    },
}

# Columnas API inventadas por COLUMN_DEFAULTS (el móvil no las manda).
PUSH_ONLY_COLUMNS = {"purchase_items": {"name"}, "sale_items": {"name"}}


@pytest.mark.parametrize("table", sorted(MOBILE_PAYLOADS))
def test_push_then_pull_roundtrip_preserves_mobile_fields(table):
    payload = dict(MOBILE_PAYLOADS[table])
    mapped = _map_fields(PUSH_MAP[table], payload)
    _apply_defaults(table, mapped, payload)

    roundtripped = _mobile_row(table, dict(mapped))
    for key, value in payload.items():
        if key in PUSH_ONLY_COLUMNS.get(table, set()):
            continue
        assert key in roundtripped, f"{table}: falta '{key}' tras el round-trip"
        if not isinstance(value, str) or "T" not in value:
            assert roundtripped[key] == value, f"{table}: '{key}' {roundtripped[key]!r} != {value!r}"


def test_workspace_deleted_coerced_to_bool_on_push():
    mapped = _map_fields(PUSH_MAP["workspaces"], MOBILE_PAYLOADS["workspaces"])
    assert mapped["deleted"] == 0  # raw int antes de coercion
    # _apply_change hace bool(mapped["deleted"]) en runtime; aquí probamos la inversa ya aplicada
    back = _mobile_row("workspaces", {**mapped, "deleted": False})
    assert back["deleted"] == 0


def test_mobile_row_converts_api_bool_to_int_for_workspace():
    row = _mobile_row("workspaces", {**MOBILE_PAYLOADS["workspaces"], "deleted": True})
    assert row["deleted"] == 1


def test_unknown_keys_dropped():
    mapped = _map_fields(PUSH_MAP["categories"], {"id": "x", "name": "A", "poison": "y"})
    assert mapped == {"id": "x", "name": "A"}


def test_defaults_fill_required_columns():
    payload = {"id": "pi1", "purchase_id": "p1", "product_name": "Filtro", "quantity": 1}
    mapped = _map_fields(PUSH_MAP["purchase_items"], payload)
    _apply_defaults("purchase_items", mapped, payload)
    assert mapped["name"] == "Filtro"
    assert mapped["product_name"] == "Filtro"
    assert "name" in mapped  # columna inventada NO debe volver al móvil


def test_normalize_legacy_expense_status():
    mapped = {"id": "e1", "status": "activo"}
    _normalize_legacy_status("expenses", mapped)
    assert mapped["status"] == "pagado"

    mapped = {"id": "e2", "status": "cancelado"}
    _normalize_legacy_status("expenses", mapped)
    assert mapped["status"] == "anulado"


def test_normalize_legacy_status_ignores_canonical_and_other_tables():
    mapped = {"id": "e3", "status": "pagado"}
    _normalize_legacy_status("expenses", mapped)
    assert mapped["status"] == "pagado"

    mapped = {"id": "s1", "status": "activo"}
    _normalize_legacy_status("sales", mapped)
    assert mapped["status"] == "activo"


def test_expense_status_legacy_map_complete():
    assert EXPENSE_STATUS_LEGACY == {"activo": "pagado", "cancelado": "anulado"}
    assert EXPENSE_STATUS_CANONICAL == frozenset({"pagado", "pendiente", "anulado"})


def test_canonicalize_expense_status_normalizes_legacy_on_push():
    mapped = {"id": "e1", "status": "activo"}
    assert _canonicalize_expense_status("expenses", mapped, "INSERT") is True
    assert mapped["status"] == "pagado"

    mapped = {"id": "e2", "status": "cancelado"}
    assert _canonicalize_expense_status("expenses", mapped, "UPDATE") is True
    assert mapped["status"] == "anulado"


def test_canonicalize_expense_status_rejects_unknown():
    # Un estado fuera de registro persiste y, al volver por el pull, rompe el
    # CHECK v8 del móvil: debe rechazarse la operación (queda en la outbox).
    mapped = {"id": "e1", "status": "en_proceso"}
    assert _canonicalize_expense_status("expenses", mapped, "INSERT") is False
    assert mapped["status"] == "en_proceso"

    mapped = {"id": "e2", "status": "yolo"}
    assert _canonicalize_expense_status("expenses", mapped, "UPDATE") is False

    mapped = {"id": "e3", "status": "activo"}
    assert _canonicalize_expense_status("expenses", mapped, "INSERT") is True
    assert mapped["status"] == "pagado"


def test_canonicalize_expense_status_defaults_insert_without_status():
    # Sin status, un INSERT caería en el DEFAULT legacy 'activo' de la tabla.
    mapped = {"id": "e1"}
    assert _canonicalize_expense_status("expenses", mapped, "INSERT") is True
    assert mapped["status"] == "pagado"

    # Un UPDATE parcial no toca el estado: no debe poder revivir un anulado.
    mapped = {"id": "e2"}
    assert _canonicalize_expense_status("expenses", mapped, "UPDATE") is True
    assert "status" not in mapped


def test_canonicalize_expense_status_ignores_non_expense_tables():
    mapped = {"id": "s1", "status": "activo"}
    assert _canonicalize_expense_status("sales", mapped, "INSERT") is True
    assert mapped["status"] == "activo"


def test_mobile_row_never_returns_legacy_expense_status():
    # El pull no debe devolver legacy al móvil: el CHECK v8 lo rechaza.
    legacy = {"id": "e1", "status": "activo"}
    assert _mobile_row("expenses", legacy)["status"] == "pagado"

    legacy = {"id": "e2", "status": "cancelado"}
    assert _mobile_row("expenses", legacy)["status"] == "anulado"

    canonical = {"id": "e3", "status": "pendiente"}
    assert _mobile_row("expenses", canonical)["status"] == "pendiente"

    # Otras tablas con 'activo' no se tocan (p. ej. sales.status).
    sale = {"id": "s1", "status": "activo"}
    assert _mobile_row("sales", sale)["status"] == "activo"


class TestProductionConfigGuard:
    def test_production_rejects_default_secret(self):
        with pytest.raises(ValueError):
            Settings(app_env="production", supabase_jwt_secret="change-me")

    def test_production_rejects_empty_secret(self):
        with pytest.raises(ValueError):
            Settings(app_env="production", supabase_jwt_secret="")

    def test_production_requires_issuer(self):
        with pytest.raises(ValueError):
            Settings(app_env="production", supabase_jwt_secret="secret-largo")

    def test_production_accepts_secure_config(self):
        settings = Settings(
            app_env="production",
            supabase_jwt_secret="secret-largo",
            supabase_jwt_issuer="https://x.supabase.co/auth/v1",
        )
        assert settings.supabase_jwt_issuer

    def test_development_allows_default_secret(self):
        settings = Settings(app_env="development")
        assert settings.supabase_jwt_secret == "change-me"