# W4 — Runtime choropleth/data join

Status: **complete and browser-commissioned**.

## Mission

Render governed poverty facts over governed geography with one stable browser map runtime. W4 consumes published W3 geometry transports; it does not republish geometry or calculate poverty.

## Runtime model

```text
Mapbox Light v11 basemap
        +
published geometry-only MTS source
        ↓
promoteId = geography_id
        ↓
poverty-fill
poverty-border
poverty-hover
poverty-selected
        ↓
feature-state { estimate, qualityStatus, warningCount, selected, hovered }
```

Changing period, persons/households, poverty/indigence, or FGT estimand updates feature state on the existing governed features. It does not create another Mapbox style or poverty-specific tileset.

## Geography readiness gate

The app does not declare `Mapa listo` merely because the base style loaded.

Readiness requires:

1. a nonzero map container;
2. full Mapbox `load`;
3. the manifested vector source to be loaded;
4. `querySourceFeatures()` to expose at least one valid governed `geography_id`;
5. only then may feature-state be applied and the runtime become interactive.

Context loss also returns the runtime to the same readiness gate instead of treating `webglcontextrestored` as proof that the source recovered.

## Canvas lifecycle

Commissioning identified a production-specific failure where Mapbox initialized while its container was `806×0`. All geometry, layers and IDs were present, but the canvas could not draw.

The runtime now:

- waits for nonzero width and height before constructing Mapbox;
- gives the map surface explicit inline dimensions independent of stylesheet timing;
- observes later container changes with `ResizeObserver`;
- calls `resize()` / repaint after real size changes.

This invariant should remain protected during future layout refactors.

## Basemap policy

Default: **Mapbox Light v11**, optimized as a lightweight 2D contextual basemap.

The poverty overlay remains atlas-owned and is inserted so roads/boundaries/labels can remain legible around the choropleth.

Fallback: a minimal blank style containing only the atlas background and scientific overlay. If the basemap provider/style path degrades, the poverty map can remain usable without changing geometry or scientific data.

Mapbox Standard is retained only as a non-default compatibility/experimentation path; it is not a dependency of the public scientific surface.

## Browser commissioning surface

`/diagnostics/mapbox` deliberately bypasses poverty state, selectors and feature-state. It proves the lower browser stack independently:

- exact known tile via public token;
- byte/SHA equality to provider proof;
- canonical vector source;
- source-layer;
- feature IDs;
- solid-fill rendering.

That page should remain small and stable so future Mapbox/token/browser incidents can be classified before production code is edited.

## Tests and deterministic CI

CI does not require a Mapbox token or WebGL. Adapter-level tests cover stable runtime layers, exact string IDs, state changes, click/hover behavior and legend semantics. The public-token/provider layer is commissioned separately through the checked-in proof artifacts and browser diagnostic.

## Completion

Province and department geometry render in the deployed browser, update from governed poverty facts, preserve URL/selection semantics and have an independent non-map/table fallback. W4 is closed.

Future cartographic tuning should change presentation only; it should not reopen transport, geography identity or scientific-release architecture.
