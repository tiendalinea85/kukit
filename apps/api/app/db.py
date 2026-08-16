from pathlib import Path
import logging
import time

import asyncpg

from .config import get_settings

_pool: asyncpg.Pool | None = None
_last_attempt = 0.0
RETRY_COOLDOWN_SECONDS = 5.0

logger = logging.getLogger(__name__)

MIGRATIONS_DIR = Path(__file__).resolve().parent.parent / "migrations"


async def init_pool() -> None:
    global _pool
    if _pool is not None:
        return
    settings = get_settings()
    try:
        _pool = await asyncpg.create_pool(settings.database_url, min_size=1, max_size=10)
        await apply_migrations(_pool)
        logger.info("Conexión a PostgreSQL establecida")
    except Exception as exc:
        logger.warning("Base de datos no disponible al iniciar: %s", exc)
        _pool = None


async def get_pool() -> asyncpg.Pool:
    global _pool, _last_attempt
    if _pool is None:
        now = time.monotonic()
        if now - _last_attempt >= RETRY_COOLDOWN_SECONDS:
            _last_attempt = now
            await init_pool()
    if _pool is None:
        raise RuntimeError("Base de datos no disponible")
    return _pool  # type: ignore[return-value]


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


async def apply_migrations(pool: asyncpg.Pool) -> None:
    async with pool.acquire() as conn:
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version TEXT PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        )
        applied = {
            r["version"]
            for r in await conn.fetch("SELECT version FROM schema_migrations")
        }
        files = sorted(MIGRATIONS_DIR.glob("*.sql"))
        for file in files:
            if file.name in applied:
                continue
            sql = file.read_text(encoding="utf-8")
            async with conn.transaction():
                await conn.execute(sql)
                await conn.execute(
                    "INSERT INTO schema_migrations (version) VALUES ($1)", file.name
                )
