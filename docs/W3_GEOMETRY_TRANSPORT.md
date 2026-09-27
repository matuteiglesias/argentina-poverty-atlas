# W3 — Governed geography transport and Mapbox proof

Status: **complete for province and department transports**.

## Mission boundary

W3 proves that one exact upstream Geography Release can be transported through Mapbox without turning Mapbox into geography authority or embedding poverty values in geometry.

```text
argentina-geography release
        ↓
geometry-only Mapbox MTS tileset
        ↓
stable geography_id property
        ↓
Atlas runtime join
```

Scientific poverty facts remain a separate release lifecycle and are joined in the browser.

## Published transports

### Province

- upstream repository: `matuteiglesias/argentina-geography`
- upstream commit: `ef315a4ca7e53eb98d9adf106b0cee190a6c5cd3`
- geography release: `ign:2026-08-26-b9fcf6f90f28:administrative:province`
- feature count: 24
- tileset: `matuteiglesias2.atlas-prov-b9fcf6f90f28-mts`
- source-layer: `province_2010`
- feature identity: `geography_id`
- publication time: `2026-09-26T19:52:24.683213+00:00`

Provider proof recovers all 24 governed IDs at z2 and again at the z5 identity check. Exact low-zoom tile coordinates, byte lengths and SHA-256 values are recorded in `mapbox/manifests/province-w3-publication-proof.json`.

### Department

- upstream repository: `matuteiglesias/argentina-geography`
- upstream commit: `5b8ee5f9ccaa6a7b1bd94127c37733782cc70c68`
- geography release: `indec:2010-national-c9184f47fd46:census-derived:department`
- feature count: 525
- tileset: `matuteiglesias2.atlas-dept-c9184f47fd46-mts`
- source-layer: `department_2010`
- feature identity: `geography_id`
- publication time: `2026-09-26T19:59:31.312654+00:00`
- Mapbox job: `tng5qqsu0izgonl2v5lwzijqx`

At z3 the low-zoom transport exposes 508/525 IDs because very small units do not survive every coarse tile. The exhaustive z5 identity proof recovers exactly 525/525 IDs. This distinction is intentional: low-zoom coverage is a visibility diagnostic; z5 is the identity gate.

## Publication pipeline

The publication workflow is provider-write-capable but remains explicit/manual. It:

1. verifies the exact upstream release and semantic gates;
2. materializes a deterministic, geometry-only transport artifact;
3. uploads/reuses a Mapbox Tiling Service source;
4. publishes/reuses the tileset idempotently;
5. verifies source-layer/minzoom metadata;
6. decodes vector tiles and proves governed IDs;
7. records exact nonempty tile evidence and publication metadata.

Provider-side byte drift may be accepted only after the pinned source semantics and display GeoJSON remain unchanged; semantic/identity drift remains fatal.

## Browser proof

`/diagnostics/mapbox` is the permanent commissioning surface. It independently tests:

- one exact server-proven MVT with the real public browser token;
- byte length and SHA-256 equality against server proof;
- the canonical `mapbox://` vector source;
- source loading;
- `querySourceFeatures()` identity recovery;
- a minimal solid-fill renderer.

Both province and department diagnostics passed in the deployed Vercel browser environment.

## Runtime lifecycle invariant discovered during commissioning

Mapbox must never be constructed on a zero-size DOM container. The production runtime therefore waits until the map container reports nonzero width and height, then keeps Mapbox synchronized with `ResizeObserver`.

This is a browser/runtime invariant, not a geography or provider contract.

## W3 completion assessment

| Requirement | State |
| --- | --- |
| exact upstream province release pinned | complete |
| exact upstream department release pinned | complete |
| geometry-only MTS transport | complete |
| provider publication recorded | complete |
| province identity proof | 24/24 |
| department identity proof | 525/525 at z5 |
| exact public-token tile fetch | complete |
| browser source-layer proof | complete |
| poverty absent from geometry | enforced |
| secret token absent from browser | enforced |

W3 is closed. Future geography refreshes should reuse this contract rather than reopen transport architecture.
