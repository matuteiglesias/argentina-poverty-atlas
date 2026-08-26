# Architecture — Argentina Poverty Atlas

## System idea

The atlas is the terminal public consumer of a governed scientific pipeline.

```text
samplerCensoARG            income-model promotion / inference
      │                                  │
      └──────────────┬───────────────────┘
                     ▼
              indice-pobreza-UBA
                     │
                     │ poverty-estimate-release/v2
                     ▼
          ARGENTINA POVERTY ATLAS
                 ╱             ╲
                ╱               ╲
 poverty facts                   argentina-geography
 geography IDs                   Geography Release
                ╲               ╱
                 ╲             ╱
                exact ID join
                     │
                     ▼
              Mapbox GL JS
                     │
                     ▼
                public web
```

The atlas owns the **join for presentation**, not the scientific or geographic meaning of either parent.

## Parent 1 — poverty facts

The preferred input is a verified `poverty-estimate-release/v2` containing fact rows such as:

```text
period
universe
concept
estimand
geography_level
geography_id
estimate
uncertainty_status
...
```

The atlas must not re-run poverty classification, FGT measurement or sample-weight estimation.

## Parent 2 — geography

The geography parent is one exact compatible Geography Release from `argentina-geography`.

For the first end-to-end proof we use **province/jurisdiction geography** because:

- there are only 24 units;
- every unit is human-recognizable;
- map behavior is easy to inspect;
- fixture errors are obvious;
- it proves the exact-ID boundary without pretending the first public scientific release must be province-level.

Future approved levels may include departments or finer units, but the app must never infer that a finer map layer is scientifically publishable merely because geometry exists.

## Three independent lifecycles

```text
scientific estimate lifecycle
poverty release 2026-Q1 → 2026-Q2 → ...

geometry lifecycle
province geography release A → B only when source/normalization changes

application lifecycle
atlas web v1 → v2 → ...
```

A new poverty estimate must not require re-tiling Argentina.
A geography refresh must not recalculate poverty.
A frontend deployment must not mutate either scientific parent.

## Atlas release

The atlas should eventually build a small, deterministic presentation release:

```text
atlas_manifest.json
catalog.json
facts/<release>.json or parquet-derived static projection
map/geography_transport.json
COPY.md / methodology metadata
checksums.sha256
```

This projection may rename fields for UI convenience only when the original identity remains recoverable.

## Frontend architecture

Initial direction:

```text
Vite
React
TypeScript
Tailwind
shadcn/ui components
Mapbox GL JS 3.x
small chart library
```

No backend is required for the initial product.

Runtime modules should separate:

```text
src/data/
  catalog loading
  fact loading
  schema validation
  release selection

src/map/
  Mapbox initialization
  geometry source configuration
  feature-state join
  choropleth expression
  hover/selection

src/atlas/
  measure semantics
  URL state
  formatting
  comparison logic

src/components/
  presentation only
```

Mapbox calls should not be scattered through arbitrary React components.

## Runtime join

Preferred pattern:

1. vector geometry features expose stable `geography_id`;
2. the source config promotes that ID as feature identity;
3. selected poverty facts are indexed by `geography_id`;
4. the app writes the selected estimate into feature state;
5. one stable fill layer styles `feature-state.estimate`;
6. changing period/measure updates feature state, not the Mapbox style resource.

Conceptually:

```text
geography_id → estimate
       │
       ▼
feature-state
       │
       ▼
interpolate expression
       │
       ▼
choropleth
```

This replaces the legacy pattern of creating separate tilesets/styles/HTML pages for every universe and measure.

## Basemap

Prefer a stable Mapbox-maintained basemap (Mapbox Standard unless a concrete compatibility issue appears) with atlas-owned runtime layers above it.

The atlas should not clone the entire basemap style merely to change the poverty variable.

## URL as interface

Explorer state must be shareable and deterministic. Target shape:

```text
/explorar?period=2026-Q1&universe=persons&concept=poverty&estimand=fgt0&level=province_2010
```

Invalid or unavailable states should normalize to a documented default rather than silently showing another measure.

## Deployment model

The preferred first deployment is static and CDN-friendly:

```text
build time:
  validate fixture/release
  produce compact static atlas data
  build frontend

browser:
  load catalog
  load selected fact data
  initialize one Mapbox instance
  join selected measure to geometry
```

No database, auth, server action or API should be introduced without a concrete requirement.

## Reliability principles

- Fail visibly on incompatible geography IDs.
- Never render partial coverage as complete coverage without a warning/state.
- Keep scientific-status metadata next to the release.
- Keep fixture status globally visible.
- Preserve Mapbox attribution and data/provider attribution.
- Prefer deterministic build artifacts over mutable Studio state.
