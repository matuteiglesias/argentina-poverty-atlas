from __future__ import annotations

import hashlib
import json
import math
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import UTC, datetime
from pathlib import Path

import boto3
import mapbox_vector_tile
import mercantile
from shapely.geometry import shape

MAPBOX_USERNAME = os.environ.get("MAPBOX_USERNAME", "matuteiglesias2")
MAPBOX_ACCESS_TOKEN = os.environ.get("MAPBOX_UPLOAD_TOKEN", "")
INPUT_GEOJSON = Path(os.environ.get("W3_GEOJSON", "/tmp/ign-province-release/geography.geojson"))
MANIFEST_PATH = Path(os.environ.get("W3_MANIFEST", "mapbox/manifests/province-w3.json"))
PROOF_PATH = Path(os.environ.get("W3_PROOF", "mapbox/manifests/province-w3-publication-proof.json"))

UPSTREAM_REPOSITORY = "matuteiglesias/argentina-geography"
UPSTREAM_COMMIT = "ef315a4ca7e53eb98d9adf106b0cee190a6c5cd3"
DATASET_ID = "arggeo.ign.administrative.province"
RELEASE_VERSION = "snapshot-20260826-b9fcf6f90f28"
GEOGRAPHY_VERSION = "2026-08-26-b9fcf6f90f28"
SOURCE_SHA256 = "b9fcf6f90f28f1bdfcc713a47ad4ed63e2db0b000c4642611597d4ea8b897c55"
ARTIFACT_SHA256 = "3907e1e0e256f2ea768a66e14874266a576787fe724dad0d35eb9308ddc6dd7b"
DISPLAY_SHA256 = "c49be97fef429c9bc473681e6677135bf19307da1141b1d7f6f12c50df366ed3"
TILESET_SLUG = "arg-prov-ign-b9fcf6f90f28"
TILESET_ID = f"{MAPBOX_USERNAME}.{TILESET_SLUG}"
TILESET_NAME = "Argentina provinces — IGN b9fcf6f90f28"
EXPECTED_IDS = (
    "02", "06", "10", "14", "18", "22", "26", "30",
    "34", "38", "42", "46", "50", "54", "58", "62",
    "66", "70", "74", "78", "82", "86", "90", "94",
)
EXPECTED_PROPERTIES = {"geography_id", "geo_uid", "native_id", "FNA", "GNA", "NAM"}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def mapbox_url(path: str) -> str:
    query = urllib.parse.urlencode({"access_token": MAPBOX_ACCESS_TOKEN})
    return f"https://api.mapbox.com{path}?{query}"


def request_json(method: str, path: str, *, payload: dict | None = None, label: str) -> dict:
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    headers = {"Accept": "application/json"}
    if body is not None:
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(mapbox_url(path), data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            raw = response.read()
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:1000]
        raise RuntimeError(f"{label} failed with HTTP {exc.code}: {detail}") from None
    except urllib.error.URLError as exc:
        raise RuntimeError(f"{label} failed: {exc.reason}") from None
    result = json.loads(raw.decode("utf-8"))
    if not isinstance(result, dict):
        raise RuntimeError(f"{label} returned a non-object response")
    return result


def request_bytes(path: str, *, label: str, allow_not_found: bool = False) -> bytes:
    request = urllib.request.Request(mapbox_url(path), method="GET")
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            return response.read()
    except urllib.error.HTTPError as exc:
        if allow_not_found and exc.code == 404:
            return b""
        detail = exc.read().decode("utf-8", errors="replace")[:1000]
        raise RuntimeError(f"{label} failed with HTTP {exc.code}: {detail}") from None
    except urllib.error.URLError as exc:
        raise RuntimeError(f"{label} failed: {exc.reason}") from None


