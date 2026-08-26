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

See `docs/MAPBOX_OPERATIONS.md` before adding publication code.
