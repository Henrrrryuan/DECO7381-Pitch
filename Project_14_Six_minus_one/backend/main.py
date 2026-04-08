from __future__ import annotations

from importlib.util import find_spec
from typing import Any

REQUIRED_RUNTIME_MODULES: dict[str, str] = {
    "bs4": "beautifulsoup4",
    "fastapi": "fastapi",
    "multipart": "python-multipart",
}


def _assert_runtime_dependencies() -> None:
    missing = [
        (module_name, package_name)
        for module_name, package_name in REQUIRED_RUNTIME_MODULES.items()
        if find_spec(module_name) is None
    ]
    if not missing:
        return

    missing_modules = ", ".join(module_name for module_name, _ in missing)
    install_packages = " ".join(
        sorted({package_name for _, package_name in missing})
    )
    raise ModuleNotFoundError(
        "Missing backend runtime dependencies: "
        f"{missing_modules}. Install with "
        "`python -m pip install -r requirements.txt` "
        f"or `python -m pip install {install_packages}`."
    )


_assert_runtime_dependencies()

from .analyzers import (
    analyze_consistency,
    analyze_interaction,
    analyze_readability,
    analyze_visual,
)
from .scoring import calculate_overall_score
from .schemas import AnalysisResult
from .zip_input import ZipInputError, extract_html_from_zip_bytes
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

MAX_ZIP_UPLOAD_BYTES = 20 * 1024 * 1024  # 20MB


def analyze_html(html: str) -> AnalysisResult:
    dimensions = [
        analyze_readability(html),
        analyze_visual(html),
        analyze_interaction(html),
        analyze_consistency(html),
    ]
    return calculate_overall_score(dimensions)


def analyze_html_dict(html: str) -> dict[str, Any]:
    return analyze_html(html).to_dict()


class AnalyzePayload(BaseModel):
    html: str


app = FastAPI(title="Cognitive Accessibility Assistant API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/analyze")
def analyze(payload: AnalyzePayload) -> dict[str, Any]:
    return analyze_html_dict(payload.html)


@app.post("/analyze-zip")
async def analyze_zip(file: UploadFile = File(...)) -> dict[str, Any]:
    filename = (file.filename or "").lower()
    if not filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="仅支持 .zip 文件。")

    zip_bytes = await file.read()
    if not zip_bytes:
        raise HTTPException(status_code=400, detail="上传的 ZIP 文件为空。")
    if len(zip_bytes) > MAX_ZIP_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"ZIP 文件过大，限制为 {MAX_ZIP_UPLOAD_BYTES // (1024 * 1024)}MB。",
        )

    try:
        html = extract_html_from_zip_bytes(zip_bytes)
    except ZipInputError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return analyze_html_dict(html)
