#!/usr/bin/env python3
"""Fail if a Mapbox secret token is present in the checked-out repository.

This guard intentionally reports only file/line locations, never the matched token.
Public Mapbox browser tokens (pk.*) are not secrets and are not rejected here.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXCLUDED_DIRS = {
    ".git",
    ".venv",
    "__pycache__",
    "dist",
    "node_modules",
}
MAX_FILE_BYTES = 10 * 1024 * 1024
MAPBOX_SECRET = re.compile(rb"(?<![A-Za-z0-9])sk\.[A-Za-z0-9._-]{20,}")


def candidate_files() -> list[Path]:
    files: list[Path] = []
    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        if any(part in EXCLUDED_DIRS for part in path.relative_to(ROOT).parts):
            continue
        try:
            if path.stat().st_size > MAX_FILE_BYTES:
                continue
        except OSError:
            continue
        files.append(path)
    return sorted(files)


def main() -> int:
    findings: list[tuple[Path, int]] = []
    for path in candidate_files():
        try:
            data = path.read_bytes()
        except OSError:
            continue
        for match in MAPBOX_SECRET.finditer(data):
            line = data[: match.start()].count(b"\n") + 1
            findings.append((path.relative_to(ROOT), line))

    if findings:
        print("Mapbox secret-token material detected; refusing to continue.", file=sys.stderr)
        for path, line in findings:
            print(f"- {path}:{line}", file=sys.stderr)
        print("Rotate/revoke the credential first; do not copy it into this repository.", file=sys.stderr)
        return 1

    print("Mapbox secret scan: clean")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
