#!/usr/bin/env bash
set -euo pipefail

source_dir="${1:?usage: scripts/vendor-poverty-release.sh /path/to/poverty-estimate-release-v2}"
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
target="$repo_root/data/releases/active"

required=(
  poverty_estimates.csv
  capabilities.json
  geography_join_contract.json
  release_manifest.json
  run_qa.json
  LIMITATIONS.md
  checksums.sha256
)

for name in "${required[@]}"; do
  test -f "$source_dir/$name" || {
    echo "missing required release file: $source_dir/$name" >&2
    exit 1
  }
done

rm -rf "$target"
mkdir -p "$target"
for name in "${required[@]}"; do
  cp "$source_dir/$name" "$target/$name"
done

cd "$repo_root"
POVERTY_RELEASE_DIR="$target" node scripts/ingest-poverty-release.mjs
npm run verify
git diff --check

echo "Vendored and verified aggregate poverty release in data/releases/active"
