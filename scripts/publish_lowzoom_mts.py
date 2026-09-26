from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import mapbox_vector_tile
import mercantile
from shapely.geometry import shape

USERNAME = os.environ.get("MAPBOX_USERNAME", "matuteiglesias2")
TOKEN = os.environ.get("MAPBOX_UPLOAD_TOKEN", "")
LEVEL = os.environ.get("MTS_LEVEL", "province")
GEOJSON_PATH = Path(os.environ.get("MTS_GEOJSON", ""))
MANIFEST_PATH = Path(os.environ.get("MTS_MANIFEST", ""))
PROOF_PATH = Path(os.environ.get("MTS_PROOF", ""))

PROFILES = {
    "province": {
        "source_id": "atlas-prov-b9fcf6f90f28",
        "tileset_slug": "atlas-prov-b9fcf6f90f28-mts",
        "layer_name": "province_2010",
        "minzoom": 0,
        "maxzoom": 9,
        "proof_zoom": 2,
        "name": "Argentina provinces governed low-zoom",
    },
    "department": {
        "source_id": "atlas-dept-c9184f47fd46",
        "tileset_slug": "atlas-dept-c9184f47fd46-mts",
        "layer_name": "department_2010",
        "minzoom": 2,
        "maxzoom": 11,
        "proof_zoom": 3,
        "name": "Argentina departments governed low-zoom",
    },
}


def fail(message: str) -> None:
    raise RuntimeError(message)


def api_url(path: str) -> str:
    return f"https://api.mapbox.com{path}?{urllib.parse.urlencode({'access_token': TOKEN})}"


def request(
    method: str,
    path: str,
    *,
    body: bytes | None = None,
    content_type: str | None = None,
    expected: tuple[int, ...] = (200, 201, 202, 204),
) -> tuple[int, bytes]:
    headers = {"Accept": "application/json"}
    if content_type:
        headers["Content-Type"] = content_type
    req = urllib.request.Request(api_url(path), data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=120) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as exc:
        raw = exc.read()
        if exc.code in expected:
            return exc.code, raw
        detail = raw.decode("utf-8", errors="replace")[:1500]
        if exc.code == 403 and "tilesets" in path:
            detail += (
                " | The secret token likely lacks Mapbox tilesets:write/tilesets:read scopes. "
                "Extend MAPBOX_UPLOAD_TOKEN with those scopes; never use the public pk.* token."
            )
        raise RuntimeError(
            f"Mapbox {method} {path} failed with HTTP {exc.code}: {detail}"
        ) from None


def request_json(
    method: str,
    path: str,
    *,
    payload: Any | None = None,
    expected: tuple[int, ...] = (200, 201, 202, 204),
) -> dict:
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    status, raw = request(
        method,
        path,
        body=body,
        content_type="application/json" if body is not None else None,
        expected=expected,
    )
    if status == 204 or not raw:
        return {}
    value = json.loads(raw.decode("utf-8"))
    if not isinstance(value, dict):
        fail(f"Expected JSON object from Mapbox {method} {path}")
    return value


def load_geojson() -> tuple[dict, list[str], dict[str, tuple[float, float]]]:
    if not GEOJSON_PATH.is_file():
        fail(f"Missing governed GeoJSON: {GEOJSON_PATH}")
    payload = json.loads(GEOJSON_PATH.read_text(encoding="utf-8"))
    if payload.get("type") != "FeatureCollection" or not isinstance(
        payload.get("features"), list
    ):
        fail("Governed geometry is not a GeoJSON FeatureCollection")

    ids: list[str] = []
    representatives: dict[str, tuple[float, float]] = {}
    for feature in payload["features"]:
        properties = feature.get("properties") or {}
        geography_id = properties.get("geography_id")
        if not isinstance(geography_id, str) or not geography_id:
            fail("Every feature must expose string geography_id")
        if geography_id in representatives:
            fail(f"Duplicate geography_id {geography_id}")
        geometry = shape(feature.get("geometry"))
        if geometry.is_empty or not geometry.is_valid:
            fail(f"Invalid geometry for {geography_id}")
        point = geometry.representative_point()
        ids.append(geography_id)
        representatives[geography_id] = (float(point.x), float(point.y))
    return payload, ids, representatives


def to_ldgeojson(payload: dict) -> bytes:
    lines = [
        json.dumps(feature, ensure_ascii=False, separators=(",", ":"))
        for feature in payload["features"]
    ]
    return ("\n".join(lines) + "\n").encode("utf-8")


