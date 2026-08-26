from __future__ import annotations

import json
import os
from pathlib import Path

import pandas as pd

CATALOG_PATH = Path(
    os.environ.get("W3_UPSTREAM_CATALOG", "/tmp/ign-province-release/geography_catalog.parquet")
)
MANIFEST_PATH = Path(os.environ.get("W3_MANIFEST", "mapbox/manifests/province-w3.json"))
PROOF_PATH = Path(
    os.environ.get("W3_PROOF", "mapbox/manifests/province-w3-publication-proof.json")
)
EXPECTED_DATASET_ID = "arggeo.ign.administrative.province"
EXPECTED_RELEASE_VERSION = "snapshot-20260826-b9fcf6f90f28"


def scalar(row: pd.Series, name: str) -> str:
    value = row[name]
    if pd.isna(value):
        raise RuntimeError(f"Upstream catalog field {name} is missing")
    text = str(value)
    if not text:
        raise RuntimeError(f"Upstream catalog field {name} is empty")
    return text


def main() -> None:
    catalog = pd.read_parquet(CATALOG_PATH)
    if len(catalog) != 1:
        raise RuntimeError(f"Expected one upstream geography catalog row, found {len(catalog)}")
    row = catalog.iloc[0]
    dataset_id = scalar(row, "dataset_id")
    release_version = scalar(row, "release_version")
    geography_id = scalar(row, "geography_id")
    if dataset_id != EXPECTED_DATASET_ID:
        raise RuntimeError(f"Unexpected upstream dataset_id: {dataset_id}")
    if release_version != EXPECTED_RELEASE_VERSION:
        raise RuntimeError(f"Unexpected upstream release_version: {release_version}")

    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    parent = manifest.get("parent_release")
    if not isinstance(parent, dict):
        raise RuntimeError("W3 manifest has no published parent_release to finalize")
    parent["dataset_id"] = dataset_id
    parent["geography_id"] = geography_id
    parent["release_version"] = release_version
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    proof = json.loads(PROOF_PATH.read_text(encoding="utf-8"))
    proof_parent = proof.get("parent")
    if not isinstance(proof_parent, dict):
        raise RuntimeError("W3 publication proof has no parent section")
    proof_parent["dataset_id"] = dataset_id
    proof_parent["geography_id"] = geography_id
    proof_parent["release_version"] = release_version
    PROOF_PATH.write_text(json.dumps(proof, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(f"Upstream geography identity pinned from catalog: {geography_id}@{release_version}")


if __name__ == "__main__":
    main()
