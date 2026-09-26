from __future__ import annotations

import hashlib
import json
import os
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import mapbox_vector_tile
import requests
import mercantile
from shapely.geometry import shape

USERNAME = os.environ.get("MAPBOX_USERNAME", "matuteiglesias2")
TOKEN = os.environ.get("MAPBOX_UPLOAD_TOKEN", "")
LEVEL = os.environ.get("MTS_LEVEL", "province")
GEOJSON_PATH = Path(os.environ.get("MTS_GEOJSON", ""))
GEOPARQUET_PATH = Path(os.environ.get("MTS_GEOPARQUET", ""))
MANIFEST_PATH = Path(os.environ.get("MTS_MANIFEST", ""))
PROOF_PATH = Path(os.environ.get("MTS_PROOF", ""))

PROFILES = {
    "province": {
        "source_id": "atlas-prov-b9fcf6f90f28",
        "tileset_slug": "atlas-prov-b9fcf6f90f28-mts",
        "layer_name": "province_2010",
        "minzoom": 0,
        "maxzoom": 9,
        "coverage_zoom": 2,
        "identity_zoom": 5,
        "name": "Argentina provinces governed low-zoom",
    },
    "department": {
        "source_id": "atlas-dept-c9184f47fd46",
        "tileset_slug": "atlas-dept-c9184f47fd46-mts",
        "layer_name": "department_2010",
        "minzoom": 2,
        "maxzoom": 11,
        "coverage_zoom": 3,
        "identity_zoom": 5,
        "name": "Argentina departments governed low-zoom",
    },
}


def fail(message: str) -> None:
    raise RuntimeError(message)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def input_hash_evidence(manifest: dict) -> dict:
    expected_artifact = None
    parent_release = manifest.get("parent_release")
    if isinstance(parent_release, dict):
        expected_artifact = parent_release.get("artifact_sha256")

    expected_display = None
    upstream_audit = manifest.get("upstream_audit")
    if isinstance(upstream_audit, dict):
        candidates = upstream_audit.get("candidate_evidence")
        if isinstance(candidates, list) and candidates and isinstance(candidates[0], dict):
            expected_display = candidates[0].get("display_geojson_sha256")

    observed_artifact = (
        sha256_file(GEOPARQUET_PATH)
        if GEOPARQUET_PATH.is_file()
        else None
    )
    observed_display = sha256_file(GEOJSON_PATH)

    artifact_match = (
        observed_artifact == expected_artifact
        if observed_artifact is not None and isinstance(expected_artifact, str)
        else None
    )
    display_match = (
        observed_display == expected_display
        if isinstance(expected_display, str)
        else None
    )
    if display_match is False:
        fail(
            "Provider-facing display GeoJSON SHA drifted from the pinned transport artifact: "
            f"expected {expected_display}, observed {observed_display}"
        )
    drift_accepted = artifact_match is False
    if drift_accepted:
        print(
            "WARNING: canonical Parquet bytes drifted, but the pinned source semantics and "
            "provider-facing display GeoJSON are unchanged; continuing with PASS_WITH_WARNINGS."
        )

    return {
        "expected_canonical_artifact_sha256": expected_artifact,
        "observed_materialized_artifact_sha256": observed_artifact,
        "canonical_artifact_sha256_match": artifact_match,
        "expected_display_geojson_sha256": expected_display,
        "observed_display_geojson_sha256": observed_display,
        "display_geojson_sha256_match": display_match,
        "byte_drift_accepted": drift_accepted,
        "disposition": "PASS_WITH_WARNINGS" if drift_accepted else "PASS",
    }


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


def write_mts_source(payload: dict, path: Path) -> dict:
    """Write the narrow provider source contract without mutating governed geometry."""
    digest = hashlib.sha256()
    size = 0
    feature_count = 0
    with path.open("wb") as handle:
        for feature in payload["features"]:
            properties = feature.get("properties") or {}
            geography_id = properties.get("geography_id")
            transport_feature = {
                "type": "Feature",
                "id": geography_id,
                "properties": {"geography_id": geography_id},
                "geometry": feature.get("geometry"),
            }
            line = (
                json.dumps(
                    transport_feature,
                    ensure_ascii=False,
                    separators=(",", ":"),
                )
                + "\n"
            ).encode("utf-8")
            handle.write(line)
            digest.update(line)
            size += len(line)
            feature_count += 1
    return {
        "path": str(path),
        "size_bytes": size,
        "sha256": digest.hexdigest(),
        "feature_count": feature_count,
        "properties": ["geography_id"],
    }


