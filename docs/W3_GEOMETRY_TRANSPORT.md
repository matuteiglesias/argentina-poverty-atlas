# W3 — Province geometry transport and Mapbox proof

Status: **exact upstream province parent pinned; provider publication and public-browser proof remain open**.

This document records the current W3 boundary after the upstream Argentina Geography province release landed. It must not be read as evidence that a live Mapbox tileset already exists.

## Mission boundary

W3 proves a presentation transport from one exact Argentina Geography **province** release into Mapbox. It does not create geography authority, choose a canonical provider, repair boundaries, or attach poverty values to geometry.

```text
exact 24-feature province Geography Release
        ↓
geometry-only Mapbox vector tileset
        ↓
feature property geography_id
        ↓
Mapbox Standard + atlas runtime
```

Poverty facts remain a separate release lifecycle and are joined at runtime.

## Exact upstream parent

The former upstream blocker is closed. The Atlas now pins:

```text
repository               matuteiglesias/argentina-geography
commit                   ef315a4ca7e53eb98d9adf106b0cee190a6c5cd3
dataset                  arggeo.ign.administrative.province
release                  snapshot-20260826-b9fcf6f90f28
geography version        2026-08-26-b9fcf6f90f28
source SHA-256           b9fcf6f90f28f1bdfcc713a47ad4ed63e2db0b000c4642611597d4ea8b897c55
GeoParquet SHA-256       3907e1e0e256f2ea768a66e14874266a576787fe724dad0d35eb9308ddc6dd7b
GeoJSON SHA-256          c49be97fef429c9bc473681e6677135bf19307da1141b1d7f6f12c50df366ed3
feature count            24
identity rule            geography_id = IN1 = native_id
```

The source is the official IGN `Provincia` layer as an exact archive snapshot. `argentina-geography` applies no dissolve, clip, geometry repair, provider adjudication, or poverty decoration for this product.

The exact source IDs are:

```text
02 06 10 14 18 22 26 30 34 38 42 46
50 54 58 62 66 70 74 78 82 86 90 94
```

They match the Atlas fixture exactly. Similar names or integer-equivalent IDs are not accepted as substitutes.

## Current manifest state

`mapbox/manifests/province-w3.json` now distinguishes three states:

```text
blocked_upstream
    exact province parent absent

ready_for_publication
    exact parent pinned and fixture-compatible
    provider publication not yet proven

published
    exact parent + Mapbox provider identity + 24/24 vector-ID proof recorded
```

The current checked-in state is:

```text
status = ready_for_publication
parent_release = exact IGN province release
mapbox.tileset_id = null
mapbox.source_layer = null
```

This is intentionally fail-closed. The Atlas may know its exact geography parent without pretending that Mapbox accepted or published it.

## Remaining provider gate

A transition to `published` requires provider evidence for all of:

- governed secret Mapbox write credential;
- successful upload completion;
- exact tileset ID;
- exact source-layer ID;
- `feature_id_property = geography_id`;
- exactly 24 published features;
- exact 24/24 `geography_id` recovery from vector tiles;
- publication timestamp/job identity;
- geometry-only payload with no poverty facts embedded.

No tileset, source-layer, upload ID or publication timestamp may be invented or inferred from configuration alone.

## Publication automation

`.github/workflows/publish-w3-mapbox.yml` is an intentionally manual provider-write workflow. It must be dispatched from a dedicated non-`main` branch based on current `main`.

The workflow:

1. checks out the exact Argentina Geography commit;
2. materializes the exact IGN province release;
3. verifies raw, canonical and display hashes before any provider write;
4. uploads only the geometry derivative;
5. waits within a bounded polling window;
6. inspects TileJSON/source-layer identity;
7. recovers the exact 24 IDs from vector tiles;
8. runs the Atlas verification suite;
9. records provider proof back onto the same dedicated branch.

Merging provider proof remains an ordinary reviewable Git operation. The workflow does not get a standing path-trigger that can accidentally republish geometry during unrelated development.

## Browser gate

Provider publication is necessary but is not the final public proof. The browser runtime accepts only:

```text
VITE_MAPBOX_PUBLIC_TOKEN
```

A live proof requires a dedicated restricted `pk.*` browser token and verification that:

- Mapbox Standard loads;
- the manifested vector source loads;
- all 24 exact IDs are visible to the runtime;
- hover/selection/runtime joins operate against `geography_id`;
- no secret credential enters the browser bundle.

## Current DoD assessment

| W3 requirement | State |
| --- | --- |
| inspect current Argentina Geography products | complete |
| pin exact 24-province Geography Release | complete |
| exact fixture ID compatibility | complete: 24/24 |
| geometry-only display derivative | complete upstream |
| vector transport manifest contract | complete, fail-closed |
| Mapbox Standard runtime | implemented |
| live tileset/source-layer/job identity | **pending provider proof** |
| exact 24/24 published vector-ID proof | **pending provider proof** |
| all 24 jurisdictions visible in restricted public browser | **pending browser proof** |
| poverty absent from geometry | enforced by upstream and transport design |

W3 should remain open until provider and browser evidence exist. W6 — consuming the first consequential real `poverty-estimate-release@2` — is a separate downstream milestone and must not be smuggled into W3.