def validate_upstream_derivative(path: Path) -> tuple[dict, dict[str, object]]:
    if not path.is_file():
        raise RuntimeError(f"Upstream display derivative is missing: {path}")
    observed_hash = sha256_file(path)
    if observed_hash != DISPLAY_SHA256:
        raise RuntimeError(
            f"Upstream display derivative hash drift: expected {DISPLAY_SHA256}, found {observed_hash}"
        )

    payload = json.loads(path.read_text(encoding="utf-8"))
    if payload.get("type") != "FeatureCollection" or not isinstance(payload.get("features"), list):
        raise RuntimeError("Upstream display derivative is not a GeoJSON FeatureCollection")
    features = payload["features"]
    if len(features) != 24:
        raise RuntimeError(f"Expected 24 upstream province features, found {len(features)}")

    observed_ids: list[str] = []
    representative_points: dict[str, tuple[float, float]] = {}
    for feature in features:
        properties = feature.get("properties")
        if not isinstance(properties, dict):
            raise RuntimeError("Every upstream feature must expose properties")
        if set(properties) != EXPECTED_PROPERTIES:
            raise RuntimeError(
                "Upstream display property contract drifted: "
                f"expected {sorted(EXPECTED_PROPERTIES)}, found {sorted(properties)}"
            )
        geography_id = properties.get("geography_id")
        if not isinstance(geography_id, str):
            raise RuntimeError("Every upstream feature geography_id must be a string")
        if feature.get("id") != geography_id:
            raise RuntimeError(f"Feature id drift for geography_id={geography_id}")
        if properties.get("native_id") != geography_id:
            raise RuntimeError(f"native_id drift for geography_id={geography_id}")
        observed_ids.append(geography_id)

        geometry = feature.get("geometry")
        geom = shape(geometry)
        if geom.is_empty or not geom.is_valid:
            raise RuntimeError(f"Unusable upstream geometry for geography_id={geography_id}")
        point = geom.representative_point()
        representative_points[geography_id] = (float(point.x), float(point.y))

    if tuple(sorted(observed_ids)) != tuple(sorted(EXPECTED_IDS)):
        raise RuntimeError(
            f"Upstream province IDs drifted: expected {list(EXPECTED_IDS)}, found {sorted(observed_ids)}"
        )
    if len(set(observed_ids)) != 24:
        raise RuntimeError("Upstream display derivative contains duplicate geography_id values")

    return payload, {"representative_points": representative_points, "observed_ids": sorted(observed_ids)}


def stage_geojson(path: Path) -> str:
    credentials = request_json(
        "POST",
        f"/uploads/v1/{MAPBOX_USERNAME}/credentials",
        label="Mapbox temporary S3 credential request",
    )
    required = {"accessKeyId", "secretAccessKey", "sessionToken", "bucket", "key", "url"}
    missing = sorted(required - set(credentials))
    if missing:
        raise RuntimeError(f"Mapbox S3 credential response is missing {missing}")

    client = boto3.client(
        "s3",
        region_name="us-east-1",
        aws_access_key_id=credentials["accessKeyId"],
        aws_secret_access_key=credentials["secretAccessKey"],
        aws_session_token=credentials["sessionToken"],
    )
    client.upload_file(
        str(path),
        credentials["bucket"],
        credentials["key"],
        ExtraArgs={"ContentType": "application/geo+json"},
    )
    return str(credentials["url"])


def create_and_wait_for_upload(staged_url: str) -> dict:
    created = request_json(
        "POST",
        f"/uploads/v1/{MAPBOX_USERNAME}",
        payload={"tileset": TILESET_ID, "url": staged_url, "name": TILESET_NAME},
        label="Mapbox upload creation",
    )
    upload_id = created.get("id")
    if not isinstance(upload_id, str) or not upload_id:
        raise RuntimeError("Mapbox upload creation did not return an upload id")
    if created.get("tileset") != TILESET_ID:
        raise RuntimeError(f"Mapbox upload targeted unexpected tileset: {created.get('tileset')!r}")

    for _ in range(120):
        status = request_json(
            "GET",
            f"/uploads/v1/{MAPBOX_USERNAME}/{upload_id}",
            label="Mapbox upload status",
        )
        if status.get("error"):
            raise RuntimeError(f"Mapbox upload failed: {status['error']}")
        if status.get("complete") is True:
            if status.get("progress") != 1:
                raise RuntimeError("Mapbox marked upload complete without progress=1")
            return status
        time.sleep(5)
    raise RuntimeError("Mapbox upload did not complete within the bounded polling window")


def load_tilejson() -> dict:
    path = f"/v4/{TILESET_ID}.json&secure=true"  # replaced below to preserve token handling
    del path
    query = urllib.parse.urlencode({"secure": "", "access_token": MAPBOX_ACCESS_TOKEN})
    url = f"https://api.mapbox.com/v4/{TILESET_ID}.json?{query}"
    request = urllib.request.Request(url, method="GET")
    last_error: str | None = None
    for _ in range(60):
        try:
            with urllib.request.urlopen(request, timeout=90) as response:
                payload = json.loads(response.read().decode("utf-8"))
            if isinstance(payload, dict) and payload.get("vector_layers"):
                return payload
            last_error = "TileJSON did not yet expose vector_layers"
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")[:500]
            last_error = f"HTTP {exc.code}: {detail}"
        except urllib.error.URLError as exc:
            last_error = str(exc.reason)
        time.sleep(5)
    raise RuntimeError(f"Mapbox TileJSON was not readable after upload: {last_error}")


