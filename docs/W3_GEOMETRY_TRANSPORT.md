# W3 — Province geometry transport and Mapbox proof

Status: **transport boundary implemented; W3 DoD blocked by two explicit external prerequisites**.

This document records the 2026-08-26 W3 inspection and the exact completion seam. It must not be read as evidence that a live Mapbox tileset already exists.

## Mission boundary

W3 proves a presentation transport from one exact Argentina Geography **province** release into Mapbox. It does not create geography authority, choose a canonical provider, or attach poverty values to geometry.

The browser contract is intentionally small:

```text
one exact 24-feature province Geography Release
        ↓
geometry-only Mapbox vector tileset
        ↓
feature property geography_id
        ↓
Mapbox Standard + one atlas map module
```

Synthetic poverty facts remain a separate lifecycle and are not written into the vector tiles.

## Upstream inspection

Argentina Geography was inspected at exact commit:

```text
repository  matuteiglesias/argentina-geography
commit      8ff8e2200613986c70726c22a827b31d2ff400cd
```

Its current public product surface includes exact radio/fraction/department/circuit Geography Releases and relation products. No already-released 24-feature province Geography Release suitable for this W3 parent was identified.

Two exact 2022 radio products demonstrate that the atlas fixture IDs are semantically plausible but **do not satisfy the parent-level requirement**:

### INDEC Census 2022 radio

```text
dataset            arggeo.indec.census.2022.radio
release            2022-national-20260320-a390c8403850
source SHA-256      a390c84038509eb3e6125a5968c72f57fbfae757cda2a2344a14defb5ac18a7b
features            66,515
native identity     cod_indec (9-character zero-preserving string)
province component  first two digits
```

This is official census **radio** geography. Its province component does not authorize the atlas to dissolve 66,515 radios and publish that dissolve as a province Geography Release.

### CEUR-CONICET Census 2022 V2025-1 radio

```text
dataset                 arggeo.ceur.census.2022.radio
release                 v2025-1-2022-d3a6f4c95102
source SHA-256           d3a6f4c951022130d19a894984eb1315b0c9096314afb1fe2ac79eb9c85da3c8
normalized artifact SHA  6ff1fc751585a9c94a7ed73c32b8337d05f0a31cc833b8958425fb4dbb7cb6fe
features                 66,502
native province field    PROV[2]
```

This is a redistribution-friendly curated-research **radio** release, not a province release. Choosing it and dissolving it inside the atlas would still move geography semantics into the presentation repository.

The missing upstream contract is tracked as:

- `matuteiglesias/argentina-geography#34` — publish one exact 24-province Geography Release.

## Fixture compatibility

The atlas fixture currently uses exactly these 24 zero-preserving IDs:

```text
02 06 10 14 18 22 26 30 34 38 42 46
50 54 58 62 66 70 74 78 82 86 90 94
```

`mapbox/manifests/province-w3.json` persists this set and the runtime validator fails closed if the manifest drifts from the fixture.

When the upstream province release exists, its 24 feature IDs must be compared exactly against this set. Similar names or integer-equivalent values are not sufficient.

## Mapbox runtime prepared by W3

The atlas now owns one isolated `ProvinceMap` module. For a `published` transport manifest it:

1. loads Mapbox GL JS;
2. initializes `mapbox://styles/mapbox/standard`;
3. adds one vector source from the manifested tileset;
4. promotes `geography_id` as feature identity;
5. adds only neutral geometry proof fill/border layers;
6. checks the loaded source for the exact 24 expected IDs;
7. lets a click return `geography_id` to the existing atlas selection state.

There is deliberately no feature-state estimate, choropleth expression, poverty palette or per-period data in this wave. Those are W4 responsibilities.

## Credential boundary

W0 issue #2 still records provider-side work as open. W3 therefore does not reuse historical tokens or invent a secret.

Browser runtime accepts only:

```text
VITE_MAPBOX_PUBLIC_TOKEN
```

The committed `.env.example` contains a placeholder. A real value must be a dedicated public `pk.*` token with only the scopes needed by this app and approved URL restrictions.

A Mapbox publication credential is needed only when the exact upstream province artifact is actually written as a governed vector transport. It belongs in secret storage and never in source, logs, fixtures, the manifest, or the browser bundle.

## Transport manifest state machine

`mapbox/manifests/province-w3.json` is the machine-readable authority for the atlas transport.

### Current state

```text
status = blocked_upstream
parent_release = null
```

This is intentional. The validator rejects any attempt to label the transport `published` without:

- a province-level exact parent;
- 24 parent features;
- source snapshot SHA-256;
- parent artifact SHA-256;
- Mapbox tileset ID;
- source-layer;
- `feature_id_property = geography_id`;
- 24 published features;
- publication timestamp;
- geometry-only/no-poverty payload policy.

### Completion edit after prerequisites exist

Change the manifest to `status = published` only after the exact parent and live Mapbox publication are proven. Fill:

```text
parent_release.repository
parent_release.commit_sha
parent_release.geography_id
parent_release.release_version
parent_release.level = province
parent_release.source_snapshot_sha256
parent_release.artifact_sha256
parent_release.feature_count = 24

mapbox.tileset_id
mapbox.source_layer
mapbox.published_feature_count = 24
mapbox.publication_time
mapbox.publication_job_id
```

Then run `npm run verify` and perform the browser proof with the restricted public token. The map itself reports whether the loaded vector source exposes the exact 24 fixture IDs.

## Current DoD assessment

| W3 requirement | State |
| --- | --- |
| inspect current Argentina Geography products | complete |
| exact fixture ID compatibility boundary | complete |
| pin exact province Geography Release | **blocked: upstream release absent** |
| vector transport manifest contract | complete, fail-closed |
| every feature exposes `geography_id` | contract enforced; **live proof blocked** |
| Mapbox Standard runtime | implemented |
| live vector tileset/source-layer/job identity | **blocked: exact parent + write credential required** |
| all 24 jurisdictions visible in browser | **blocked: live transport + public token required** |
| poverty absent from geometry | enforced by manifest/runtime design |

W3 must remain open until the three bold live-proof rows are satisfied. The current branch is useful because those prerequisites now complete W3 by supplying artifacts and manifest values rather than by changing architecture.
