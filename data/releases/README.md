# Vendored public poverty release

Production may consume one verified aggregate `poverty-estimate-release/v2` from `data/releases/active/`.

This directory is intentionally limited to the public aggregate release boundary. It must not contain Census/EPH microdata, household-level welfare predictions, or other row-level research inputs.

Required files:

- `poverty_estimates.csv`
- `capabilities.json`
- `geography_join_contract.json`
- `release_manifest.json`
- `run_qa.json`
- `LIMITATIONS.md`
- `checksums.sha256`

The build verifies checksums, schema, research status, uncertainty status, exact geography joins, exactly 300 facts, and exactly 24 province IDs before exposing the release.

Vercel production builds are fail-closed: if neither `POVERTY_RELEASE_DIR` nor this vendored aggregate release is present, the build fails rather than publishing fixture data.
