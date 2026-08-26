# W0 — Mapbox security and legacy asset census

## Scope

This document records the repository-side execution of W0 from
`docs/DELIVERY_PLAN.md` and issue #2.

The evidence snapshot is intentionally immutable:

```text
legacy repository: matuteiglesias/indice-pobreza-UBA
commit:            a31080c9adbc63d4ea46973d1bd00feef9d5fb4f
inspection date:   2026-08-26
inventory:         mapbox/legacy_asset_inventory.yaml
```

The inventory is evidence about what the legacy repository created or referenced.
It is **not** a claim that every listed resource still exists in the live Mapbox
account today.

## W0 status

| Item | Status | Evidence / next gate |
| --- | --- | --- |
| Legacy credential exposure characterized | complete | The pinned notebook contains two distinct `sk.*` values. Their values are deliberately not copied here. |
| Prevent legacy secrets entering this repo | complete | `.gitignore`, `scripts/check_no_mapbox_secrets.py`, and CI reject committed Mapbox secret tokens without printing them. |
| Legacy styles/tilesets/sources/recipes inventoried | complete from repository evidence | See `mapbox/legacy_asset_inventory.yaml`. |
| Legacy asset deletion | intentionally not performed | W0 forbids deletion; retirement is deferred until W8 evidence gates are met. |
| Historical `/Pobreza/` migration behavior | decided | Preserve the route in W0; redirect/replace only in W8 after a real W7 atlas release is proven. |
| Revoke/rotate historical Mapbox secrets | **external account action required** | Must be done in the Mapbox account. Repository access cannot prove revocation. |
| Dedicated restricted browser token | **external account action required** | Create only a public `pk.*` token, dedicated to this atlas, with the minimum read scopes proven by the app and allowed-URL restrictions for approved domains. |
| Secret publication token | intentionally deferred | Create only when governed Mapbox write automation is introduced; store only in CI/approved secret storage. |
| Live Mapbox estate reconciliation | **external account inspection required** | Compare Studio/account resources against the pinned inventory before any retirement decision. |

W0 is therefore **repo-side complete but not externally closed**. W1/W2 can
proceed without Mapbox credentials. W3 publication must not use a historical
secret and should wait for the external credential gate.

## What the legacy workflow actually did

The historical workflow mixed publication and presentation concerns inside a
notebook:

```text
GeoJSON per universe/geography
  -> mutable Mapbox tileset sources
  -> dated/versioned tilesets
  -> cloned/mutated style JSON
  -> one style per displayed measure/universe
  -> standalone HTML files under a local Pobreza web tree
```

The pinned notebook records five universe families (`H`, `P`, `M24`, `M14`,
`M6`), three spatial layers per family (province, department and fraction), and
14 generated display styles. It also deletes/recreates remote resources during
publication. That is useful parity evidence, but it is not an acceptable authority
or deployment path for the new atlas.

The new target remains:

```text
one stable basemap
  + governed geometry transport keyed by geography_id
  + poverty facts selected at runtime
  -> one atlas map instance
```

Changing period, poverty/indigence, universe or FGT estimand must not create a new
style or poverty-valued geometry tileset.

## Credential gate

### Historical credentials

Treat **both distinct secret tokens observed in the pinned notebook** as
compromised. Do not test them, copy them, use them to inspect the account, or use
them to automate their own replacement.

External account action:

1. Open the Mapbox access-token management surface for account `matuteiglesias2`.
2. Revoke the historical exposed tokens or otherwise rotate the credentials so the
   exposed values can no longer authorize requests.
3. Record only non-secret evidence of completion (date plus token IDs/names if
   useful). Never paste token values into GitHub.

Repository history cleanup is optional secondary hygiene; it does not replace
revocation.

### Atlas browser token

The browser credential must be a dedicated public token. Mapbox currently supports
public `pk` tokens, scopes, and allowed-URL restrictions; its Tokens API docs show
URL-restricted public-token examples. The exact scope set should be minimized from
what the implemented atlas actually needs rather than copied from a broad personal
token.

Before production Mapbox rendering:

- create a token named/described for `argentina-poverty-atlas`;
- grant only required public read scopes;
- restrict it to approved production/preview URLs;
- expose it only through client configuration intended to be public;
- prove the app fails cleanly when it is missing.

Reference: <https://docs.mapbox.com/api/accounts/tokens/>

### Publication token

Do not create a standing write credential merely to satisfy a checklist. When W3
introduces an actual tileset publication workflow, create a minimum-scope secret
for that workflow and store it in GitHub Actions or another approved secret store.
The browser must never receive it.

## Legacy estate summary

The machine-readable inventory records:

- **6 tracked recipe artifacts** (five universe recipes plus a template), pinned by
  blob SHA;
- **15 last-observed tileset-source IDs** across province/department/fraction and
  five universe families;
- **5 last-observed August 2024 tilesets**, including observed prior version
  families and publication job IDs;
- **14 last-observed generated style IDs** and their measure/source relationship;
- one legacy template style ID;
- one auxiliary `matuteiglesias2.ejido` resource whose role/liveness needs manual
  account inspection.

Classification is deliberately conservative:

- recipes: parity/cartographic evidence, not new authority;
- universe/date-specific tilesets and sources: superseded candidates, inspect before
  retirement;
- measure-specific styles: superseded by runtime styling, retain as parity evidence;
- `ejido`: unknown/manual inspection required.

No asset is authorized for deletion by this wave.

## `/Pobreza/` migration decision

The historical public path is `/Pobreza/` (`http://matuteiglesias.link/Pobreza/`).
The legacy notebook also writes map HTML files beneath a local
`Documents/link/Pobreza/maps/mbox/` tree. A historical public launch referenced the
same route.

This execution environment could not independently verify the route's live HTTP
state, so W0 does not pretend to know whether it currently renders, redirects or is
offline.

Decision:

- **W0:** do not change the route or delete its supporting Mapbox assets;
- **W1–W6:** build the new atlas independently;
- **W7:** prove a first real research atlas release;
- **W8:** intentionally redirect or replace `/Pobreza/` with the canonical atlas
  deployment, preserving historical URL/screenshot/citation evidence where useful.

The exact destination URL remains unset until the new atlas deployment has a
stable canonical address.

## Verification

Local/repository security proof:

```bash
python scripts/check_no_mapbox_secrets.py
```

Expected result:

```text
Mapbox secret scan: clean
```

Before closing issue #2, attach non-secret evidence that the historical Mapbox
secrets were revoked/rotated and that the dedicated browser-token restrictions are
configured. Then reconcile the live account inventory against
`mapbox/legacy_asset_inventory.yaml`; discrepancies should be recorded, not
silently normalized away.