def _tile_path(z: int, x: int, y: int) -> str:
    return f"/v4/{TILESET_ID}/{z}/{x}/{y}.mvt"


def prove_vector_ids(
    source_layer: str,
    representative_points: dict[str, tuple[float, float]],
    tilejson: dict,
) -> dict:
    minzoom = int(tilejson.get("minzoom", 0))
    maxzoom = int(tilejson.get("maxzoom", 14))
    start_zoom = max(minzoom, 5)
    end_zoom = min(maxzoom, 10)
    if end_zoom < start_zoom:
        start_zoom = end_zoom = maxzoom

    all_observed: set[str] = set()
    proof_steps: list[dict] = []
    for zoom in range(start_zoom, end_zoom + 1):
        tiles = {
            mercantile.tile(lon, max(-85.05112878, min(85.05112878, lat)), zoom)
            for lon, lat in representative_points.values()
        }
        zoom_ids: set[str] = set()
        nonempty_tiles = 0
        for tile in sorted(tiles, key=lambda item: (item.x, item.y)):
            raw = request_bytes(
                _tile_path(tile.z, tile.x, tile.y),
                label=f"Mapbox vector tile z{tile.z}/{tile.x}/{tile.y}",
                allow_not_found=True,
            )
            if not raw:
                continue
            nonempty_tiles += 1
            decoded = mapbox_vector_tile.decode(raw)
            layer = decoded.get(source_layer)
            if not isinstance(layer, dict):
                continue
            for feature in layer.get("features", []):
                properties = feature.get("properties", {})
                geography_id = properties.get("geography_id")
                if geography_id is not None:
                    zoom_ids.add(str(geography_id))
        unexpected = sorted(zoom_ids - set(EXPECTED_IDS))
        if unexpected:
            raise RuntimeError(f"Published vector tiles expose unexpected geography IDs: {unexpected}")
        all_observed.update(zoom_ids)
        proof_steps.append(
            {
                "zoom": zoom,
                "requested_tile_count": len(tiles),
                "nonempty_tile_count": nonempty_tiles,
                "observed_geography_ids": sorted(zoom_ids),
                "cumulative_geography_id_count": len(all_observed),
            }
        )
        if all_observed == set(EXPECTED_IDS):
            break

    if all_observed != set(EXPECTED_IDS):
        missing = sorted(set(EXPECTED_IDS) - all_observed)
        raise RuntimeError(f"Published vector-tile proof did not recover all 24 geography IDs; missing {missing}")

    return {
        "expected_geography_ids": list(EXPECTED_IDS),
        "observed_geography_ids": sorted(all_observed),
        "exact_id_set_match": True,
        "steps": proof_steps,
    }


