from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
PLACEHOLDER = "__GOOGLE_MAPS_API_KEY__"
TURNSTILE_PLACEHOLDER = "__TURNSTILE_SITE_KEY__"

EXCLUDED_TOP_LEVEL = {".git", ".github", "dist", "raices-site-v116-supabase-catalog"}

# Local CSS/JS URLs in HTML or JavaScript strings. Existing ?v= values are replaced.
ASSET_URL_PATTERN = re.compile(
    r"(?P<prefix>(?:src|href)=[\"']|[\"'])"
    r"(?P<slash>/?)(?P<path>(?:js|css)/[^\"'?]+)"
    r"(?:\?v=[^\"']+)?"
    r"(?P<suffix>[\"'])"
)


def ignore_items(directory: str, names: list[str]) -> set[str]:
    path = Path(directory)
    ignored: set[str] = set()
    if path == ROOT:
        ignored.update(name for name in names if name in EXCLUDED_TOP_LEVEL)
    ignored.update(name for name in names if name == "__pycache__" or name.endswith(".pyc"))
    return ignored


def short_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:12]


def rewrite_asset_urls(file_path: Path, hashes: dict[str, str]) -> bool:
    original = file_path.read_text(encoding="utf-8")

    def replace(match: re.Match[str]) -> str:
        relative_path = match.group("path")
        version = hashes.get(relative_path)
        if not version:
            return match.group(0)
        return (
            f"{match.group('prefix')}{match.group('slash')}"
            f"{relative_path}?v={version}{match.group('suffix')}"
        )

    updated = ASSET_URL_PATTERN.sub(replace, original)
    if updated == original:
        return False
    file_path.write_text(updated, encoding="utf-8")
    return True


def apply_content_hash_cache_busting() -> None:
    """Version local JS/CSS by content hash on every Netlify build.

    JavaScript files can dynamically reference other JavaScript files, so those
    references are rewritten first. Hashes are then recalculated before HTML is
    rewritten. This avoids stale shop.js files on browsers and installed PWAs.
    """
    asset_files = [
        path
        for folder in (DIST / "js", DIST / "css")
        if folder.exists()
        for path in folder.rglob("*")
        if path.is_file()
    ]

    initial_hashes = {
        path.relative_to(DIST).as_posix(): short_hash(path) for path in asset_files
    }

    # Rewrite dynamic local JS/CSS references inside JavaScript files.
    for js_file in (DIST / "js").rglob("*.js"):
        rewrite_asset_urls(js_file, initial_hashes)

    # Recalculate because files such as catalog-bootstrap.js may have changed.
    final_hashes = {
        path.relative_to(DIST).as_posix(): short_hash(path) for path in asset_files
    }

    # Rewrite all published HTML references with final content hashes.
    for html_file in DIST.rglob("*.html"):
        rewrite_asset_urls(html_file, final_hashes)


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
    content = content.replace(f'"{PLACEHOLDER}"', json.dumps(api_key))
    config_path.write_text(content, encoding="utf-8")

    turnstile_key = os.environ.get("TURNSTILE_SITE_KEY", "").strip()
    if not turnstile_key:
        raise SystemExit(
            "Missing TURNSTILE_SITE_KEY. Add it in Netlify: Site configuration > Environment variables."
        )
    turnstile_config_path = DIST / "js" / "turnstile-config.js"
    turnstile_content = turnstile_config_path.read_text(encoding="utf-8")
    if TURNSTILE_PLACEHOLDER not in turnstile_content:
        raise SystemExit(f"Placeholder {TURNSTILE_PLACEHOLDER} not found in {turnstile_config_path}")
    turnstile_content = turnstile_content.replace(
        f'"{TURNSTILE_PLACEHOLDER}"', json.dumps(turnstile_key)
    )
    turnstile_config_path.write_text(turnstile_content, encoding="utf-8")

    apply_content_hash_cache_busting()
    print("Raíces v14.1 build completed: keys injected and JS/CSS content hashes applied.")


if __name__ == "__main__":
    main()
