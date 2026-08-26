# Synthetic atlas fixtures

Fixtures are first-class development inputs for this repository.

They exist so product, map and deployment work can proceed before a real poverty estimate is approved.

## Required fixture identity

The first fixture release should identify itself as something like:

```text
fixture.argentina-poverty-atlas.province/v1
```

with metadata:

```json
{
  "scientific_status": "synthetic_fixture",
  "not_for_interpretation": true,
  "geography_count": 24
}
```

## Content target

The primary fixture should contain:

- 24 exact Argentine jurisdiction/province IDs;
- 6–8 synthetic periods;
- persons and households;
- poverty and indigence;
- FGT0, FGT1 and FGT2;
- explicit national rows;
- quality and uncertainty status.

Do not source fixture values from current poverty statistics. They should be deterministic synthetic signal, not approximate real data.

## Generation direction

A deterministic generator may derive values from a fixed seed plus the complete fact key:

```text
seed
period
universe
concept
estimand
geography_id
```

The generator should impose basic logical structure so the UI receives realistic shapes without making empirical claims, for example:

```text
indigence FGT0 <= poverty FGT0
FGT2 <= FGT1 <= FGT0
household/person series differ
periods move smoothly enough to exercise charts
```

Those are fixture-shape constraints only; they are not scientific estimation rules for real releases.

## Adversarial fixture variants

Keep separate fixture variants for tests:

```text
missing-estimate
unknown-geography-id
duplicate-fact-key
quality-warning
invalid-estimate-domain
```

The canonical demo fixture should be complete/pleasant enough for visual development; adversarial variants should exercise fail-closed behavior.

## Presentation rule

Any fixture-driven deployment must display a persistent synthetic-data notice.

Fixture mode should remain available after real releases exist because it is useful for deterministic CI, visual regression and local development without scientific data dependencies.
