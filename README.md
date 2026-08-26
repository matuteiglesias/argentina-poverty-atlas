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

The W1 application seed uses the current React + TypeScript Vite template family, Tailwind CSS and local shadcn/ui-style primitives. Mapbox remains deliberately absent until the geometry transport wave.

```text
Vite + React + TypeScript
Tailwind + shadcn/ui-style local components
Vitest
static/Vercel-compatible deployment
```

No backend, database, auth or CMS is required until a concrete product need appears.

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

The W1 UI uses an in-memory synthetic fixture to exercise public route/query state, headline metrics, a time-series placeholder, all 24 jurisdiction IDs, province selection/detail, and an accessible tabular fallback. W2 will replace that module with a deterministic fixture release artifact without changing the presentation boundary.

## First observable target

The first meaningful end-to-end proof is:

```text
deterministic synthetic province poverty fixture
        +
one exact 24-jurisdiction Geography Release
        ↓
Mapbox runtime exact-ID join
        ↓
one choropleth in the atlas UI
```

Changing period or poverty → indigence should recolor **the same map instance**. It must not create a new Mapbox style or tileset.

## Security note

Do not copy credentials from legacy Poverty notebooks. A historical Mapbox write token was exposed in public repository history and must be treated as compromised. New write credentials belong only in secret storage; the browser gets only a dedicated restricted public token.

## Status

**W1 frontend application seed in progress on top of the merged W0 repository baseline.** The structural public UI remains fixture-driven and requires no Mapbox credential; W0's external account actions remain separately governed. See `docs/DELIVERY_PLAN.md` for the W0–W8 program.