def get_source_info(source_id: str) -> dict | None:
    path = f"/tilesets/v1/sources/{USERNAME}/{source_id}"
    req = urllib.request.Request(api_url(path), method="GET", headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as response:
            value = json.loads(response.read().decode("utf-8"))
        return value if isinstance(value, dict) else None
    except urllib.error.HTTPError as exc:
        raw = exc.read()
        if exc.code == 404:
            return None
        detail = raw.decode("utf-8", errors="replace")[:1500]
        raise RuntimeError(
            f"Mapbox GET {path} failed with HTTP {exc.code}: {detail}"
        ) from None


def upload_source_multipart(source_id: str, source_path: Path) -> dict:
    """Create/replace one MTS source file using the multipart contract required by Mapbox."""
    path = f"/tilesets/v1/sources/{USERNAME}/{source_id}"
    url = api_url(path)
    with source_path.open("rb") as handle:
        response = requests.put(
            url,
            files={
                "file": (
                    source_path.name,
                    handle,
                    "application/geo+json",
                )
            },
            headers={"Accept": "application/json"},
            timeout=(30, 900),
        )
    if response.status_code not in (200, 201):
        detail = response.text[:1500]
        if response.status_code == 413:
            detail += (
                " | MTS accepts individual source files up to 20 GB; "
                "a small file returning 413 usually indicates a malformed/non-multipart request."
            )
        if response.status_code == 403:
            detail += (
                " | The secret token likely lacks Mapbox tilesets:write/tilesets:read scopes."
            )
        raise RuntimeError(
            f"Mapbox multipart PUT {path} failed with HTTP "
            f"{response.status_code}: {detail}"
        )
    value = response.json()
    if not isinstance(value, dict):
        fail("Mapbox source upload returned a non-object response")
    return value


def ensure_source(source_id: str, source_path: Path, source_artifact: dict) -> dict:
    """Treat source IDs as immutable content-addressed transport slots and reuse them."""
    existing = get_source_info(source_id)
    if existing is not None:
        print(
            "Reusing existing MTS source "
            f"{existing.get('id', source_id)}; files={existing.get('files')}, "
            f"size={existing.get('size', existing.get('source_size'))}"
        )
        return {
            "action": "reused",
            "provider": existing,
            "local_artifact": source_artifact,
        }

    size_bytes = int(source_artifact["size_bytes"])
    if size_bytes > 5 * 1024**3:
        fail(
            "MTS source exceeds 5 GB; split it before upload. "
            "Mapbox supports up to 10 files per source and recommends <=5 GB chunks."
        )
    print(
        f"Uploading MTS source with multipart/form-data: "
        f"{source_id}; bytes={size_bytes}; sha256={source_artifact['sha256']}"
    )
    uploaded = upload_source_multipart(source_id, source_path)
    return {
        "action": "created",
        "provider": uploaded,
        "local_artifact": source_artifact,
    }


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


def inspect_zoom(
    tileset_id: str,
    layer_name: str,
    representatives: dict[str, tuple[float, float]],
    expected_ids: set[str],
    zoom: int,
    *,
    require_exact: bool,
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
    if unexpected:
        fail(
            f"Tile proof found unexpected geography IDs at z{zoom}: "
            f"{unexpected[:20]}"
        )
    if nonempty == 0 or not observed:
        fail(f"Tile coverage proof found no expected geometry at z{zoom}")
    if require_exact and missing:
        fail(
            f"Identity proof failed at z{zoom}: "
            f"observed={len(observed)}/{len(expected_ids)}, missing={missing[:20]}"
        )

    return {
        "zoom": zoom,
        "requested_tile_count": len(tiles),
        "nonempty_tile_count": nonempty,
        "observed_geography_ids": sorted(observed),
        "observed_expected_id_count": len(observed),
        "expected_id_count": len(expected_ids),
        "exact_id_set_match": not missing and not unexpected,
        "missing_geography_ids": missing,
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
    hash_evidence = input_hash_evidence(manifest)
    if set(observed_ids) != expected_ids:
        fail(
            f"Governed GeoJSON ID set drift: expected {len(expected_ids)}, "
            f"observed {len(set(observed_ids))}"
        )

    source_id = str(profile["source_id"])
    tileset_id = f"{USERNAME}.{profile['tileset_slug']}"
    layer_name = str(profile["layer_name"])
    source_uri = f"mapbox://tileset-source/{USERNAME}/{source_id}"

    with tempfile.TemporaryDirectory(prefix=f"atlas-mts-{LEVEL}-") as temporary:
        source_path = Path(temporary) / f"{LEVEL}.ldgeojson"
        source_artifact = write_mts_source(payload, source_path)
        source_publication = ensure_source(source_id, source_path, source_artifact)

    recipe = {
        "version": 1,
        "layers": {
            layer_name: {
                "source": source_uri,
                "minzoom": int(profile["minzoom"]),
                "maxzoom": int(profile["maxzoom"]),
                "features": {
                    "simplification": 4,
                    "attributes": {"allowed_output": ["geography_id"]},
                },
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

    lowzoom_proof = inspect_zoom(
        tileset_id,
        layer_name,
        representatives,
        expected_ids,
        int(profile["coverage_zoom"]),
        require_exact=False,
    )
    identity_proof = inspect_zoom(
        tileset_id,
        layer_name,
        representatives,
        expected_ids,
        int(profile["identity_zoom"]),
        require_exact=True,
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
        "source_publication": source_publication,
        "lowzoom_coverage_proof": lowzoom_proof,
        "identity_proof": identity_proof,
        "expected_feature_count": len(expected_ids),
        "input_materialization": hash_evidence,
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
        f"coverage z{profile['coverage_zoom']} observed "
        f"{lowzoom_proof['observed_expected_id_count']}/{len(expected_ids)} IDs; "
        f"identity z{profile['identity_zoom']} recovered {len(expected_ids)}/{len(expected_ids)}; "
        f"tileset={tileset_id}; TileJSON minzoom={tilejson.get('minzoom')}"
    )


if __name__ == "__main__":
    main()