def update_manifest(upload: dict, tilejson: dict, source_layer: str, proof: dict) -> dict:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    if tuple(sorted(manifest.get("fixture_geography_ids", []))) != tuple(sorted(EXPECTED_IDS)):
        raise RuntimeError("Atlas fixture ID set changed before W3 publication")

    manifest["status"] = "published"
    manifest["inspected_at"] = datetime.now(UTC).date().isoformat()
    manifest["upstream_audit"] = {
        "repository": UPSTREAM_REPOSITORY,
        "commit_sha": UPSTREAM_COMMIT,
        "required_level": "province",
        "blocker_issue": "https://github.com/matuteiglesias/argentina-geography/issues/34",
        "finding": (
            "Issue #34 is complete. Exact IGN Provincia release provides 24 fixture-compatible "
            "features and a deterministic geometry-only GeoJSON derivative; the atlas re-materializes "
            "and hash-verifies that derivative before Mapbox publication."
        ),
        "candidate_evidence": [
            {
                "dataset_id": DATASET_ID,
                "release_version": RELEASE_VERSION,
                "level": "province",
                "source_snapshot_sha256": SOURCE_SHA256,
                "artifact_sha256": ARTIFACT_SHA256,
                "display_geojson_sha256": DISPLAY_SHA256,
                "feature_count": 24,
                "eligible_as_w3_parent": True,
                "identity_rule": "geography_id = IN1 = native_id",
            }
        ],
    }
    manifest["parent_release"] = {
        "repository": UPSTREAM_REPOSITORY,
        "commit_sha": UPSTREAM_COMMIT,
        "geography_id": f"ign:{GEOGRAPHY_VERSION}:administrative:province",
        "release_version": RELEASE_VERSION,
        "level": "province",
        "source_snapshot_sha256": SOURCE_SHA256,
        "artifact_sha256": ARTIFACT_SHA256,
        "feature_count": 24,
    }
    manifest["mapbox"] = {
        "style_url": "mapbox://styles/mapbox/standard",
        "tileset_id": TILESET_ID,
        "source_layer": source_layer,
        "feature_id_property": "geography_id",
        "published_feature_count": 24,
        "publication_time": upload.get("modified") or upload.get("created") or datetime.now(UTC).isoformat(),
        "publication_job_id": upload.get("id"),
    }
    manifest["payload_policy"] = {
        "geometry_only": True,
        "poverty_values_embedded": False,
        "required_feature_property": "geography_id",
    }
    manifest["external_gates"]["publication_credential"] = "satisfied_by_github_actions_secret"
    manifest["external_gates"]["dedicated_browser_token"] = "required_for_interactive_browser_proof"

    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    publication_proof = {
        "schema": "argentina-poverty-atlas.mapbox-publication-proof/v1",
        "transport_id": "province-w3",
        "parent": {
            "repository": UPSTREAM_REPOSITORY,
            "commit_sha": UPSTREAM_COMMIT,
            "dataset_id": DATASET_ID,
            "release_version": RELEASE_VERSION,
            "source_snapshot_sha256": SOURCE_SHA256,
            "canonical_geoparquet_sha256": ARTIFACT_SHA256,
            "display_geojson_sha256": DISPLAY_SHA256,
            "feature_count": 24,
        },
        "mapbox": {
            "username": MAPBOX_USERNAME,
            "tileset_id": TILESET_ID,
            "upload_id": upload.get("id"),
            "upload_created": upload.get("created"),
            "upload_modified": upload.get("modified"),
            "upload_complete": upload.get("complete"),
            "upload_progress": upload.get("progress"),
            "source_layer": source_layer,
            "tilejson_minzoom": tilejson.get("minzoom"),
            "tilejson_maxzoom": tilejson.get("maxzoom"),
            "tilejson_vector_layers": tilejson.get("vector_layers"),
        },
        "identity_proof": proof,
        "payload_policy": {
            "upstream_property_fields": sorted(EXPECTED_PROPERTIES),
            "poverty_values_embedded": False,
        },
        "proved_at": datetime.now(UTC).isoformat(),
    }
    PROOF_PATH.parent.mkdir(parents=True, exist_ok=True)
    PROOF_PATH.write_text(
        json.dumps(publication_proof, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    return publication_proof


def main() -> None:
    if not MAPBOX_ACCESS_TOKEN:
        raise RuntimeError("MAPBOX_UPLOAD_TOKEN is required")
    if not MAPBOX_ACCESS_TOKEN.startswith("sk."):
        raise RuntimeError("MAPBOX_UPLOAD_TOKEN must be a secret sk.* credential")

    _, upstream_proof = validate_upstream_derivative(INPUT_GEOJSON)
    print("Upstream W3 derivative verified: exact hash, exact 24 IDs, geometry-only property contract.")

    staged_url = stage_geojson(INPUT_GEOJSON)
    print("Exact upstream derivative staged in Mapbox-managed S3.")
    upload = create_and_wait_for_upload(staged_url)
    print(f"Mapbox upload complete: tileset={TILESET_ID}, upload_id={upload.get('id')}")

    tilejson = load_tilejson()
    vector_layers = tilejson.get("vector_layers")
    if not isinstance(vector_layers, list) or len(vector_layers) != 1:
        raise RuntimeError(f"Expected exactly one vector source layer, found {vector_layers!r}")
    source_layer = vector_layers[0].get("id")
    if not isinstance(source_layer, str) or not source_layer:
        raise RuntimeError("TileJSON vector source layer has no id")
    fields = vector_layers[0].get("fields", {})
    if isinstance(fields, dict) and "geography_id" not in fields:
        raise RuntimeError("Published TileJSON does not advertise geography_id")

    proof = prove_vector_ids(
        source_layer,
        upstream_proof["representative_points"],
        tilejson,
    )
    update_manifest(upload, tilejson, source_layer, proof)
    print(f"W3 Mapbox identity proof complete: 24/24 IDs via source-layer={source_layer!r}.")


if __name__ == "__main__":
    main()
