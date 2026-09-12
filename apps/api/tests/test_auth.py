"""Tests for auth: JWT decoding, /auth/me, /auth/roles, /auth/profile, /auth/workspaces/members.

No live DB is required — endpoints that need PostgreSQL short-circuit or
return 503 gracefully. Role-dependent endpoints are monkeypatched.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional
import time

import jwt
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app
from app.auth import decode_token, AuthUser


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

TEST_USER_SUB = "11111111-1111-1111-1111-111111111111"
TEST_USER_EMAIL = "user@test.com"


def _make_token(
    secret: str,
    sub: str = TEST_USER_SUB,
    email: str = TEST_USER_EMAIL,
    exp_seconds: int = 3600,
    audience: str = "authenticated",
    issuer: Optional[str] = None,
) -> str:
    now = int(time.time())
    claims = {"sub": sub, "email": email, "aud": audience, "iat": now, "exp": now + exp_seconds}
    if issuer:
        claims["iss"] = issuer
    return jwt.encode(claims, secret, algorithm="HS256")


def _auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _valid_token() -> str:
    return _make_token(get_settings().supabase_jwt_secret)


# ---------------------------------------------------------------------------
# decode_token unit tests
# ---------------------------------------------------------------------------

class TestDecodeToken:
    def test_valid(self):
        token = _valid_token()
        payload = decode_token(token)
        assert payload["sub"] == TEST_USER_SUB
        assert payload["email"] == TEST_USER_EMAIL
        assert payload["aud"] == "authenticated"

    def test_expired(self):
        token = _make_token(get_settings().supabase_jwt_secret, exp_seconds=-10)
        with pytest.raises(HTTPException) as exc_info:
            decode_token(token)
        assert exc_info.value.status_code == 401
        assert "expirado" in exc_info.value.detail

    def test_wrong_secret(self):
        token = _make_token("definitely-wrong-secret-key-for-testing")
        with pytest.raises(HTTPException) as exc_info:
            decode_token(token)
        assert exc_info.value.status_code == 401
        assert "inválido" in exc_info.value.detail

    def test_wrong_audience(self):
        token = _make_token(get_settings().supabase_jwt_secret, audience="admin")
        with pytest.raises(HTTPException) as exc_info:
            decode_token(token)
        assert exc_info.value.status_code == 401

    def test_missing_sub(self):
        token = _make_token(get_settings().supabase_jwt_secret, sub=None)
        # jwt.encode with sub=None → "sub": None → required=["sub"] fails
        # Actually jwt.encode allows None; decode will succeed but payload["sub"] is None.
        # PyJWT: missing "sub" key → InvalidTokenError.
        # We set sub=None but encode will produce "sub": None present. We need to manually craft.
        import time as _time
        now = int(_time.time())
        payload_claims = {"email": TEST_USER_EMAIL, "aud": "authenticated", "iat": now, "exp": now + 3600}
        token = jwt.encode(payload_claims, get_settings().supabase_jwt_secret, algorithm="HS256")
        with pytest.raises(HTTPException) as exc_info:
            decode_token(token)
        assert exc_info.value.status_code == 401

    def test_issuer_valid(self):
        settings = get_settings()
        # Monkeypatch settings to include issuer.
        original = settings.supabase_jwt_issuer
        settings.supabase_jwt_issuer = "https://xyz.supabase.co/auth/v1"
        try:
            token = _make_token(settings.supabase_jwt_secret, issuer="https://xyz.supabase.co/auth/v1")
            payload = decode_token(token)
            assert payload["iss"] == "https://xyz.supabase.co/auth/v1"
        finally:
            settings.supabase_jwt_issuer = original

    def test_issuer_invalid(self):
        settings = get_settings()
        original = settings.supabase_jwt_issuer
        settings.supabase_jwt_issuer = "https://xyz.supabase.co/auth/v1"
        try:
            token = _make_token(settings.supabase_jwt_secret, issuer="https://wrong.supabase.co/auth/v1")
            with pytest.raises(HTTPException) as exc_info:
                decode_token(token)
            assert exc_info.value.status_code == 401
            assert "Emisor" in exc_info.value.detail
        finally:
            settings.supabase_jwt_issuer = original

    def test_issuer_not_checked_when_none(self):
        settings = get_settings()
        original = settings.supabase_jwt_issuer
        settings.supabase_jwt_issuer = None
        try:
            # Token sin issuer → passa porque no se verifica.
            token = _make_token(settings.supabase_jwt_secret)
            payload = decode_token(token)
            assert "iss" not in payload or payload.get("iss") is None
        finally:
            settings.supabase_jwt_issuer = original


# ---------------------------------------------------------------------------
# /auth/me
# ---------------------------------------------------------------------------

class TestMeEndpoint:
    def test_no_token_returns_401(self):
        client = TestClient(app, raise_server_exceptions=False)
        res = client.get("/auth/me")
        assert res.status_code == 401

    def test_invalid_token_returns_401(self):
        client = TestClient(app, raise_server_exceptions=False)
        res = client.get("/auth/me", headers=_auth_header("bad-token"))
        assert res.status_code == 401

    def test_valid_token_returns_200_without_db(self):
        client = TestClient(app, raise_server_exceptions=False)
        res = client.get("/auth/me", headers=_auth_header(_valid_token()))
        assert res.status_code == 200
        body = res.json()
        assert body["id"] == TEST_USER_SUB
        assert body["email"] == TEST_USER_EMAIL
        # Sin DB, profile es None.
        assert body["profile"] is None


# ---------------------------------------------------------------------------
# /auth/profile
# ---------------------------------------------------------------------------

class TestProfileEndpoint:
    def test_update_profile_empty_name_returns_422(self):
        client = TestClient(app, raise_server_exceptions=False)
        res = client.put(
            "/auth/profile",
            json={"full_name": ""},
            headers=_auth_header(_valid_token()),
        )
        # FastAPI/Pydantic validates min_length=1 → 422.
        assert res.status_code == 422

    def test_update_profile_without_db_returns_503(self):
        client = TestClient(app, raise_server_exceptions=False)
        res = client.put(
            "/auth/profile",
            json={"full_name": "Test User"},
            headers=_auth_header(_valid_token()),
        )
        assert res.status_code == 503


# ---------------------------------------------------------------------------
# /auth/roles
# ---------------------------------------------------------------------------

class TestRolesEndpoint:
    def test_roles_without_db_returns_503(self):
        client = TestClient(app, raise_server_exceptions=False)
        res = client.get(
            "/auth/roles",
            params={"workspace_id": "00000000-0000-0000-0000-000000000001"},
            headers=_auth_header(_valid_token()),
        )
        assert res.status_code == 503

    def test_roles_member(self, monkeypatch):
        async def _fake_role(user_id: str, workspace_id: str) -> str:
            return "ADMIN"

        monkeypatch.setattr("app.auth.load_workspace_role", _fake_role)
        client = TestClient(app, raise_server_exceptions=False)
        res = client.get(
            "/auth/roles",
            params={"workspace_id": "w1"},
            headers=_auth_header(_valid_token()),
        )
        assert res.status_code == 200
        assert res.json()["role"] == "ADMIN"

    def test_roles_not_member(self, monkeypatch):
        async def _fake_role(user_id: str, workspace_id: str) -> None:
            return None

        monkeypatch.setattr("app.auth.load_workspace_role", _fake_role)
        client = TestClient(app, raise_server_exceptions=False)
        res = client.get(
            "/auth/roles",
            params={"workspace_id": "w1"},
            headers=_auth_header(_valid_token()),
        )
        assert res.status_code == 403
        assert "miembro" in res.json()["detail"]

    def test_roles_requires_workspace_id(self):
        client = TestClient(app, raise_server_exceptions=False)
        res = client.get("/auth/roles", headers=_auth_header(_valid_token()))
        assert res.status_code == 422


# ---------------------------------------------------------------------------
# /auth/workspaces/members
# ---------------------------------------------------------------------------

class TestMembersEndpoint:
    def test_list_members_not_member(self, monkeypatch):
        async def _fake_role(user_id: str, workspace_id: str) -> None:
            return None

        monkeypatch.setattr("app.auth.load_workspace_role", _fake_role)
        client = TestClient(app, raise_server_exceptions=False)
        res = client.get(
            "/auth/workspaces/members",
            params={"workspace_id": "w1"},
            headers=_auth_header(_valid_token()),
        )
        assert res.status_code == 403

    def test_list_members_readonly(self, monkeypatch):
        async def _fake_role(user_id: str, workspace_id: str) -> str:
            return "READ_ONLY"

        monkeypatch.setattr("app.auth.load_workspace_role", _fake_role)
        client = TestClient(app, raise_server_exceptions=False)
        res = client.get(
            "/auth/workspaces/members",
            params={"workspace_id": "w1"},
            headers=_auth_header(_valid_token()),
        )
        # READ_ONLY is a member → list allowed; DB down → 503.
        assert res.status_code == 503

    def test_set_role_readonly_caller_forbidden(self, monkeypatch):
        async def _fake_role(user_id: str, workspace_id: str) -> str:
            return "READ_ONLY"

        monkeypatch.setattr("app.auth.load_workspace_role", _fake_role)
        client = TestClient(app, raise_server_exceptions=False)
        res = client.put(
            "/auth/workspaces/members",
            params={"workspace_id": "w1", "user_id": "u2"},
            json={"role": "USER"},
            headers=_auth_header(_valid_token()),
        )
        assert res.status_code == 403
        assert "requiere rol" in res.json()["detail"]

    def test_set_role_admin_cannot_promote_to_owner(self, monkeypatch):
        roles: dict[str, str] = {"caller": "ADMIN", "target": "READ_ONLY"}

        async def _fake_role(user_id: str, workspace_id: str) -> str:
            return roles.get(user_id, "READ_ONLY")

        async def _no_pool():
            raise RuntimeError("no db")

        monkeypatch.setattr("app.auth.load_workspace_role", _fake_role)
        monkeypatch.setattr("app.auth.get_pool", _no_pool)
        client = TestClient(app, raise_server_exceptions=False)
        res = client.put(
            "/auth/workspaces/members",
            params={"workspace_id": "w1", "user_id": "target"},
            json={"role": "OWNER"},
            headers=_auth_header(_valid_token()),
        )
        # ADMIN can set roles; but setting OWNER requires caller to be OWNER.
        assert res.status_code == 403
        assert "OWNER" in res.json()["detail"]

    def test_remove_member_readonly_forbidden(self, monkeypatch):
        async def _fake_role(user_id: str, workspace_id: str) -> str:
            return "READ_ONLY"

        monkeypatch.setattr("app.auth.load_workspace_role", _fake_role)
        client = TestClient(app, raise_server_exceptions=False)
        res = client.delete(
            "/auth/workspaces/members",
            params={"workspace_id": "w1", "user_id": "u2"},
            headers=_auth_header(_valid_token()),
        )
        assert res.status_code == 403

    def test_remove_member_not_exists_returns_204(self, monkeypatch):
        roles_store: dict[str, str] = {}

        async def _fake_role(user_id: str, workspace_id: str) -> str | None:
            return roles_store.get(user_id)

        async def _no_pool():
            raise RuntimeError("no db")

        monkeypatch.setattr("app.auth.load_workspace_role", _fake_role)
        monkeypatch.setattr("app.auth.get_pool", _no_pool)
        client = TestClient(app, raise_server_exceptions=False)
        # caller=OWNER (in token sub=TEST_USER_SUB), target=nonexistent
        roles_store[TEST_USER_SUB] = "OWNER"
        res = client.delete(
            "/auth/workspaces/members",
            params={"workspace_id": "w1", "user_id": "nonexistent"},
            headers=_auth_header(_valid_token()),
        )
        assert res.status_code == 204


# ---------------------------------------------------------------------------
# /auth/audit
# ---------------------------------------------------------------------------

class TestAuditEndpoint:
    def test_audit_without_db_returns_503(self):
        client = TestClient(app, raise_server_exceptions=False)
        res = client.get(
            "/auth/audit",
            params={"limit": 10},
            headers=_auth_header(_valid_token()),
        )
        assert res.status_code == 503

    def test_audit_limit_bounds(self):
        client = TestClient(app, raise_server_exceptions=False)
        res = client.get(
            "/auth/audit",
            params={"limit": 0},
            headers=_auth_header(_valid_token()),
        )
        assert res.status_code == 422
