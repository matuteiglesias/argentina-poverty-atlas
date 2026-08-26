# AGENTS.md — Argentina Poverty Atlas

## Mission

Build a public, interactive and scientifically transparent atlas for governed poverty estimates in Argentina.

This repository is a **presentation, visualization and map-delivery system**. It should make a complex scientific stack feel simple to use without hiding the provenance, quality or limitations of the estimates.

## Authority boundary

This repository owns:

- public information architecture and editorial presentation;
- atlas navigation and URL state;
- measure/period/universe selection UX;
- choropleth styling, legends and interaction semantics;
- Mapbox transport configuration and runtime integration;
- release-selection/catalog logic for the public app;
- map/web QA, accessibility and responsive behavior;
- public lineage, methodology and citation UX;
- synthetic fixture data used to develop and test the frontend.

This repository does **not** own:

- poverty classification or FGT definitions;
- Census sampling or population-frame construction;
- income/welfare model training, promotion or Census scoring;
- poverty-line construction;
- geography identity, geometry correction or spatial relations;
- substantive geographic crosswalk policy;
- official statistical publication.

Those responsibilities remain upstream.

## Canonical upstream contracts

The intended scientific parent is a verified `poverty-estimate-release/v2` emitted by `matuteiglesias/indice-pobreza-UBA`.

The intended geometry parent is one exact compatible Geography Release emitted by `matuteiglesias/argentina-geography`.

The atlas joins these parents by exact governed IDs. Geometry must not be copied into the poverty scientific release merely for presentation convenience.

## Fixture-first rule

Until a real poverty release is approved, the app must operate entirely on explicit synthetic fixtures.

Every fixture-driven surface must visibly identify itself as demonstration data. Fixture values must not resemble or be described as current official or research poverty estimates.

A fixture is successful when it exercises the same UI/data path that a real release will use later.

## Mapbox rules

- Browser code may use only a public Mapbox token with minimum public scopes and URL restrictions.
- Secret Mapbox tokens must never be committed, logged or bundled into the app.
- Publication credentials belong in CI/secret storage only.
- Do not create a separate Mapbox style for every measure, period or universe.
- Prefer one stable basemap plus runtime sources/layers/state.
- Poverty facts and geometry have independent lifecycles.
- Mapbox is a rendering/transport provider, not the scientific data authority.

## Product rules

The public product should feel like an atlas/editorial statistical product, not an internal admin dashboard.

Default experience:

1. answer “how much poverty?” quickly;
2. show change through time;
3. show territorial variation;
4. allow a province/place to be inspected;
5. make methodology, provenance, quality and limitations one click away.

The homepage should remain useful to a nontechnical visitor. Scientific details should be available without forcing them into the first screen.

## Scientific display rules

- Never imply that a research estimate is an official INDEC publication.
- Never fabricate uncertainty. Show `not supplied` or equivalent when unavailable.
- Do not infer population totals from a weight unless the upstream release explicitly authorizes that interpretation.
- Preserve measure identity: poverty vs indigence; households vs persons; FGT0 vs FGT1 vs FGT2.
- Human labels may say `Incidencia`, `Brecha` and `Severidad`; metadata must retain exact scientific estimand identity.
- Do not show geography finer than the release supports scientifically merely because geometry exists.

## Engineering rules

- Prefer static/client-side architecture until a concrete server-side need appears.
- Keep data adapters separate from React presentation components.
- Keep Mapbox integration behind a small map module rather than spreading Mapbox calls across the component tree.
- URL state is part of the public interface and should be stable/shareable.
- All release ingestion must validate schema/status before rendering.
- Build deterministic fixture artifacts and test exact-ID joins.
- Accessibility and mobile behavior are acceptance criteria, not polish work.

## Development discipline

Use bounded PRs. Typical wave boundaries are defined in `docs/DELIVERY_PLAN.md`.

Before changing scientific-facing semantics, re-check the current upstream contracts rather than guessing from old notebooks or legacy Mapbox assets.

Legacy `indice-pobreza-UBA` notebooks and Mapbox styles are evidence for behavior/visual parity only; they are not computational or architectural authority.
