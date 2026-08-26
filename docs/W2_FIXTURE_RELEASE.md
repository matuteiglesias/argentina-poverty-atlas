# W2 — deterministic 24-jurisdiction fixture release

W2 replaces the W1 presentation-only value generator with one deterministic atlas fixture release.

## Canonical source

The authoritative fixture seed is:

```text
fixtures/releases/w2-synthetic/release-spec.json
```

Its identity-bearing payload is canonicalized with recursively sorted object keys, excluding only the `release_id` field, and hashed with SHA-256.

```text
source spec sha256: db7698bb2dff0d0d07b03ae853bba656ee7f89a68c64a41b752807b076fa60c1
release_id: fixture-ar-24j-6p-v1-db7698bb2dff
```

The projector rejects the spec if the stored release ID does not match the content-derived identity.

The fixture is intentionally synthetic. Its metadata is always:

```text
scientific_status = synthetic_fixture
not_for_interpretation = true
```

Fixture parent IDs are explicit fixture identities; they do not impersonate real upstream scientific or geography releases.

## Coverage

The canonical release materializes:

```text
24 jurisdictions
6 periods
2 universes: persons / households
2 concepts: poverty / indigence
3 estimands: fgt0 / fgt1 / fgt2
explicit national ARG rows
1,800 fact rows total
```

Province IDs remain two-character strings. National values are explicit facts and are never browser aggregations of provincial values.

The deterministic formula is part of the fixture spec. It exists only to manufacture stable demonstration values; it is not a poverty estimator and must not be interpreted as one.

## Validation boundary

`src/data/release.ts` validates the browser-facing release contract. It rejects duplicate fact keys, unsupported dimensions, malformed province IDs, incompatible geography IDs, non-finite/out-of-range estimates, and fabricated uncertainty fields when uncertainty is declared `not_supplied`.

The W2 canonical fixture adds stronger completeness gates: exactly 24 jurisdictions, 6–8 periods, the required dimension sets, and exactly 1,800 facts.

The test suite also exercises bounded variants for:

- one missing geography estimate — schema-valid and left missing rather than repaired;
- one explicit quality warning — preserved with its warning code;
- duplicate fact key — rejected;
- incompatible geography ID — rejected;
- uncertainty absent — accepted only as explicit `not_supplied` with no invented interval fields.

## Public static projection

Run:

```bash
npm run data:project
```

The dependency-free Node projector validates the fixture again and writes deterministic browser/download artifacts:

```text
public/data/catalog.json
public/data/releases/<release-id>/metadata.json
public/data/releases/<release-id>/facts.json
public/data/releases/<release-id>/manifest.json
```

`manifest.json` records SHA-256 identities for the source spec, projected metadata and fact file. `npm run build` runs this projection automatically before TypeScript/Vite build.

The React presentation reads the same materialized release fact table through an indexed adapter. W1's `fixtureEstimate(...)` name remains temporarily as a compatibility seam, but it is now a lookup into release facts and performs no statistical calculation.

## W3 seam

The fixture geography parent remains explicitly synthetic in W2. W3 is responsible for choosing and pinning one exact compatible Geography Release and proving the Mapbox transport/join. W2 does not invent geometry or promote a provider boundary.
