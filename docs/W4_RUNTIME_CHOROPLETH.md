# W4 — Runtime choropleth/data join

## Mission

Prove that one Mapbox instance can render every W2 fixture selection by joining facts at runtime through exact governed geography IDs. W4 consumes W3 geometry transport; it does not publish, alter, repair or choose geometry.

## Parent boundaries

Scientific facts come from the deterministic W2 fixture release. Geometry must arrive independently through:

```text
/data/geography_transport.json
```

The W4 consumer requires:

```text
geography_level = province_2010
feature_id_property = geography_id
geography_release_id = <exact governed W3 release>
Mapbox tileset/source identity
source_layer
expected_geography_ids = exactly the 24 W2 jurisdiction IDs
```

The transport validator accepts either top-level Mapbox fields or a nested `mapbox` object, but it does not relax geography level, feature identity, or ID coverage.

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

W4 pins the official Mapbox GL JS CDN bundle to `3.29.0` and loads it only in the browser. The app expects:

```text
VITE_MAPBOX_PUBLIC_TOKEN
```

Only a dedicated, URL-restricted public `pk.*` token belongs there. No token is required for CI, unit tests, build, or the accessible table fallback.

If the token or W3 transport is absent, the map fails closed with an explicit message and the table remains usable.

## Tests

The runtime join is tested through a narrow Mapbox adapter rather than a WebGL browser dependency. Tests prove:

- exactly four stable atlas layers are installed;
- exact two-character IDs are used as feature identity;
- URL-restored selection writes the exact W2 fact value;
- period / universe / concept / estimand changes update state without adding layers;
- legend domain is stable across periods/universes;
- incompatible W3 geography coverage is rejected;
- click selection returns the promoted string ID.

## W3 concurrency

W3 may publish and prove the governed geometry transport independently. W4 deliberately does not commit a fake transport manifest or synthetic polygon fallback. When W3 lands, reconcile its exact manifest shape and transport path if needed, then run the real browser proof before treating W4 as fully integrated.
