from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://postgres:postgres@localhost:5432/cato_ledger"
    supabase_jwt_secret: str = "change-me"
    supabase_jwt_alg: str = "HS256"
    # Orígenes permitidos para CORS. La app móvil nativa no necesita CORS;
    # si algún cliente web consume la API, lista aquí sus orígenes exactos.
    cors_origins: list[str] = []

    model_config = {"env_file": ".env"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
