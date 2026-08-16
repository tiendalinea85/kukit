import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .db import close_pool, init_pool
from .routers import health, sync

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await init_pool()
    yield
    await close_pool()


app = FastAPI(
    title="CatoLedger API",
    version="0.1.0",
    description="API de sincronización para la app móvil offline-first CatoLedger.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(sync.router)


@app.get("/", tags=["meta"])
async def root() -> dict:
    return {"service": "catoledger-api", "version": "0.1.0", "docs": "/docs"}
