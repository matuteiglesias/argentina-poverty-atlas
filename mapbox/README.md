# Mapbox surface

This directory is reserved for governed Mapbox transport and publication assets.

Target contents as implementation progresses:

```text
mapbox/
  recipes/
  publisher/
  manifests/
  fixtures/
```

## W0 legacy census

`legacy_asset_inventory.yaml` is the pinned repository-evidence census of the
historical Poverty Mapbox estate. It records the exact legacy repository commit,
recipe hashes, last-observed source/tileset/style identities, classifications and
retirement gates without copying any historical secret token.

See `../docs/W0_SECURITY_AND_LEGACY_MAPBOX.md` for credential status and the
external-account handoff. The inventory does not prove live Mapbox account state;
live resources must be reconciled before retirement.

## What belongs here

- MTS recipes checked into Git;
- source/tileset publication scripts;
- geometry transport manifests;
- bounded Mapbox-specific validation;
- fixture configuration needed to prove runtime joins.

## What does not belong here

- scientific poverty computation;
- Census or geography normalization;
- copied secret tokens;
- one style JSON per poverty measure;
- unpublished personal Studio experimentation presented as production authority.

See `../docs/MAPBOX_OPERATIONS.md` before adding publication code.