def load_tilejson(tileset_id: str) -> dict:
    query = urllib.parse.urlencode({"secure": "", "access_token": TOKEN})
    url = f"https://api.mapbox.com/v4/{tileset_id}.json?{query}"
    last_error = "unknown"
    for _ in range(60):
        try:
            with urllib.request.urlopen(url, timeout=90) as response:
                value = json.loads(response.read().decode("utf-8"))
            if isinstance(value, dict) and value.get("vector_layers"):
                return value
            last_error = "TileJSON has no vector_layers yet"
        except Exception as exc:
            last_error = str(exc)
        time.sleep(5)
    fail(f"TileJSON unavailable after MTS publish: {last_error}")


def load_tile(tileset_id: str, z: int, x: int, y: int) -> bytes:
    query = urllib.parse.urlencode({"access_token": TOKEN})
    url = f"https://api.mapbox.com/v4/{tileset_id}/{z}/{x}/{y}.mvt?{query}"
    req = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=90) as response:
            return response.read()
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            return b""
        detail = exc.read().decode("utf-8", errors="replace")[:1000]
        raise RuntimeError(
            f"Vector tile z{z}/{x}/{y} failed HTTP {exc.code}: {detail}"
        ) from None


def prove_zoom(
    tileset_id: str,
    layer_name: str,
    representatives: dict[str, tuple[float, float]],
    expected_ids: set[str],
    zoom: int,
) -> dict:
    tiles = {
        mercantile.tile(
            lon,
            max(-85.05112878, min(85.05112878, lat)),
            zoom,
        )
        for lon, lat in representatives.values()
    }
    observed: set[str] = set()
    nonempty = 0
    for tile in sorted(tiles, key=lambda item: (item.x, item.y)):
        raw = load_tile(tileset_id, tile.z, tile.x, tile.y)
        if not raw:
            continue
        nonempty += 1
        decoded = mapbox_vector_tile.decode(raw)
        layer = decoded.get(layer_name)
        if not isinstance(layer, dict):
            continue
        for feature in layer.get("features", []):
            geography_id = (feature.get("properties") or {}).get("geography_id")
            if geography_id is not None:
                observed.add(str(geography_id))

    missing = sorted(expected_ids - observed)
    unexpected = sorted(observed - expected_ids)
    if missing or unexpected:
        fail(
            f"Low-zoom proof failed at z{zoom}: "
            f"observed={len(observed)}/{len(expected_ids)}, "
            f"missing={missing[:20]}, unexpected={unexpected[:20]}"
        )

    return {
        "zoom": zoom,
        "requested_tile_count": len(tiles),
        "nonempty_tile_count": nonempty,
        "observed_geography_ids": sorted(observed),
        "exact_id_set_match": True,
    }


