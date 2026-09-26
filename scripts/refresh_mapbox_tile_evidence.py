from __future__ import annotations

import gzip
import hashlib
import json
import os
from pathlib import Path
from typing import Any

import mapbox_vector_tile
import requests

TOKEN = os.environ.get("MAPBOX_UPLOAD_TOKEN", "")
ROOT = Path(__file__).resolve().parents[1]

PROFILES = {
    "province_2010": {
        "proof": ROOT / "mapbox/manifests/province-w3-publication-proof.json",
        "candidates": [(2, 1, 2), (2, 1, 3)],
    },
    "department_2010": {
        "proof": ROOT / "mapbox/manifests/department-w3-publication-proof.json",
        "candidates": [(3, 2, 4), (3, 2, 5)],
    },
}

OUTPUT = ROOT / "src/map/mapboxDiagnosticFixtures.generated.json"


def fail(message: str) -> None:
    raise RuntimeError(message)


def load_tile(tileset_id: str, z: int, x: int, y: int) -> bytes:
    response = requests.get(
        f"https://api.mapbox.com/v4/{tileset_id}/{z}/{x}/{y}.mvt",
        params={"access_token": TOKEN},
        headers={"Accept": "application/vnd.mapbox-vector-tile"},
        timeout=90,
    )
    if response.status_code == 404:
        return b""
    if response.status_code != 200:
        fail(
            f"Mapbox tile {tileset_id}/{z}/{x}/{y} failed HTTP "
            f"{response.status_code}: {response.text[:500]}"
        )
    raw = response.content
    if raw.startswith(b"\x1f\x8b"):
        raw = gzip.decompress(raw)
    return raw


def inspect_tile(
    tileset_id: str,
    source_layer: str,
    z: int,
    x: int,
    y: int,
) -> dict[str, Any] | None:
    raw = load_tile(tileset_id, z, x, y)
    if not raw:
        return None
    decoded = mapbox_vector_tile.decode(raw)
    layer = decoded.get(source_layer)
    if not isinstance(layer, dict):
        fail(
            f"Tile {tileset_id}/{z}/{x}/{y} decoded but did not expose "
            f"source-layer {source_layer!r}; layers={sorted(decoded)}"
        )
    ids = sorted(
        {
            str((feature.get("properties") or {}).get("geography_id"))
            for feature in layer.get("features", [])
            if (feature.get("properties") or {}).get("geography_id") is not None
        }
    )
    if not ids:
        return None
    return {
        "z": z,
        "x": x,
        "y": y,
        "bytes": len(raw),
        "sha256": hashlib.sha256(raw).hexdigest(),
        "observed_geography_ids": ids,
        "observed_geography_id_count": len(ids),
    }


def main() -> None:
    if not TOKEN.startswith("sk."):
        fail("MAPBOX_UPLOAD_TOKEN must be the existing secret sk.* publication token")

    generated: dict[str, Any] = {
        "schema": "argentina-poverty-atlas.mapbox-browser-diagnostic/v1",
        "levels": {},
    }

    for level, profile in PROFILES.items():
        proof_path = Path(profile["proof"])
        proof = json.loads(proof_path.read_text(encoding="utf-8"))
        tileset_id = proof["tileset_id"]
        source_layer = proof["source_layer"]
        coverage = proof["lowzoom_coverage_proof"]
        expected_ids = set(coverage["observed_geography_ids"])

        nonempty_tiles = []
        observed_ids: set[str] = set()
        for z, x, y in profile["candidates"]:
            evidence = inspect_tile(tileset_id, source_layer, z, x, y)
            if evidence is None:
                continue
            nonempty_tiles.append(evidence)
            observed_ids.update(evidence["observed_geography_ids"])

        expected_nonempty_count = int(coverage["nonempty_tile_count"])
        if len(nonempty_tiles) != expected_nonempty_count:
            fail(
                f"{level}: candidate coverage mismatch; proof expected "
                f"{expected_nonempty_count} nonempty tiles but candidates yielded "
                f"{len(nonempty_tiles)}: {nonempty_tiles}"
            )
        if observed_ids != expected_ids:
            missing = sorted(expected_ids - observed_ids)
            extra = sorted(observed_ids - expected_ids)
            fail(
                f"{level}: candidate tile ID union drifted from existing proof; "
                f"missing={missing[:20]}, extra={extra[:20]}"
            )

        coverage["nonempty_tiles"] = nonempty_tiles
        chosen = max(
            nonempty_tiles,
            key=lambda item: (
                int(item["observed_geography_id_count"]),
                int(item["bytes"]),
            ),
        )
        generated["levels"][level] = {
            "tileset_id": tileset_id,
            "source_layer": source_layer,
            "known_nonempty_tile": {
                "z": chosen["z"],
                "x": chosen["x"],
                "y": chosen["y"],
                "bytes_server_proof": chosen["bytes"],
                "sha256_server_proof": chosen["sha256"],
                "observed_geography_id_count_server": chosen[
                    "observed_geography_id_count"
                ],
            },
            "all_lowzoom_nonempty_tiles": [
                {
                    "z": item["z"],
                    "x": item["x"],
                    "y": item["y"],
                    "bytes_server_proof": item["bytes"],
                    "sha256_server_proof": item["sha256"],
                    "observed_geography_id_count_server": item[
                        "observed_geography_id_count"
                    ],
                }
                for item in nonempty_tiles
            ],
        }
        proof_path.write_text(
            json.dumps(proof, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        print(
            f"PASS {level}: exact low-zoom nonempty tiles "
            + ", ".join(
                f"z{item['z']}/{item['x']}/{item['y']} "
                f"bytes={item['bytes']} ids={item['observed_geography_id_count']}"
                for item in nonempty_tiles
            )
        )

    OUTPUT.write_text(
        json.dumps(generated, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote browser diagnostic fixture: {OUTPUT}")


if __name__ == "__main__":
    main()
