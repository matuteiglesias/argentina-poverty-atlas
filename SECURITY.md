# Security policy

## Mapbox credentials

The atlas uses two different credential classes and they must never be confused.

### Public browser token

A Mapbox public token may be exposed to the browser by design.

For production it should be:

- dedicated to `argentina-poverty-atlas`;
- limited to the minimum public scopes required by Mapbox GL JS;
- URL-restricted to approved deployment domains where supported;
- replaceable without changing scientific releases.

Do not reuse a broad personal-development token by default.

### Secret publication token

Any token capable of creating, deleting or updating Mapbox tilesets/styles/sources is secret.

It must:

- live only in GitHub Actions/Vercel/approved secret storage;
- never appear in source, fixtures, notebooks, logs or generated public bundles;
- use minimum write scopes;
- be rotated if accidentally exposed.

## Historical token exposure

A legacy public notebook in `indice-pobreza-UBA` contains historical Mapbox secret
tokens in Git history.

Treat those credentials as compromised. Revoke/rotate them in Mapbox before the
new atlas performs write operations.

Removing the notebook cells is not sufficient because Git history retains the
credentials.

The W0 evidence snapshot and non-secret legacy asset census live in
`docs/W0_SECURITY_AND_LEGACY_MAPBOX.md` and
`mapbox/legacy_asset_inventory.yaml`. Never copy the historical token values into
this repository, including for testing whether they are still active.

## Repository guard

The repository runs `scripts/check_no_mapbox_secrets.py` in CI. It rejects Mapbox
`sk.*` secret-token material and reports only file/line locations, not matched
credential values.

Run it locally with:

```bash
python scripts/check_no_mapbox_secrets.py
```

This is a prevention guard, not a substitute for provider-side revocation of a
credential that was already exposed elsewhere.

## Repository rules

Never commit:

```text
.env
.env.local
*.token
Mapbox sk.* tokens
Vercel secrets
private source credentials
```

Provide `.env.example` only with placeholders.

Client-exposed environment variables must be reviewed as public information.

## Fixture/data safety

Synthetic fixture data is public by design.

A future real atlas release may contain only outputs explicitly approved for public presentation. Never package raw Census/EPH microdata, household/person prediction tables or sensitive row-level records into this repository or frontend build.

## Supply-chain baseline

The implementation wave should add:

- lockfile committed to Git;
- CI install from lockfile;
- dependency update mechanism;
- TypeScript/build checks;
- secret scanning where practical.

## Reporting

For accidental credential exposure, rotate/revoke the credential first. Repository history cleanup is secondary and does not replace revocation.
