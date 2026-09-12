from typing import Optional, Sequence

import jwt
from fastapi import Depends, HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from .config import get_settings
from .db import get_pool
from .roles import ROLE_RANK, get_workspace_role

bearer = HTTPBearer(auto_error=False)


class AuthUser(BaseModel):
    id: str
    email: str | None = None


def decode_token(token: str) -> dict:
    """Valida el JWT de Supabase (firma, audiencia, expiración, emisor)."""
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=[settings.supabase_jwt_alg],
            audience="authenticated",
            options={"require": ["sub", "exp", "aud"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=401, detail="Token expirado") from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail="Token inválido") from exc

    issuer = settings.supabase_jwt_issuer
    if issuer and payload.get("iss") != issuer:
        raise HTTPException(status_code=401, detail="Emisor no válido")
    return payload


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Security(bearer),
) -> AuthUser:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Autenticación requerida")
    payload = decode_token(credentials.credentials)
    return AuthUser(id=payload["sub"], email=payload.get("email"))


async def load_workspace_role(user_id: str, workspace_id: str) -> Optional[str]:
    """Rol del usuario en un workspace; 503 si la DB no está disponible."""
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            return await get_workspace_role(conn, user_id, workspace_id)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail="Base de datos no disponible") from exc


def require_workspace_role(*roles: str):
    """Dependencia: el usuario debe tener al menos uno de `roles` en el workspace."""

    async def _dependency(
        workspace_id: str,
        user: AuthUser = Depends(get_current_user),
    ) -> None:
        if not workspace_id:
            raise HTTPException(status_code=400, detail="workspace_id requerido")
        role = await load_workspace_role(user.id, workspace_id)
        if role is None:
            raise HTTPException(status_code=403, detail="No eres miembro de este workspace")
        required = max(ROLE_RANK[r] for r in roles if r in ROLE_RANK)
        if ROLE_RANK.get(role, 0) < required:
            raise HTTPException(
                status_code=403, detail="Se requiere rol " + " o ".join(roles)
            )

    return _dependency


def require_workspace_member():
    """Dependencia: el usuario debe ser miembro del workspace (cualquier rol)."""

    async def _dependency(
        workspace_id: str,
        user: AuthUser = Depends(get_current_user),
    ) -> None:
        if not workspace_id:
            raise HTTPException(status_code=400, detail="workspace_id requerido")
        role = await load_workspace_role(user.id, workspace_id)
        if role is None:
            raise HTTPException(status_code=403, detail="No eres miembro de este workspace")

    return _dependency
