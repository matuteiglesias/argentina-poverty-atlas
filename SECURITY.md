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

A legacy public notebook in `indice-pobreza-UBA` contains a historical Mapbox secret token in Git history.

Treat that token as compromised. Revoke/rotate it in Mapbox before the new atlas performs write operations.

Removing the notebook cell is not sufficient because Git history retains the credential.

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
