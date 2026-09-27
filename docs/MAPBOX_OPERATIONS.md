# Mapbox operating model

## Purpose

Mapbox is the atlas rendering and geometry-delivery provider. It is not the source of poverty truth and must not become the release registry for scientific estimates.

## Legacy lesson

The historical poverty workflow used Mapbox effectively but coupled several concerns:

```text
poverty result
  → GeoJSON generation
  → Mapbox tileset sources
  → tilesets per universe/date
  → cloned/mutated style JSON
  → style per measure/universe
  → standalone HTML map
```

The new atlas should preserve the useful cartographic knowledge while removing the style/resource explosion.

## Target model

```text
one stable basemap/style
        +
one/few stable geometry tilesets
        +
runtime poverty facts keyed by geography_id
        ↓
Mapbox feature state / runtime layer styling
```

Changing period, universe, poverty/indigence or FGT estimand must not require creating a new Mapbox style.

## Geometry transport

The first proof should publish or reuse one exact province/jurisdiction geometry release with a stable feature property:

```text
geography_id
```

The transport manifest should record:

```text
geography_release_id
source_snapshot/content identity
Mapbox tileset ID
source-layer name
feature_id_property
publication time
publication job/status
```

If Mapbox geometry transport is rebuilt, the exact upstream Geography Release must remain independently inspectable.

## Mapbox GL runtime

Recommended source configuration pattern:

```text
vector source
  url: mapbox://<account>.<tileset>
  promoteId: geography_id
```

Recommended atlas layers:

```text
poverty-fill
poverty-border
poverty-hover
poverty-selected
```

The selected fact set is indexed by `geography_id` and written to feature state, e.g. conceptually:

```text
map.setFeatureState(feature, { estimate, qualityStatus })
```

The fill layer reads `feature-state.estimate` through a sequential interpolation expression.

## Basemap

The commissioned default is **Mapbox Light v11** as a quiet classic 2D basemap beneath atlas-owned poverty layers. It provides roads, labels, coastlines and orientation without making Mapbox Standard's richer import/3D renderer a prerequisite for the scientific surface.

Layer ordering is intentional: poverty fill sits beneath contextual line/symbol layers where practical, while atlas boundaries/interaction remain legible.

A minimal blank style is retained as a reliability fallback. If the contextual basemap fails, the scientific overlay should continue to render without changing the geometry transport or poverty release.

Mapbox Standard may remain available for experimentation, but it is not the production dependency.

Do not clone/own a full basemap style merely to change poverty colors.

### Browser lifecycle invariant

Do not construct the Mapbox instance until its DOM container has nonzero width and height. Commissioning reproduced a blank-but-data-ready map with a container reported as `806×0`; the geometry source, layers and all province IDs were already loaded.

The production runtime therefore waits for a nonzero box and keeps Mapbox synchronized with `ResizeObserver`. A WebGL context restoration must re-enter source/geography readiness checks; it must not directly declare the map ready.

## Choropleth scales

The scale is atlas-owned presentation semantics.

V0 rules:

- one sequential palette;
- fixed/comparable domain across fixture periods by default;
- explicit no-data color/state;
- legend labels in percentages for FGT0/1/2 proportions;
- selected and hover boundaries must remain visible across the full palette;
- values outside the configured domain must clamp visibly/deterministically, never silently change the scale.

Later releases may provide recommended domains, but the atlas must keep the presentation rule explicit and versioned.

## Zoom/resolution

The legacy system successfully used different geographic layers by zoom. Preserve that idea only when science supports it.

Possible future transport:

```text
z 0–4   province
z 4–8   department
z 8+    finer geography only if an approved estimate exists
```

The existence of a fine geometry layer does not authorize displaying a fine poverty estimate.

## Publication pipeline

Do not publish Mapbox resources from a notebook.

Target workflow:

```text
manual/workflow dispatch
  → verify upstream Geography Release
  → generate/validate MTS source projection
  → publish/update tileset
  → wait/check processing job
  → verify feature IDs and expected coverage
  → emit geography_transport.json
```

Mapbox recipes and publication scripts belong in this repository.

The workflow should be idempotent where practical and must never delete an old production tileset before the replacement is proven.

## Human-in-the-loop operations

Mapbox Studio/UI remains useful for human visual inspection.

A human may:

- inspect published tilesets;
- verify layer names/features;
- tune a base style intentionally;
- confirm token/domain settings;
- monitor publication jobs.

But production identity must be recoverable from repository configuration/manifests rather than depending on undocumented Studio state.

## Credentials

Two distinct credential classes:

### Browser token

A public (`pk...`) token is expected in client code/config, but should be dedicated to this atlas, minimally scoped and URL-restricted to approved deployment domains.

### Publication token

A secret token capable of tileset/style writes must exist only in secret storage/CI environment.

Never commit or echo it.

## Legacy credential incident

The historical public poverty notebook contains a secret Mapbox token in repository history. Treat that credential as compromised and rotate/revoke it before relying on Mapbox write operations for the new atlas.

Do not copy any token from the historical notebook into this repository.

## Legacy asset migration

Do not wipe old tilesets/styles at the start.

Inventory them first and classify:

```text
keep as parity evidence
superseded by new geometry transport
superseded by runtime styling
unknown / inspect manually
```

Only delete/retire resources once one new fixture map and one real map are independently proven.

## Acceptance proof for Mapbox W2/W3

The first complete Mapbox proof is successful when:

1. 24 jurisdiction features are rendered from one pinned geometry transport;
2. every geometry feature exposes exact `geography_id`;
3. the deterministic fixture has exactly matching IDs;
4. changing fixture period recolors the same map instance;
5. changing poverty → indigence recolors the same map instance;
6. no new style/tileset is created for that state change;
7. hover and selection return the correct feature/value;
8. no secret credential reaches the browser or Git history.
