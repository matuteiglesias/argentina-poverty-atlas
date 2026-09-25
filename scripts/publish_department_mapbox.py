from __future__ import annotations

import json
from pathlib import Path

import publish_w3_mapbox as publisher

MANIFEST = Path("mapbox/manifests/department-w3.json")
manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
expected_ids = tuple(str(value) for value in manifest["fixture_geography_ids"])
if len(expected_ids) != 525 or len(set(expected_ids)) != 525:
    raise RuntimeError("department transport manifest must pin exactly 525 unique IDs")
if not all(len(value) == 5 and value.isdigit() for value in expected_ids):
    raise RuntimeError("department transport IDs must remain zero-preserving five-digit strings")

publisher.INPUT_GEOJSON = Path("/tmp/indec-2010-department/geography.geojson")
publisher.MANIFEST_PATH = MANIFEST
publisher.PROOF_PATH = Path("mapbox/manifests/department-w3-publication-proof.json")
publisher.UPSTREAM_REPOSITORY = "matuteiglesias/argentina-geography"
publisher.UPSTREAM_COMMIT = "5b8ee5f9ccaa6a7b1bd94127c37733782cc70c68"
publisher.DATASET_ID = "arggeo.indec.census.2010.department-footprint"
publisher.RELEASE_VERSION = "derived-2010-national-c9184f47fd46"
publisher.GEOGRAPHY_VERSION = "2010-national-c9184f47fd46"
publisher.SOURCE_SHA256 = "c9184f47fd46c8a47e2c15e5c734b7b6ceb660ce737e18430691f6fbff3c53e8"
publisher.ARTIFACT_SHA256 = "7b6664f59d0f4f82937d52ca8fe01a22b1f4dc40d83bc49c608dfd1b40b390c5"
publisher.DISPLAY_SHA256 = "399033eb5bd79337959f2d3483f6843c71551726723308a6bcc4c7889fe27df8"
publisher.TILESET_SLUG = "arg-dept-indec2010-c9184f47fd46"
publisher.TILESET_ID = f"{publisher.MAPBOX_USERNAME}.{publisher.TILESET_SLUG}"
publisher.TILESET_NAME = "Argentina departments - INDEC Census 2010 c9184f47fd46"
publisher.TRANSPORT_ID = "department-w3"
publisher.GEOGRAPHY_LEVEL = "department"
publisher.BLOCKER_ISSUE = "https://github.com/matuteiglesias/argentina-geography/pull/41"
publisher.IDENTITY_RULE = "geography_id = department_2010_id = native_id"
publisher.UPSTREAM_FINDING = (
    "Exact Census-2010 department release provides 525 governed features, display labels, "
    "a deterministic WGS84 geometry-only derivative, and detached real-source verification."
)
publisher.EXPECTED_IDS = expected_ids
publisher.EXPECTED_PROPERTIES = {
    "geography_id",
    "geo_uid",
    "native_id",
    "department_2010_id",
    "department_name",
    "province_2010_id",
    "province_name",
}


if __name__ == "__main__":
    publisher.main()
