# W4 — Runtime choropleth/data join

## Mission

Prove that one Mapbox instance can render every W2 fixture selection by joining facts at runtime through exact governed geography IDs. W4 consumes W3 geometry transport; it does not publish, alter, repair or choose geometry.

## Exact W3 contract

W4 consumes W3's checked-in manifest directly:

```text
mapbox/manifests/province-w3.json
schema = argentina-poverty-atlas.geometry-transport/v1
```

The authoritative W3 validator remains `src/map/geometryTransport.ts`. W4 does not maintain a second looser parser. A runtime transport exists only when that manifest has:

```text
status = published
parent_release = exact province Geography Release
mapbox.tileset_id = non-empty
mapbox.source_layer = non-empty
mapbox.feature_id_property = geography_id
mapbox.published_feature_count = 24
fixture_geography_ids = exactly the W2 24 IDs
```

As of 2026-08-26 the W3 manifest is intentionally `blocked_upstream`: the inspected `argentina-geography` main had exact radio releases but no independently released 24-feature province Geography Release. W3 correctly refuses to manufacture that parent by dissolving radios. Therefore W4's runtime seam is implemented and testable, but the live Mapbox/browser proof remains gated on the upstream release and W3 publication.

## Runtime model

```text
one Mapbox Standard instance
        ↓
one governed vector source with promoteId = geography_id
        ↓
poverty-fill
poverty-border
poverty-hover
poverty-selected
        ↓
feature-state { estimate, qualityStatus, warningCount, selected, hovered }
```

Changing period, persons/households, poverty/indigence, or FGT estimand updates feature state on the same 24 features. It does not add another source, layer set, style, or map instance.

## Legend

W4 uses one sequential palette and explicit no-data color. The numerical domain is computed across the entire selected concept + estimand in the release, so period and persons/households changes remain comparable. Values outside the domain clamp through the Mapbox interpolation expression rather than silently changing the domain.

## Selection and URL state

The existing atlas URL parser remains authoritative for public state. On map load, the current parsed state is immediately written into feature state, so a URL containing `place=06` restores Buenos Aires as selected. Map clicks call the same `onChange({ place })` path used by the table/detail sheet.

The province detail sheet continues reading the same W2 fact index as the map. There is no second calculation path for the selected value.

## Mapbox runtime loading

W4 reuses W3's locked `mapbox-gl@3.29.0` dependency and dynamically imports the runtime only when W3 is published and a browser token exists. The app expects:

```text
VITE_MAPBOX_PUBLIC_TOKEN
```

Only a dedicated, URL-restricted public `pk.*` token belongs there. No token is required for CI, unit tests, build, or the accessible table fallback.

If W3 is blocked, the map surface exposes W3's blocker and issue instead of substituting geometry. If W3 is published but the token is absent, the map fails closed with a token-specific message. In both cases the table remains usable.

## Tests

The runtime join is tested through a narrow adapter around the Mapbox instance rather than requiring WebGL in CI. Tests prove:

- exactly four stable atlas layers are installed;
- exact two-character IDs are used as feature identity;
- URL-restored selection writes the exact W2 fact value;
- period / universe / concept / estimand changes update state without adding layers;
- legend domain is stable across periods/universes;
- W4 inherits W3's exact 24-ID compatibility gate;
- `blocked_upstream` cannot be converted into a runtime transport;
- click selection returns the promoted string ID.

## Completion gate

The code/contract portion of W4 is complete when CI is green. The full W4 DoD additionally requires W3 to become `published`, a dedicated public token to be configured, and one browser proof showing all 24 governed features with selections/recoloring on the same map instance. Until then W4 must remain explicit about the upstream block rather than calling the map end-to-end complete.
