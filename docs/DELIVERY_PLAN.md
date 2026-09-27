# Delivery plan — Argentina Poverty Atlas

The atlas should be built through bounded waves that each produce an observable proof. Do not wait for real ML/sampling outputs before building the public experience.

## Current execution edge — 2026-09-27

The map/publication last mile is closed:

- **W3 complete:** province and department geometry-only MTS transports are published and independently identity-proved (24/24 provinces; 525/525 departments at the identity zoom).
- **W4 complete:** the exact-ID browser join is commissioned with the real public token; production waits for a nonzero canvas and source/geography readiness before becoming interactive.
- **W5 map surface complete enough for public use:** the default renderer uses Mapbox Light v11 for contextual basemap detail with a blank-style reliability fallback.
- **W6 complete:** the app consumes governed Poverty release projections without producer-code import and now verifies `poverty-estimate-capabilities/v2`.
- **W7 publication gate remains explicit:** real research projections exist, but ordinary public statistical presentation is permitted only when the upstream release declares `research_public`. Current legacy projections fail closed to commissioning mode.

The fixture remains a deterministic regression surface. Future work should treat geometry transport and browser map architecture as stable infrastructure unless a new release violates their explicit contracts.

## W0 — Security and legacy Mapbox census

**Mission:** establish safe credentials and understand what already exists before publishing anything new.

Required:

- revoke/rotate the historical exposed Mapbox write token;
- create one dedicated browser token for the atlas with minimum public scopes and deployment-domain restrictions;
- create one secret publication token in GitHub Actions secret storage when Mapbox write automation is actually needed;
- inventory legacy Poverty Mapbox styles, tilesets, sources and recipes;
- classify each asset as parity evidence / reusable / superseded / unknown;
- record the current public `/Pobreza` surface and desired redirect/migration behavior.

Do not delete old Mapbox assets yet.

**DoD:** new work can proceed without copying any legacy secret and the old Mapbox estate is inspectable.

## W1 — Frontend application seed

**Mission:** make the product shell real with no Mapbox dependency required for basic rendering.

Preferred implementation:

```text
Vite + React + TypeScript
Tailwind
shadcn/ui components
small chart library
```

Required:

- initialize current stable framework versions through their official tooling;
- commit lockfile;
- add lint/type/build/test CI;
- create the editorial homepage shell;
- create `/explorar` shell;
- implement fixture banner;
- implement route/query-state model;
- create responsive header, metric block, timeline placeholder, selector controls and detail sheet using synthetic in-memory fixture data;
- add accessible tabular fallback for province values.

No Mapbox token should be required to verify the structural UI in CI.

**DoD:** deployed/local app already looks recognizably like the intended atlas using fixture numbers.

## W2 — Deterministic 24-jurisdiction fixture release

**Mission:** replace ad-hoc UI constants with a real atlas-consumable fixture artifact.

Required fixture:

```text
24 jurisdictions
6–8 periods
persons / households
poverty / indigence
FGT0 / FGT1 / FGT2
national rows
deterministic release identity
scientific_status = synthetic_fixture
not_for_interpretation = true
```

Add schema validation and a build projection into public static JSON.

Include test variants for:

- one missing geography estimate;
- one quality warning;
- invalid duplicate fact key;
- incompatible geography ID;
- uncertainty absent.

**DoD:** homepage, chart and explorer are entirely data-driven from a deterministic fixture release.

## W3 — Province geometry transport + Mapbox proof

**Mission:** prove the final geography boundary with one real Geography Release and synthetic poverty facts.

Inspect current `argentina-geography` products and choose one exact 24-jurisdiction/province parent that supplies stable IDs suitable for the fixture.

Required:

- pin exact Geography Release/version/hash;
- produce or adopt one Mapbox vector geometry transport;
- every feature exposes exact `geography_id`;
- record tileset/source-layer/feature-ID information in a transport manifest;
- one Mapbox Standard map renders all 24 jurisdictions;
- no poverty value is embedded in geometry tiles merely to satisfy the fixture.

