import jwt
from fastapi import Depends, HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from .config import get_settings

bearer = HTTPBearer(auto_error=False)


class AuthUser(BaseModel):
    id: str
    email: str | None = None


def decode_token(token: str) -> dict:
    settings = get_settings()
    try:
        return jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=[settings.supabase_jwt_alg],
            audience="authenticated",
        )
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=401, detail="Token expirado") from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail="Token inválido") from exc


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Security(bearer),
) -> AuthUser:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Autenticación requerida")
    payload = decode_token(credentials.credentials)
    return AuthUser(id=payload["sub"], email=payload.get("email"))
