from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from ..adapters.persistence.history_store import init_history_store
from .core import EYE_DIR, SAMPLE_INPUT_DIR
from .routers.analysis import router as analysis_router
from .routers.assistant import router as assistant_router
from .routers.eye import router as eye_router
from .routers.history import router as history_router
from .routers.system import router as system_router

init_history_store()

app = FastAPI(title="Cognitive Accessibility Assistant API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(system_router)
app.include_router(history_router)
app.include_router(eye_router)
app.include_router(analysis_router)
app.include_router(assistant_router)

app.mount("/sample-input", StaticFiles(directory=SAMPLE_INPUT_DIR, html=False), name="sample_input")
app.mount("/eye", StaticFiles(directory=EYE_DIR, html=True), name="eye")
# Web UI is the Vite React app (typically http://127.0.0.1:5173); this process serves API + /eye only.

