# Argentina Poverty Atlas

Public interactive atlas for governed poverty estimates in Argentina.

The goal is simple to state: let a visitor understand **how much poverty is estimated, how it changes over time, where it is concentrated, and where the number comes from**—without exposing the implementation complexity required to produce a defensible estimate.

The atlas is the presentation and map-delivery layer of a larger scientific system. It consumes versioned poverty and geography releases; it does **not** calculate poverty, train models, sample Census microdata, produce poverty lines or own geographic authority.

```text
poverty-estimate-release/v2        argentina-geography
            │                              │
            └────────── exact IDs ─────────┘
                           │
                           ▼
                Argentina Poverty Atlas
                           │
                    Mapbox + web UI
```

## Fixture-first development

The first complete atlas will use **synthetic data for all 24 Argentine jurisdictions** and several synthetic periods.

That fixture exists to prove the real architecture end-to-end:

- national headline;
- time series;
- province choropleth;
- poverty/indigence selection;
- persons/households selection;
- FGT incidence/gap/severity;
- exact geography-ID join;
- Mapbox hover/selection;
- methodology/lineage UX;
- responsive and accessible behavior.

> **Fixture values are demonstration data only. They are not poverty estimates and must never be presented as observed, research or official statistics.**

When real sampler/model/poverty releases arrive, replacing the fixture should be an artifact-selection change rather than a frontend rewrite.

## Product direction

This should feel like a modern illustrated statistical atlas—not an internal dashboard.

The default visitor journey is:

1. read a national poverty estimate and context;
2. see its evolution through time;
3. explore territorial variation on a map;
4. inspect a province;
5. open methodology, quality and lineage when desired;
6. share/cite the exact view/release.

Mapbox provides rendering and geometry delivery. Scientific authority remains upstream.

## Read before implementation

- [`AGENTS.md`](AGENTS.md) — repository authority and engineering rules
- [`SYSTEM.yaml`](SYSTEM.yaml) — estate/system boundary
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system and runtime architecture
- [`docs/PRODUCT_UX.md`](docs/PRODUCT_UX.md) — target public experience
- [`docs/DATA_CONTRACT.md`](docs/DATA_CONTRACT.md) — poverty/geography release boundary
- [`docs/MAPBOX_OPERATIONS.md`](docs/MAPBOX_OPERATIONS.md) — Mapbox transport and runtime design
- [`docs/DELIVERY_PLAN.md`](docs/DELIVERY_PLAN.md) — W0–W8 development program
- [`SECURITY.md`](SECURITY.md) — credential and public-data policy

## Technology direction

The application uses the current React + TypeScript Vite template family, Tailwind CSS, local shadcn/ui-style primitives and Mapbox GL JS behind a dedicated map module.

```text
Vite + React + TypeScript
Tailwind + shadcn/ui-style local components
Mapbox GL JS
Vitest
static/Vercel-compatible deployment
```

Mapbox remains optional for deterministic CI verification: the data projection and exact-ID join contracts are tested without a browser token. A live map requires the separately governed public runtime configuration. No backend, database, auth or CMS is required until a concrete product need appears.

## Local development

Requires Node.js 22 or newer.

```bash
npm ci
npm run dev
```

Verification is intentionally Mapbox-free:

```bash
npm run verify
```

That command runs lint, TypeScript checking, unit tests and the production build. No Mapbox token or other credential is required.

The UI is data-driven from validated static release projections. The checked-in projection path verifies release identity, checksums, scientific status and exact geography joins before build; runtime components remain independent of the upstream producer implementation. Synthetic/demo releases and research releases retain their own explicit status and limitations.

## Current completion edge

The application and data boundary now implement the intended end-to-end seam:

```text
validated poverty release projection
        +
exact governed geography IDs
        ↓
Mapbox runtime exact-ID join
        ↓
one choropleth and accessible non-map view
```

Changing period, concept, universe or estimand updates the same runtime map rather than creating a new style or tileset. The remaining province W3 gate is operational: publish and record the geometry-only Mapbox transport, then verify exact IDs in the restricted public browser. See `docs/W3_GEOMETRY_TRANSPORT.md`.

## Security note

Do not copy credentials from legacy Poverty notebooks. A historical Mapbox write token was exposed in public repository history and must be treated as compromised. New write credentials belong only in secret storage; the browser gets only a dedicated restricted public token.

## Status

The frontend shell, deterministic release projection, producer-independent release adapter and exact-ID map runtime are implemented. The application supports explicit synthetic/demo and research-release states and can be verified without Mapbox credentials.

The live province Mapbox transport remains fail-closed at `ready_for_publication` until provider publication and restricted-browser proof are recorded. See `docs/W3_GEOMETRY_TRANSPORT.md` for that gate and `docs/DELIVERY_PLAN.md` for the broader W0–W8 program.
