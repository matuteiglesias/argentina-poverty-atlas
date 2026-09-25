from __future__ import annotations

import json
import os
import time
from datetime import UTC, datetime
from pathlib import Path

import mercantile
import mapbox_vector_tile
from shapely.geometry import shape

import scripts.publish_w3_mapbox as base


MAPBOX_USERNAME = os.environ.get("MAPBOX_USERNAME", "matuteiglesias2")
UPSTREAM_COMMIT = os.environ.get("UPSTREAM_COMMIT", "")
INPUT_ROOT = Path(os.environ.get("DEPARTMENT_RELEASE_DIR", "/tmp/indec-2010-department"))
INPUT_GEOJSON = INPUT_ROOT / "geography.geojson"
UPSTREAM_MANIFEST = INPUT_ROOT / "manifest.json"
MANIFEST_PATH = Path(
    os.environ.get("DEPARTMENT_W3_MANIFEST", "mapbox/manifests/department-w3.json")
)
PROOF_PATH = Path(
    os.environ.get(
        "DEPARTMENT_W3_PROOF",
        "mapbox/manifests/department-w3-publication-proof.json",
    )
)

DATASET_ID = "arggeo.indec.census.2010.department-footprint"
RELEASE_VERSION = "derived-2010-national-c9184f47fd46"
CANONICAL_ARTIFACT_SHA256 = "67a99a61aa50031b30a40d962247b1bc83b12ee50d6a79949817ef1fa1d5faed"
EXPECTED_ID_SET_SHA256 = "f2c1195789c5d556db3379dd89310b0b6cea4df84ef6efa14cc814dbfc831144"
TILESET_SLUG = "arg-dept-cpv2010"
TILESET_ID = f"{MAPBOX_USERNAME}.{TILESET_SLUG}"
TILESET_NAME = "Argentina departments - CPV 2010"
EXPECTED_PROPERTIES = {
    "geography_id",
    "geo_uid",
    "native_id",
    "department_2010_id",
    "province_2010_id",
}


def sha256_file(path: Path) -> str:
    return base.sha256_file(path)


def load_expected_ids() -> tuple[str, ...]:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    ids = manifest.get("fixture_geography_ids")
    if not isinstance(ids, list) or len(ids) != 525:
        raise RuntimeError("Department transport manifest must pin exactly 525 geography IDs")
    if len(set(ids)) != 525 or not all(isinstance(value, str) and len(value) == 5 and value.isdigit() for value in ids):
        raise RuntimeError("Department transport IDs must be unique five-digit strings")
    return tuple(sorted(ids))


def validate_upstream_release(expected_ids: tuple[str, ...]) -> tuple[dict, dict]:
    if not UPSTREAM_COMMIT or len(UPSTREAM_COMMIT) != 40:
        raise RuntimeError("UPSTREAM_COMMIT must pin the merged argentina-geography commit")
    manifest = json.loads(UPSTREAM_MANIFEST.read_text(encoding="utf-8"))
    dataset = manifest.get("dataset", {})
    identity = manifest.get("department_identity", {})
    display = manifest.get("display_derivative", {})
    if dataset.get("dataset_id") != DATASET_ID:
        raise RuntimeError("Unexpected upstream department dataset")
    if dataset.get("version") != RELEASE_VERSION:
        raise RuntimeError("Unexpected upstream department release version")
    if dataset.get("content_sha256") != CANONICAL_ARTIFACT_SHA256:
        raise RuntimeError("Canonical department GeoParquet hash drift")
    if identity.get("feature_count") != 525:
        raise RuntimeError("Upstream department release must contain 525 features")
    if identity.get("id_set_sha256") != EXPECTED_ID_SET_SHA256:
        raise RuntimeError("Upstream governed department ID-set hash drift")
    if display.get("crs") != "EPSG:4326":
        raise RuntimeError("Mapbox display derivative must be EPSG:4326")
    if display.get("feature_count") != 525:
        raise RuntimeError("Display derivative must contain 525 features")
    if display.get("poverty_values_embedded") is not False:
        raise RuntimeError("Upstream display derivative must be poverty-free")
    observed_display_hash = sha256_file(INPUT_GEOJSON)
    if display.get("content_sha256") != observed_display_hash:
        raise RuntimeError("Upstream display derivative hash mismatch")

    payload = json.loads(INPUT_GEOJSON.read_text(encoding="utf-8"))
    features = payload.get("features")
    if payload.get("type") != "FeatureCollection" or not isinstance(features, list):
        raise RuntimeError("Department display derivative is not a FeatureCollection")
    if len(features) != 525:
        raise RuntimeError(f"Expected 525 department features, found {len(features)}")

    observed_ids: list[str] = []
    representative_points: dict[str, tuple[float, float]] = {}
    for feature in features:
        properties = feature.get("properties")
        if not isinstance(properties, dict) or set(properties) != EXPECTED_PROPERTIES:
            raise RuntimeError("Department display property contract drift")
        geography_id = properties.get("geography_id")
        if not isinstance(geography_id, str) or len(geography_id) != 5 or not geography_id.isdigit():
            raise RuntimeError("Department geography_id must be a five-digit string")
        if feature.get("id") != geography_id:
            raise RuntimeError(f"Feature ID differs from geography_id={geography_id}")
        if properties.get("native_id") != geography_id:
            raise RuntimeError(f"native_id differs from geography_id={geography_id}")
        if properties.get("department_2010_id") != geography_id:
            raise RuntimeError(f"department_2010_id differs from geography_id={geography_id}")
        if properties.get("province_2010_id") != geography_id[:2]:
            raise RuntimeError(f"province prefix mismatch for geography_id={geography_id}")
        geometry = shape(feature.get("geometry"))
        if geometry.is_empty or not geometry.is_valid:
            raise RuntimeError(f"Unusable geometry for geography_id={geography_id}")
        minx, miny, maxx, maxy = geometry.bounds
        if not (-180 <= minx <= maxx <= 180 and -90 <= miny <= maxy <= 90):
            raise RuntimeError(f"Non-WGS84 coordinate bounds for geography_id={geography_id}")
        point = geometry.representative_point()
        representative_points[geography_id] = (float(point.x), float(point.y))
        observed_ids.append(geography_id)

    if tuple(sorted(observed_ids)) != expected_ids:
        raise RuntimeError("Upstream display ID inventory differs from Atlas governed 525-set")
    return manifest, {
        "display_sha256": observed_display_hash,
        "representative_points": representative_points,
    }


