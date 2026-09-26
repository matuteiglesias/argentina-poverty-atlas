from __future__ import annotations

import gzip
import hashlib
import json
import os
from pathlib import Path

import requests

TOKEN = os.environ.get("VITE_MAPBOX_PUBLIC_TOKEN", "")
ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "src/map/mapboxDiagnosticFixtures.generated.json"


def fail(message: str) -> None:
    raise RuntimeError(message)


def fetch_tile(tileset_id: str, z: int, x: int, y: int) -> bytes:
    response = requests.get(
        f"https://api.mapbox.com/v4/{tileset_id}/{z}/{x}/{y}.mvt",
        params={"access_token": TOKEN},
        headers={"Accept": "application/vnd.mapbox-vector-tile"},
        timeout=90,
    )
    if response.status_code != 200:
        fail(
            f"Public token tile fetch failed for {tileset_id}/"
            f"{z}/{x}/{y}: HTTP {response.status_code} {response.text[:300]}"
        )
    raw = response.content
    if raw.startswith(b"\x1f\x8b"):
        raw = gzip.decompress(raw)
    return raw


def main() -> None:
    if not TOKEN.startswith("pk."):
        fail("VITE_MAPBOX_PUBLIC_TOKEN must be the existing public pk.* token")

    payload = json.loads(FIXTURE.read_text(encoding="utf-8"))
    levels = payload.get("levels")
    if not isinstance(levels, dict):
        fail("Generated browser diagnostic fixture has no levels object")

    for level, fixture in levels.items():
        tile = fixture.get("known_nonempty_tile")
        if not isinstance(tile, dict):
            fail(f"{level}: no server-proven known_nonempty_tile")
        raw = fetch_tile(
            str(fixture["tileset_id"]),
            int(tile["z"]),
            int(tile["x"]),
            int(tile["y"]),
        )
        observed_sha = hashlib.sha256(raw).hexdigest()
        expected_sha = str(tile["sha256_server_proof"])
        expected_bytes = int(tile["bytes_server_proof"])
        if len(raw) != expected_bytes or observed_sha != expected_sha:
            fail(
                f"{level}: public-token payload differs from secret-token proof; "
                f"bytes={len(raw)} expected={expected_bytes}, "
                f"sha256={observed_sha} expected_sha256={expected_sha}"
            )
        print(
            f"PASS {level}: public token fetched exact proven tile "
            f"z{tile['z']}/{tile['x']}/{tile['y']} "
            f"bytes={len(raw)} sha256={observed_sha}"
        )


if __name__ == "__main__":
    main()
