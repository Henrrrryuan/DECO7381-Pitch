from __future__ import annotations

from importlib.util import find_spec

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
    install_packages = " ".join(sorted({package_name for _, package_name in missing}))
    raise ModuleNotFoundError(
        "Missing backend runtime dependencies: "
        f"{missing_modules}. Install with "
        "`python -m pip install -r requirements.txt` "
        f"or `python -m pip install {install_packages}`."
    )


_assert_runtime_dependencies()

from .app.main import app