def create_and_wait_for_upload(staged_url: str) -> dict:
    created = base.request_json(
        "POST",
        f"/uploads/v1/{MAPBOX_USERNAME}",
        payload={"tileset": TILESET_ID, "url": staged_url, "name": TILESET_NAME},
        label="Mapbox department upload creation",
    )
    upload_id = created.get("id")
    if not isinstance(upload_id, str) or not upload_id:
        raise RuntimeError("Mapbox department upload did not return an upload ID")
    if created.get("tileset") != TILESET_ID:
        raise RuntimeError("Mapbox department upload targeted an unexpected tileset")

    last_progress: object = object()
    for attempt in range(300):
        status = base.request_json(
            "GET",
            f"/uploads/v1/{MAPBOX_USERNAME}/{upload_id}",
            label="Mapbox department upload status",
        )
        if status.get("error"):
            raise RuntimeError(f"Mapbox department upload failed: {status['error']}")
        if status.get("complete") is True:
            if status.get("progress") != 1:
                raise RuntimeError("Mapbox upload completed without progress=1")
            return status
        progress = status.get("progress")
        if progress != last_progress or attempt % 12 == 0:
            print(
                f"Department upload pending: id={upload_id}, progress={progress!r}, "
                f"poll={attempt + 1}/300"
            )
            last_progress = progress
        time.sleep(5)
    raise RuntimeError("Department Mapbox upload exceeded bounded 25-minute polling window")


def prove_vector_ids(
    source_layer: str,
    expected_ids: tuple[str, ...],
    representative_points: dict[str, tuple[float, float]],
    tilejson: dict,
) -> dict:
    minzoom = int(tilejson.get("minzoom", 0))
    maxzoom = int(tilejson.get("maxzoom", 14))
    start_zoom = max(minzoom, 6)
    end_zoom = min(maxzoom, 10)
    if end_zoom < start_zoom:
        start_zoom = end_zoom = maxzoom

    all_observed: set[str] = set()
    steps: list[dict] = []
    expected = set(expected_ids)
    for zoom in range(start_zoom, end_zoom + 1):
        tiles = {
            mercantile.tile(lon, max(-85.05112878, min(85.05112878, lat)), zoom)
            for lon, lat in representative_points.values()
        }
        zoom_ids: set[str] = set()
        nonempty = 0
        for tile in sorted(tiles, key=lambda value: (value.x, value.y)):
            raw = base.request_bytes(
                f"/v4/{TILESET_ID}/{tile.z}/{tile.x}/{tile.y}.mvt",
                label=f"Mapbox department tile z{tile.z}/{tile.x}/{tile.y}",
                allow_not_found=True,
            )
            if not raw:
                continue
            nonempty += 1
            decoded = mapbox_vector_tile.decode(raw)
            layer = decoded.get(source_layer)
            if not isinstance(layer, dict):
                continue
            for feature in layer.get("features", []):
                value = feature.get("properties", {}).get("geography_id")
                if value is not None:
                    zoom_ids.add(str(value))
        unexpected = sorted(zoom_ids - expected)
        if unexpected:
            raise RuntimeError(f"Published department tiles expose unexpected IDs: {unexpected[:20]}")
        all_observed.update(zoom_ids)
        steps.append(
            {
                "zoom": zoom,
                "requested_tile_count": len(tiles),
                "nonempty_tile_count": nonempty,
                "observed_id_count": len(zoom_ids),
                "cumulative_id_count": len(all_observed),
            }
        )
        if all_observed == expected:
            break

    if all_observed != expected:
        missing = sorted(expected - all_observed)
        raise RuntimeError(
            f"Published vector proof recovered {len(all_observed)}/525 IDs; "
            f"missing {missing[:30]}"
        )
    return {
        "expected_geography_ids": list(expected_ids),
        "observed_geography_ids": sorted(all_observed),
        "exact_id_set_match": True,
        "steps": steps,
    }


