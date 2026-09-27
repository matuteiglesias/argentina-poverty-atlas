# Poverty release boundary

This document defines how `argentina-poverty-atlas` consumes governed poverty estimates from `matuteiglesias/indice-pobreza-UBA`.

The Atlas is intentionally a **release consumer**, not a scientific co-producer.

## Boundary

```text
indice-pobreza-UBA
  poverty-estimate-release/v2
          |
          | immutable files + checksums
          v
argentina-poverty-atlas ingest
          |
          | verified static projection
          v
browser UI + Mapbox
```

No Python import, sibling-path access, notebook execution or producer runtime belongs in the Atlas.

## Consumer profile

The machine-readable profile is:

```text
contracts/poverty-release-consumer-v1.json
```

It records the exact producer schema/files and Atlas-supported semantics. If Poverty evolves an unsupported semantic capability, Atlas should fail closed until this profile is intentionally versioned.

## Ingest sequence

A future Atlas adapter should perform these steps outside React components:

1. receive/copy one exact Poverty release directory;
2. verify file inventory and `checksums.sha256`;
3. read `release_manifest.json` and require `poverty-estimate-release/v2`;
4. read `poverty-estimate-capabilities/v2`, verify the estimand contract and downstream operation permissions, and build selector availability from declared cells;
5. read `geography_join_contract.json` and require exact governed-ID semantics;
6. parse `poverty_estimates.csv` with string-preserving geography IDs;
7. reject duplicate fact keys or unsupported unit/uncertainty semantics;
8. pin one compatible `argentina-geography` release for each rendered geography level;
9. prove expected `geography_id` coverage before map publication;
10. emit a bounded static browser projection plus lineage metadata.

The browser should not be responsible for scientific bundle verification.

## Capability-driven UI

Selectors must be driven by `capabilities.json`.

Do not assume every release contains:

- every period;
- both households and persons;
- every concept;
- every FGT estimand;
- province and department simultaneously;
- uncertainty.

A UI state is valid only if the exact tuple is present in the release availability matrix.
Presentation is separately constrained by the declared permission object. Missing or legacy
permission metadata fails closed to commissioning presentation; Atlas does not infer a more
permissive state.

This gives us a clean migration path: the current Atlas can use a rich synthetic 24-province fixture while the first real scientific release may initially expose a smaller supported surface. The UI adapts to declared capability rather than requiring producer-specific code.

## Province-first fixture vs real science

The product fixture is intentionally province-first because it is an excellent end-to-end map signal.

That does **not** authorize Atlas to create province poverty estimates by aggregating another released geography in the browser.

If a public province value is required from real data, Poverty should publish a `province_2010` estimate under its declared estimation design. The same release format supports that geography level.

Likewise, a department release is rendered only against an exact compatible department Geography Release.

## Scientific status presentation

### `synthetic_fixture`

Atlas must display an unmistakable persistent demo/synthetic label. Values are not interpretable estimates.

### `research_estimate`

Scientific status alone does not authorize presentation.

Atlas combines:

```text
scientific_status
+ not_for_interpretation
+ capabilities.permissions
→ presentation mode
```

A research release with `not_for_interpretation=true` must resolve to
`commissioning_only`: point values may remain inspectable, but the ordinary national
headline is suppressed.

Only a producer-declared `research_public` permission may enable ordinary research
presentation. Even then, the result remains a project research estimate and must not be
presented as an official INDEC statistic.

Unknown/inconsistent statuses or permissions fail closed.

## Geography compatibility

The scientific release owns facts and IDs; `argentina-geography` owns geometry.

Atlas owns only the compatibility proof and rendering transport.

Accepted join semantics:

```text
[geography_level, geography_id]
exact_governed_id
```

Forbidden:

- fuzzy name matching;
- integer conversion that removes leading zeroes;
- choosing another provider because a geometry is visually convenient;
- spatial inference to repair an ID mismatch;
- embedding poverty values into geometry as a source-of-truth workaround.

If a Poverty release and Geography Release do not match, the adapter reports the mismatch and stops that map surface.

## National values

`national` is a non-spatial level. It may feed headline cards/time-series but must not be joined to Mapbox geometry.

A national headline comes from a released national fact, not from browser-side averaging of provinces, **and it is rendered only when the release permission contract authorizes ordinary presentation**.

## Time-series rule

A time series shown by the Atlas must be backed by explicit released observations for each
period and must also respect the release's temporal-comparison permission.

`descriptive_only` authorizes a descriptive series but not significance/change-certainty
claims. `not_authorized` leaves the period selector available for one-period inspection
while suppressing a connecting trajectory and comparative numeric framing.

Do not interpolate or fill missing scientific periods merely for visual continuity.

## Uncertainty evolution

The first Atlas consumer profile supports:

```text
uncertainty_status = not_supplied
```

It may show the explicit limitation but cannot manufacture intervals, inferential ranking,
significance or precision language.

When Poverty P5 introduces a justified uncertainty representation, Atlas support should be
added by versioning the producer/consumer capability schema and tests before exposing
uncertainty UI.

## Counts

The current capability contract has no population-mass or household-total authority.
Therefore Atlas must not derive poor-person or poor-household counts by multiplying released
proportions by an external total. Counts remain disabled until a future upstream estimand
contract explicitly authorizes them.

## Compatibility test target

The producer-side executable proof is:

```bash
make atlas-contract-smoke
```

which builds a synthetic `province_2010` `poverty-estimate-release/v2` and verifies the exact bundle contract.

The Atlas-side W6 adapter should eventually consume an artifact produced by that command (or an equivalent copied fixture), validate it against this profile, and project it without importing Poverty code.

That cross-repository artifact test is the acceptance gate for the boundary.
