#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Copy the native Masir widget sources into the generated Bubblewrap project.

The generated ``pwa/app`` directory is disposable: running ``bubblewrap update``
recreates it.  Keep the committed widget sources in ``pwa/widgets`` and run this
script after every Bubblewrap update before building the APK/AAB.
"""

from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parent
TEMPLATES = ROOT / "widgets"
APP = ROOT / "app" / "src" / "main"
MANIFEST = APP / "AndroidManifest.xml"
RECEIVERS = (TEMPLATES / "manifest-receivers.xml").read_text(encoding="utf-8").strip()
START = "<!-- MASIR_WIDGETS_START -->"


def copy_tree(source: Path, destination: Path) -> int:
    count = 0
    for item in sorted(source.rglob("*")):
        if not item.is_file():
            continue
        target = destination / item.relative_to(source)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(item, target)
        count += 1
    return count


def install_manifest() -> bool:
    if not MANIFEST.exists():
        raise SystemExit(f"Generated Android project not found: {MANIFEST}\nRun bubblewrap update first.")
    text = MANIFEST.read_text(encoding="utf-8")
    if START in text:
        return False
    if "</application>" not in text:
        raise SystemExit(f"Could not find </application> in {MANIFEST}")
    text = text.replace("</application>", "        " + RECEIVERS + "\n    </application>")
    with MANIFEST.open("w", encoding="utf-8", newline="") as handle:
        handle.write(text)
    return True


def main() -> None:
    files = copy_tree(TEMPLATES / "java", APP / "java")
    for folder in ("layout", "xml", "values"):
        files += copy_tree(TEMPLATES / "res" / folder, APP / "res" / folder)
    manifest_changed = install_manifest()
    print(f"Copied {files} widget source/resource files into {APP}")
    print("AndroidManifest.xml receivers installed" if manifest_changed else
          "AndroidManifest.xml receivers already present")


if __name__ == "__main__":
    main()