def main() -> None:
    if LEVEL not in PROFILES:
        fail(f"MTS_LEVEL must be one of {sorted(PROFILES)}")
    if not TOKEN.startswith("sk."):
        fail("MAPBOX_UPLOAD_TOKEN must be a secret sk.* token")
    if not MANIFEST_PATH.is_file():
        fail(f"Missing atlas transport manifest: {MANIFEST_PATH}")

    profile = PROFILES[LEVEL]
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    expected_ids = set(str(value) for value in manifest["fixture_geography_ids"])
    payload, observed_ids, representatives = load_geojson()
    if set(observed_ids) != expected_ids:
        fail(
            f"Governed GeoJSON ID set drift: expected {len(expected_ids)}, "
            f"observed {len(set(observed_ids))}"
        )

    source_id = str(profile["source_id"])
    tileset_id = f"{USERNAME}.{profile['tileset_slug']}"
    layer_name = str(profile["layer_name"])
    source_uri = f"mapbox://tileset-source/{USERNAME}/{source_id}"

    ldgeojson = to_ldgeojson(payload)
    print(
        f"Uploading governed {LEVEL} source to MTS: "
        f"{source_uri}; bytes={len(ldgeojson)}"
    )
    request(
        "PUT",
        f"/tilesets/v1/sources/{USERNAME}/{source_id}",
        body=ldgeojson,
        content_type="application/json",
        expected=(200, 201),
    )

    recipe = {
        "version": 1,
        "layers": {
            layer_name: {
                "source": source_uri,
                "minzoom": int(profile["minzoom"]),
                "maxzoom": int(profile["maxzoom"]),
            }
        },
    }
    request_json(
        "PUT",
        "/tilesets/v1/validateRecipe",
        payload=recipe,
        expected=(200,),
    )

    create_payload = {
        "recipe": recipe,
        "name": profile["name"],
        "private": False,
        "description": (
            "Governed geometry-only transport for Argentina Poverty Atlas; "
            "no poverty values embedded."
        ),
    }
    status, raw = request(
        "POST",
        f"/tilesets/v1/{tileset_id}",
        body=json.dumps(create_payload).encode("utf-8"),
        content_type="application/json",
        expected=(200, 201, 409),
    )
    if status == 409:
        print(f"MTS tileset already exists; updating recipe: {tileset_id}")
        request_json(
            "PATCH",
            f"/tilesets/v1/{tileset_id}/recipe",
            payload=recipe,
            expected=(204,),
        )
        request_json(
            "PATCH",
            f"/tilesets/v1/{tileset_id}",
            payload={"name": profile["name"], "private": False},
            expected=(200, 204),
        )
    else:
        print(f"Created MTS tileset: {tileset_id}")
        if raw:
            print(raw.decode("utf-8", errors="replace")[:500])

    publish = request_json(
        "POST",
        f"/tilesets/v1/{tileset_id}/publish",
        expected=(200, 201, 202),
    )
    job_id = publish.get("jobId")
    if not isinstance(job_id, str) or not job_id:
        fail(f"MTS publish did not return jobId: {publish}")
    print(f"MTS publish queued: tileset={tileset_id}, job={job_id}")

    job: dict | None = None
    for poll in range(240):
        job = request_json(
            "GET",
            f"/tilesets/v1/{tileset_id}/jobs/{job_id}",
            expected=(200,),
        )
        stage = job.get("stage")
        if poll % 6 == 0 or stage in {"success", "failed", "superseded"}:
            print(f"MTS job stage={stage!r} poll={poll + 1}/240")
        if stage == "success":
            break
        if stage in {"failed", "superseded"}:
            fail(
                f"MTS publish ended at stage={stage}: "
                f"errors={job.get('errors')}, warnings={job.get('warnings')}"
            )
        time.sleep(5)
    else:
        fail("MTS publish did not finish within 20 minutes")

    tilejson = load_tilejson(tileset_id)
    vector_layers = tilejson.get("vector_layers")
    if not isinstance(vector_layers, list) or not any(
        isinstance(layer, dict) and layer.get("id") == layer_name
        for layer in vector_layers
    ):
        fail(
            f"TileJSON does not expose expected layer {layer_name!r}: "
            f"{vector_layers!r}"
        )

    observed_minzoom = int(tilejson.get("minzoom", 99))
    if observed_minzoom > int(profile["minzoom"]):
        fail(
            f"TileJSON minzoom drift: expected <= {profile['minzoom']}, "
            f"observed {observed_minzoom}"
        )

    lowzoom_proof = prove_zoom(
        tileset_id,
        layer_name,
        representatives,
        expected_ids,
        int(profile["proof_zoom"]),
    )

    now = datetime.now(UTC).isoformat()
    manifest["mapbox"].update(
        {
            "tileset_id": tileset_id,
            "source_layer": layer_name,
            "published_feature_count": len(expected_ids),
            "publication_time": now,
            "publication_job_id": job_id,
        }
    )
    manifest["external_gates"]["publication_credential"] = (
        "satisfied_by_github_actions_secret"
    )
    MANIFEST_PATH.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    proof = {
        "schema": "argentina-poverty-atlas.mapbox-mts-publication-proof/v1",
        "transport_id": manifest["transport_id"],
        "provider": "mapbox-tiling-service",
        "tileset_id": tileset_id,
        "tileset_source": source_uri,
        "source_layer": layer_name,
        "recipe": recipe,
        "job": {
            "id": job_id,
            "stage": job.get("stage") if isinstance(job, dict) else None,
            "warnings": job.get("warnings", []) if isinstance(job, dict) else [],
        },
        "tilejson": {
            "minzoom": tilejson.get("minzoom"),
            "maxzoom": tilejson.get("maxzoom"),
            "vector_layers": vector_layers,
        },
        "lowzoom_identity_proof": lowzoom_proof,
        "expected_feature_count": len(expected_ids),
        "payload_policy": {
            "geometry_only": True,
            "poverty_values_embedded": False,
            "required_feature_property": "geography_id",
        },
        "proved_at": now,
    }
    PROOF_PATH.parent.mkdir(parents=True, exist_ok=True)
    PROOF_PATH.write_text(
        json.dumps(proof, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    print(
        f"PASS: MTS low-zoom proof for {LEVEL}: "
        f"{len(expected_ids)}/{len(expected_ids)} IDs at z{profile['proof_zoom']}; "
        f"tileset={tileset_id}; TileJSON minzoom={tilejson.get('minzoom')}"
    )


if __name__ == "__main__":
    main()
