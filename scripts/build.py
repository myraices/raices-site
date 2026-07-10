from __future__ import annotations

import os
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
PLACEHOLDER = "__GOOGLE_MAPS_API_KEY__"

EXCLUDED_TOP_LEVEL = {".git", ".github", "dist"}


def ignore_items(directory: str, names: list[str]) -> set[str]:
    path = Path(directory)
    ignored: set[str] = set()
    if path == ROOT:
        ignored.update(name for name in names if name in EXCLUDED_TOP_LEVEL)
    ignored.update(name for name in names if name == "__pycache__" or name.endswith(".pyc"))
    return ignored


def main() -> None:
    api_key = os.environ.get("GOOGLE_MAPS_API_KEY", "").strip()
    if not api_key:
        raise SystemExit(
            "Missing GOOGLE_MAPS_API_KEY. Add it in Netlify: Site configuration > Environment variables."
        )

    if DIST.exists():
        shutil.rmtree(DIST)

    shutil.copytree(ROOT, DIST, ignore=ignore_items)

    config_path = DIST / "js" / "google-maps-config.js"
    content = config_path.read_text(encoding="utf-8")
    if PLACEHOLDER not in content:
        raise SystemExit(f"Placeholder {PLACEHOLDER} not found in {config_path}")

    # JSON-style quoting safely escapes the value for JavaScript.
    import json

    content = content.replace(f'"{PLACEHOLDER}"', json.dumps(api_key))
    config_path.write_text(content, encoding="utf-8")
    print("Raíces build completed: Google Maps browser key injected into dist.")


if __name__ == "__main__":
    main()
