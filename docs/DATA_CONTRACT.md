# Data contract — scientific release to atlas

## Goal

The atlas should be able to replace synthetic fixtures with a real poverty release **without changing presentation architecture**.

The initial contract is intentionally small and tabular.

## Poverty fact identity

A displayable poverty fact is identified by:

```text
period
universe
concept
estimand
geography_level
geography_id
```

Recommended values for the first product:

```text
universe       persons | households
concept        poverty | indigence
estimand       fgt0 | fgt1 | fgt2
geography      province_2010 initially for fixture proof
```

The underlying scientific release may use a different exact geography level/version. The atlas projection must preserve and declare the exact upstream key.

## Minimum fact row

```json
{
  "period": "fixture-2026-Q1",
  "universe": "persons",
  "concept": "poverty",
  "estimand": "fgt0",
  "geography_level": "province_2010",
  "geography_id": "06",
  "estimate": 0.341,
  "uncertainty_status": "not_supplied",
  "quality_status": "fixture"
}
```

The example value is synthetic and has no statistical meaning.

## National facts

National headline/time-series rows should use an explicit national geography identity rather than deriving the headline in the browser from province values unless the upstream release says that aggregation is valid.

Example shape:

```text
geography_level = national
geography_id = ARG
```

## Uncertainty-ready fields

The atlas schema should accept nullable/optional fields from day one:

```text
standard_error
ci_lower
ci_upper
cv
uncertainty_method
```

If no uncertainty exists:

```text
uncertainty_status = not_supplied
```

The UI must not derive an interval from absence.

## Quality fields

Support at least:

```text
quality_status
coverage
warning_codes[]
```

The exact scientific QA vocabulary remains upstream. The atlas may map upstream statuses to presentation categories only through an explicit adapter.

## Release metadata

Every atlas-consumable scientific release must expose or be projected into metadata resembling:

```json
{
  "release_id": "...",
  "scientific_status": "synthetic_fixture | research_estimate | ...",
  "periods": ["..."],
  "universes": ["persons", "households"],
  "concepts": ["poverty", "indigence"],
  "estimands": ["fgt0", "fgt1", "fgt2"],
  "geography_level": "province_2010",
  "parents": {
    "population_frame": "...",
    "welfare": "...",
    "poverty_method": "...",
    "poverty_lines": "...",
    "geography": "..."
  }
}
```

Fixture parents should use explicit fixture IDs rather than fake real releases.

## Geometry join contract

The atlas must ingest a geography transport manifest that states:

```text
geography_level
geography_release_id
feature_id_property = geography_id
mapbox_source / source-layer
join_semantics = exact_governed_id
```

Before rendering, the app/build validator should prove:

- fact IDs are unique at the selected grain;
- every fact geography ID is known to the geometry transport;
- unexpected geometry IDs are either allowed as no-data units or rejected according to release policy;
- string IDs retain leading zeroes;
- no numeric coercion changes identity.

## Presentation projection

The browser should not need to load a large analytical Parquet file directly for V0.

A build step may project the verified scientific release into compact JSON such as:

```text
public/data/catalog.json
public/data/releases/<release-id>/facts.json
public/data/releases/<release-id>/metadata.json
```

This projection must be deterministic and checksumable.

It must not alter estimates or fill missing values.

## Fixture release v1

The first fixture should contain:

- exactly 24 Argentine jurisdiction/province IDs compatible with one chosen Geography Release;
- 6–8 synthetic periods;
- persons and households;
- poverty and indigence;
- FGT0/1/2;
- national rows for the headline/time series;
- deterministic values generated from a documented seed/algorithm or committed static fixture;
- one explicit fixture-only quality warning in a test variant;
- one missing-value test variant.

All fixture metadata must include:

```text
scientific_status = synthetic_fixture
not_for_interpretation = true
```

## Comparability metadata

Time-series metadata should be ready for future changes in:

```text
method_release
model_release
frame_release
poverty_line_release
```

The UI should eventually be able to mark a comparability break when those changes are substantive.

## Forbidden transformations in the atlas

The atlas must not:

- calculate household poverty thresholds;
- aggregate microdata;
- invert model transformations;
- calculate FGT contributions from welfare;
- repair missing estimates;
- invent uncertainty;
- spatially assign an estimate to a polygon;
- choose a canonical geography/provider.

If a real release cannot satisfy the display contract without one of those operations, the operation belongs upstream or requires a separately governed adapter/release.
