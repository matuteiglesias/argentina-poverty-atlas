from __future__ import annotations

import gzip
import json
import urllib.parse
import urllib.request
import sys
from datetime import UTC, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import mapbox_vector_tile
import mercantile

import scripts.publish_w3_mapbox as publisher


def list_uploads() -> list[dict]:
    query = urllib.parse.urlencode({"access_token": publisher.MAPBOX_ACCESS_TOKEN})
    url = f"https://api.mapbox.com/uploads/v1/{publisher.MAPBOX_USERNAME}?{query}"
    request = urllib.request.Request(url, method="GET", headers={"Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=90) as response:
        payload = json.loads(response.read().decode("utf-8"))
    if not isinstance(payload, list):
        raise RuntimeError("Mapbox uploads listing returned a non-list response")
    return [item for item in payload if isinstance(item, dict)]


def recover_completed_upload() -> dict:
    candidates = [
        item
        for item in list_uploads()
        if item.get("tileset") == publisher.TILESET_ID
        and item.get("complete") is True
        and item.get("progress") == 1
        and not item.get("error")
    ]
    if not candidates:
        raise RuntimeError(
            f"No completed Mapbox upload found for immutable tileset {publisher.TILESET_ID}"
        )
    candidates.sort(key=lambda item: str(item.get("modified") or item.get("created") or ""))
    return candidates[-1]


def tile_bounds(tilejson: dict) -> tuple[float, float, float, float]:
    value = tilejson.get("bounds")
    if isinstance(value, list) and len(value) == 4:
        west, south, east, north = (float(x) for x in value)
    else:
        west, south, east, north = (-74.0, -85.05112878, -25.0, -21.7)
    south = max(-85.05112878, south)
    north = min(85.05112878, north)
    return west, south, east, north


def prove_all_ids(tilejson: dict, source_layer: str) -> dict:
    expected = set(publisher.EXPECTED_IDS)
    minzoom = int(tilejson.get("minzoom", 0))
    maxzoom = int(tilejson.get("maxzoom", 14))
    start_zoom = max(minzoom, 4)
    end_zoom = min(maxzoom, 8)
    if end_zoom < start_zoom:
        start_zoom = end_zoom = maxzoom

    west, south, east, north = tile_bounds(tilejson)
    observed: set[str] = set()
    steps: list[dict] = []

    for zoom in range(start_zoom, end_zoom + 1):
        zoom_ids: set[str] = set()
        requested = 0
        nonempty = 0
        for tile in mercantile.tiles(west, south, east, north, [zoom]):
            requested += 1
            raw = publisher.request_bytes(
                publisher._tile_path(tile.z, tile.x, tile.y),
                label=f"Mapbox vector tile z{tile.z}/{tile.x}/{tile.y}",
                allow_not_found=True,
            )
            if not raw:
                continue
            if raw.startswith(b"\x1f\x8b"):
                raw = gzip.decompress(raw)
            nonempty += 1
            decoded = mapbox_vector_tile.decode(raw)
            layer = decoded.get(source_layer)
            if not isinstance(layer, dict):
                continue
            for feature in layer.get("features", []):
                properties = feature.get("properties", {})
                geography_id = properties.get("geography_id")
                if geography_id is not None:
                    zoom_ids.add(str(geography_id))

        unexpected = sorted(zoom_ids - expected)
        if unexpected:
            raise RuntimeError(f"Published tiles expose unexpected geography IDs: {unexpected}")
        observed.update(zoom_ids)
        steps.append(
            {
                "zoom": zoom,
                "requested_tile_count": requested,
                "nonempty_tile_count": nonempty,
                "observed_geography_ids": sorted(zoom_ids),
                "cumulative_geography_id_count": len(observed),
            }
        )
        if observed == expected:
            break

    if observed != expected:
        missing = sorted(expected - observed)
        raise RuntimeError(
            f"Existing Mapbox tileset did not prove all 24 geography IDs; missing {missing}"
        )

    return {
        "expected_geography_ids": list(publisher.EXPECTED_IDS),
        "observed_geography_ids": sorted(observed),
        "exact_id_set_match": True,
        "recovery_mode": "existing_completed_upload_full_bounds_scan",
        "steps": steps,
    }


def finalize_parent_identity() -> None:
    manifest = json.loads(publisher.MANIFEST_PATH.read_text(encoding="utf-8"))
    parent = manifest.get("parent_release")
    if not isinstance(parent, dict):
        raise RuntimeError("Recovered manifest has no parent_release")
    parent["dataset_id"] = publisher.DATASET_ID
    parent["geography_id"] = f"ign:{publisher.GEOGRAPHY_VERSION}:administrative:province"
    publisher.MANIFEST_PATH.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )

    proof = json.loads(publisher.PROOF_PATH.read_text(encoding="utf-8"))
    proof_parent = proof.get("parent")
    if not isinstance(proof_parent, dict):
        raise RuntimeError("Recovered proof has no parent section")
    proof_parent["dataset_id"] = publisher.DATASET_ID
    proof_parent["geography_id"] = f"ign:{publisher.GEOGRAPHY_VERSION}:administrative:province"
    proof["recovered_at"] = datetime.now(UTC).isoformat()
    proof["recovery_note"] = (
        "Recovered the completed immutable Aug-2026 Mapbox upload after the original "
        "workflow timed out; no mutable IGN re-download or provider rewrite was used."
    )
    publisher.PROOF_PATH.write_text(
        json.dumps(proof, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )


def main() -> None:
    if not publisher.MAPBOX_ACCESS_TOKEN:
        raise RuntimeError("MAPBOX_UPLOAD_TOKEN is required")
    upload = recover_completed_upload()
    tilejson = publisher.load_tilejson()
    vector_layers = tilejson.get("vector_layers")
    if not isinstance(vector_layers, list) or len(vector_layers) != 1:
        raise RuntimeError(f"Expected one vector source layer, found {vector_layers!r}")
    source_layer = vector_layers[0].get("id")
    if not isinstance(source_layer, str) or not source_layer:
        raise RuntimeError("Mapbox TileJSON source layer is missing")
    fields = vector_layers[0].get("fields", {})
    if not isinstance(fields, dict) or "geography_id" not in fields:
        raise RuntimeError("Mapbox TileJSON does not advertise geography_id")

    proof = prove_all_ids(tilejson, source_layer)
    publisher.update_manifest(upload, tilejson, source_layer, proof)
    finalize_parent_identity()
    print(
        f"Recovered published W3 transport: {publisher.TILESET_ID}; "
        f"24/24 exact geography IDs via {source_layer!r}."
    )


if __name__ == "__main__":
    main()