def write_proof(
    upstream_manifest: dict,
    upstream: dict,
    upload: dict,
    tilejson: dict,
    source_layer: str,
    identity_proof: dict,
) -> None:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    manifest["status"] = "published"
    manifest["inspected_at"] = datetime.now(UTC).date().isoformat()
    manifest["upstream_audit"]["commit_sha"] = UPSTREAM_COMMIT
    manifest["upstream_audit"]["finding"] = (
        "Merged argentina-geography department product was materialized from the governed "
        "official Census-2010 radio parent, verified detached, and its WGS84 geometry-only "
        "display derivative was used without Atlas-side dissolve or identity repair."
    )
    manifest["parent_release"].update(
        {
            "commit_sha": UPSTREAM_COMMIT,
            "display_geojson_sha256": upstream["display_sha256"],
        }
    )
    manifest["mapbox"] = {
        "style_url": "mapbox://styles/mapbox/standard",
        "tileset_id": TILESET_ID,
        "source_layer": source_layer,
        "feature_id_property": "geography_id",
        "published_feature_count": 525,
        "publication_time": upload.get("modified")
        or upload.get("created")
        or datetime.now(UTC).isoformat(),
        "publication_job_id": upload.get("id"),
    }
    MANIFEST_PATH.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    proof = {
        "schema": "argentina-poverty-atlas.mapbox-publication-proof/v1",
        "transport_id": "department-w3",
        "parent": {
            "repository": "matuteiglesias/argentina-geography",
            "commit_sha": UPSTREAM_COMMIT,
            "dataset_id": DATASET_ID,
            "release_version": RELEASE_VERSION,
            "canonical_geoparquet_sha256": CANONICAL_ARTIFACT_SHA256,
            "display_geojson_sha256": upstream["display_sha256"],
            "department_id_set_sha256": EXPECTED_ID_SET_SHA256,
            "feature_count": 525,
            "source_parent": upstream_manifest.get("parent_release"),
        },
        "mapbox": {
            "username": MAPBOX_USERNAME,
            "tileset_id": TILESET_ID,
            "upload_id": upload.get("id"),
            "upload_complete": upload.get("complete"),
            "upload_progress": upload.get("progress"),
            "source_layer": source_layer,
            "tilejson_minzoom": tilejson.get("minzoom"),
            "tilejson_maxzoom": tilejson.get("maxzoom"),
            "tilejson_vector_layers": tilejson.get("vector_layers"),
        },
        "identity_proof": identity_proof,
        "payload_policy": {
            "upstream_property_fields": sorted(EXPECTED_PROPERTIES),
            "poverty_values_embedded": False,
            "atlas_side_dissolve": False,
        },
        "proved_at": datetime.now(UTC).isoformat(),
    }
    PROOF_PATH.parent.mkdir(parents=True, exist_ok=True)
    PROOF_PATH.write_text(
        json.dumps(proof, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def main() -> None:
    if not base.MAPBOX_ACCESS_TOKEN:
        raise RuntimeError("MAPBOX_UPLOAD_TOKEN is required")
    if not base.MAPBOX_ACCESS_TOKEN.startswith("sk."):
        raise RuntimeError("MAPBOX_UPLOAD_TOKEN must be a secret sk.* credential")

    expected_ids = load_expected_ids()
    upstream_manifest, upstream = validate_upstream_release(expected_ids)
    print("Verified upstream 525-department WGS84 display derivative.")

    base.TILESET_ID = TILESET_ID
    staged_url = base.stage_geojson(INPUT_GEOJSON)
    upload = create_and_wait_for_upload(staged_url)
    tilejson = base.load_tilejson()
    layers = tilejson.get("vector_layers")
    if not isinstance(layers, list) or len(layers) != 1:
        raise RuntimeError(f"Expected one department vector source layer, found {layers!r}")
    source_layer = layers[0].get("id")
    if not isinstance(source_layer, str) or not source_layer:
        raise RuntimeError("Department TileJSON source layer has no ID")
    fields = layers[0].get("fields", {})
    if isinstance(fields, dict) and "geography_id" not in fields:
        raise RuntimeError("Published department TileJSON does not advertise geography_id")

    identity_proof = prove_vector_ids(
        source_layer,
        expected_ids,
        upstream["representative_points"],
        tilejson,
    )
    write_proof(
        upstream_manifest,
        upstream,
        upload,
        tilejson,
        source_layer,
        identity_proof,
    )
    print("Department Mapbox identity proof complete: 525/525 geography IDs.")


if __name__ == "__main__":
    main()