**DoD:** real governed Argentina geometry is visible in the browser with the fixture IDs proven compatible.

## W4 — Runtime choropleth/data join

**Mission:** prove that one Mapbox instance can display every fixture measure without style proliferation.

Required:

- promote stable geography ID as Mapbox feature identity;
- join selected facts through feature state or an equivalently bounded runtime data-join pattern;
- implement poverty fill, boundary, hover and selected layers;
- implement stable sequential legend;
- period change recolors without rebuilding the map;
- poverty ↔ indigence change recolors without creating another Mapbox style;
- persons ↔ households works from the same fixture release;
- selected province detail matches fact data exactly;
- URL state restores map state.

**DoD:** fixture atlas works end-to-end through the same seam real releases will use.

## W5 — Atlas editorial UX

**Mission:** make the working map feel like the final public product rather than a technical demo.

Required:

- national headline and context;
- national time series;
- province map section on homepage;
- full explorer;
- province detail sheet with province vs national comparison;
- methodology/lineage drawer;
- data/citation actions;
- no-data and warning presentation;
- responsive/mobile map experience;
- keyboard/non-map province inspection;
- metadata-driven synthetic disclaimer.

Human review is important here: tune typography, spacing, palette and Mapbox camera behavior interactively.

**DoD:** a reviewer can judge the atlas as a product even though the values remain synthetic.

## W6 — Scientific-release adapter proof

**Mission:** prove that the atlas can consume the actual `poverty-estimate-release/v2` contract without importing Poverty code.

Start with a fixture release emitted through the Poverty v2 release builder if a real release is not ready yet.

Required:

- read/verify manifest and checksums outside the browser build where appropriate;
- deterministic atlas projection;
- preserve release identity/parents/status;
- map exact geography IDs;
- reject incompatible/missing scientific semantics rather than silently transforming them;
- ensure browser components do not know producer-specific implementation details.

**DoD:** swapping fixture source package for a verified compatible Poverty release is an artifact-selection change, not a frontend rewrite.

## W7 — First public-interpretable research release

Real governed research projections are already integrated. That is no longer the missing
proof.

The remaining W7 question is publication permission.

Required:

- consume a current `poverty-estimate-capabilities/v2` bundle;
- preserve its estimand and operation permissions exactly;
- require `permissions.interpretation = research_public` before rendering an ordinary national headline;
- keep counts, uncertainty intervals and inferential ranking disabled unless a future producer schema explicitly authorizes them;
- keep temporal presentation within the declared comparison permission;
- verify geography compatibility, coverage, quality warnings and release lineage;
- preserve fixture/demo mode for deterministic tests.

A `research_estimate` with `not_for_interpretation=true` is a valid commissioning
surface, not a failed release and not a public-statistic override opportunity.

**DoD:** an upstream-authorized `research_public` release is projected, reproducible and
traceable without Atlas expanding its scientific authority.

## W8 — Legacy public migration/decommission

Only after the public-interpretation W7 gate is proven.

Required:

- redirect or replace `matuteiglesias.link/Pobreza` intentionally;
- preserve old site evidence/screenshots/URLs where useful;
- mark legacy Mapbox notebook/style workflow superseded;
- remove obsolete publication responsibility from `indice-pobreza-UBA`;
- retire Mapbox styles/tilesets only after classifying and proving they are no longer required;
- update portfolio/system governance.

Do not delete scientific/historical evidence merely because the web surface moved.

## Parallelism

W1 and W2 can proceed immediately in parallel with upstream ML/sampler work.

W0 can proceed independently with human Mapbox UI participation.

W3/W4 can proceed as soon as a geometry transport/token path is available; they do **not** need real poverty values.

W7 waits for real scientific parents.

This separation is deliberate: frontend/product quality, map engineering and statistical production should mature concurrently through stable contracts rather than blocking one another.
