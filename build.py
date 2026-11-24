#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build.py — bundle the app into a single offline HTML file.

Source files are discovered automatically, so adding/renaming a tab module only
requires updating index.html (or using the same numeric prefix convention).

    python build.py            -> writes "All in One.html"
    python build.py --open     -> also opens the result
    python build.py --out X    -> custom output path

There are no external runtime scripts; every CSS/JS asset is local and inlined.
"""

from __future__ import annotations

import argparse
import base64
import mimetypes
import re
import sys
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
HTML_FILE = ROOT / "index.html"
DEFAULT_OUT = ROOT / "All in One.html"

CSS_DIR = ROOT / "css"
JS_DIR = ROOT / "js"

ASSET_MIME = {
    ".woff2": "font/woff2",
    ".woff": "font/woff",
    ".ttf": "font/ttf",
    ".otf": "font/otf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
}
CSS_URL_RE = re.compile(r"url\((['\"]?)([^)'\"]+)\1\)")
PRELOAD_RE = re.compile(r"<link\b[^>]*\brel=[\"']preload[\"'][^>]*>", re.IGNORECASE)
HREF_RE = re.compile(r"\bhref=[\"']([^\"']+)[\"']", re.IGNORECASE)


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def safe_inline(text: str, tag: str) -> str:
    return text.replace(f"</{tag}>", f"<\\/{tag}>")


def is_external(url: str) -> bool:
    return url.startswith(("http://", "https://", "//", "data:", "#"))


def inline_css_assets(text: str, css_path: Path) -> str:
    """Embed local fonts/images referenced by url(...) so the single-file build
    keeps working offline without relying on relative paths."""

    def replace(match: re.Match[str]) -> str:
        ref = match.group(2).strip()
        if not ref or is_external(ref):
            return match.group(0)
        target = (css_path.parent / ref).resolve()
        if not target.is_file():
            print(f"  warning: asset not found for {css_path.name}: {ref}")
            return match.group(0)
        mime = ASSET_MIME.get(target.suffix.lower())
        if not mime:
            mime = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        encoded = base64.b64encode(target.read_bytes()).decode("ascii")
        return f"url('data:{mime};base64,{encoded}')"

    return CSS_URL_RE.sub(replace, text)


def strip_local_preloads(html: str) -> str:
    """Drop local preload hints from the single-file build; those assets are
    already inlined, so the hint would point at a file that is not shipped."""

    def replace(match: re.Match[str]) -> str:
        tag = match.group(0)
        href_match = HREF_RE.search(tag)
        href = href_match.group(1) if href_match else ""
        if href and not is_external(href):
            return ""
        return tag

    return PRELOAD_RE.sub(replace, html)


def local_tag_variants(kind: str, path: str) -> list[str]:
    variants: list[str] = []
    for p in (path, "./" + path):
        if kind == "css":
            variants += [f'<link rel="stylesheet" href="{p}">', f"<link rel='stylesheet' href='{p}'>"]
        else:
            variants += [f'<script src="{p}"></script>', f"<script src='{p}'></script>"]
    return variants


def discover(directory: Path, suffix: str) -> list[Path]:
    files = sorted(directory.glob(f"*{suffix}"), key=lambda p: p.name)
    if not files:
        raise SystemExit(f"No {suffix} files found in {directory}")
    return files


def strip_local_tag(html: str, kind: str, relative: str) -> tuple[str, bool]:
    for tag in local_tag_variants(kind, relative):
        if tag in html:
            return html.replace(tag, "", 1), True
    return html, False


def main() -> None:
    parser = argparse.ArgumentParser(description="Bundle the app into one HTML file.")
    parser.add_argument("--out", default=str(DEFAULT_OUT), help="output file")
    parser.add_argument("--open", action="store_true", help="open the output when done")
    args = parser.parse_args()

    if not HTML_FILE.exists():
        raise SystemExit(f"Missing {HTML_FILE.name}")

    css_files = discover(CSS_DIR, ".css")
    js_files = discover(JS_DIR, ".js")
    html = read(HTML_FILE)

    print(f"HTML: {HTML_FILE.name}")
    print(f"CSS : {len(css_files)} files")
    print(f"JS  : {len(js_files)} files\n")

    css_parts: list[str] = []
    for path in css_files:
        relative = path.relative_to(ROOT).as_posix()
        css_parts.append(f"/* ===== {relative} ===== */\n{inline_css_assets(read(path), path)}")
        html, found = strip_local_tag(html, "css", relative)
        if not found:
            print(f"  warning: <link> not found for {relative}")

    css = safe_inline("\n\n".join(css_parts), "style")
    html = html.replace("</head>", f"<style>\n{css}\n</style>\n</head>", 1)
    html = strip_local_preloads(html)

    js_parts: list[str] = []
    for path in js_files:
        relative = path.relative_to(ROOT).as_posix()
        js_parts.append(f"/* ===== {relative} ===== */\n{read(path)}")
        html, _ = strip_local_tag(html, "js", relative)

    js = safe_inline("\n\n".join(js_parts), "script")
    html = html.replace("</body>", f"<script>\n{js}\n</script>\n</body>", 1)

    # Verify no local references survived and report intentional CDN scripts.
    leftover_local = [
        src
        for src in re.findall(r'<script\s+src=["\']([^"\']+\.js)["\']', html)
        if not is_external(src)
    ]
    leftover_local += [
        href
        for href in re.findall(r'<link[^>]*href=["\']([^"\']+\.css)["\']', html)
        if not is_external(href)
    ]
    if leftover_local:
        print("  error: local assets were not inlined:")
        for item in leftover_local:
            print(f"    - {item}")
        raise SystemExit(1)

    cdn_scripts = [
        src
        for src in re.findall(r'<script\s+src=["\']([^"\']+)["\']', html)
        if is_external(src)
    ]

    out = Path(args.out)
    out.write_text(html, encoding="utf-8")
    size_kb = out.stat().st_size / 1024

    print(f"Wrote {out.name} ({size_kb:,.1f} KB)")
    print(f"  CSS {len(css):,} bytes / JS {len(js):,} bytes")
    if cdn_scripts:
        print(f"  {len(cdn_scripts)} external CDN script(s) kept: {', '.join(cdn_scripts)}")
    print("  Keep sw.js next to the output if you want offline support.")

    if args.open:
        webbrowser.open(out.resolve().as_uri())


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
