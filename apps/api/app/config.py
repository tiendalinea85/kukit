from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # development (local/tests) o production. En PRODUCTION se exige secreto e
    # issuer: el valor por defecto "change-me" permitiría forjar JWTs HS256.
    app_env: str = "development"
    database_url: str = "postgresql://postgres:postgres@localhost:5432/cato_ledger"
    supabase_jwt_secret: str = "change-me"
    supabase_jwt_alg: str = "HS256"
    # URL del proyecto Supabase (https://<project>.supabase.co/auth/v1).
    # Si se define, la API valida también el emisor (iss) del JWT.
    supabase_jwt_issuer: str | None = None
    # Orígenes permitidos para CORS. La app móvil nativa no necesita CORS;
    # si algún cliente web consume la API, lista aquí sus orígenes exactos.
    cors_origins: list[str] = []

    model_config = {"env_file": ".env"}

    @model_validator(mode="after")
    def _validate_production(self) -> "Settings":
        if self.app_env.lower() != "production":
            return self
        if not self.supabase_jwt_secret or self.supabase_jwt_secret == "change-me":
            raise ValueError("SUPABASE_JWT_SECRET debe configurarse en producción")
        if not self.supabase_jwt_issuer:
            raise ValueError("SUPABASE_JWT_ISSUER debe configurarse en producción")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
