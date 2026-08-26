import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const specPath = path.join(root, "fixtures/releases/w2-synthetic/release-spec.json")

function assert(condition, message) {
  if (!condition) throw new Error(`W2 fixture validation failed: ${message}`)
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`
  }
  return JSON.stringify(value)
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex")
}

function factKey(fact) {
  return [
    fact.period,
    fact.universe,
    fact.concept,
    fact.estimand,
    fact.geography_level,
    fact.geography_id,
  ].join("|")
}

function transform(incidence, universe, concept, estimand, algorithm) {
  let value = incidence
  if (universe === "households") value *= algorithm.households_multiplier
  if (concept === "indigence") value *= algorithm.indigence_multiplier
  if (estimand === "fgt1") value *= algorithm.fgt1_multiplier
  if (estimand === "fgt2") value *= algorithm.fgt2_multiplier
  value = Math.min(algorithm.maximum, Math.max(algorithm.minimum, value))
  return Number(value.toFixed(algorithm.round_decimals))
}

export function validateSpec(spec) {
  assert(spec.schema_version === "atlas-fixture-spec/v1", "unsupported schema_version")
  assert(spec.scientific_status === "synthetic_fixture", "scientific_status must be synthetic_fixture")
  assert(spec.not_for_interpretation === true, "not_for_interpretation must be true")
  assert(spec.geography_level === "province_2010", "fixture geography_level must be province_2010")
  assert(spec.national_geography?.id === "ARG", "national geography must be ARG")
  assert(spec.periods.length >= 6 && spec.periods.length <= 8, "fixture must have 6–8 periods")
  assert(spec.geographies.length === 24, "fixture must have exactly 24 jurisdictions")
  assert(JSON.stringify(spec.universes) === JSON.stringify(["persons", "households"]), "universes mismatch")
  assert(JSON.stringify(spec.concepts) === JSON.stringify(["poverty", "indigence"]), "concepts mismatch")
  assert(JSON.stringify(spec.estimands) === JSON.stringify(["fgt0", "fgt1", "fgt2"]), "estimands mismatch")

  const geographyIds = spec.geographies.map((item) => item.id)
  assert(new Set(geographyIds).size === 24, "jurisdiction IDs must be unique")
  assert(geographyIds.every((id) => /^\d{2}$/.test(id)), "jurisdiction IDs must remain two-character strings")

  const identityPayload = structuredClone(spec)
  delete identityPayload.release_id
  const sourceSpecSha256 = sha256(stableStringify(identityPayload))
  const expectedReleaseId = `fixture-ar-24j-6p-v1-${sourceSpecSha256.slice(0, 12)}`
  assert(spec.release_id === expectedReleaseId, `release_id must equal ${expectedReleaseId}`)

  return { sourceSpecSha256, geographyIds }
}

export function materializeRelease(spec) {
  const { sourceSpecSha256, geographyIds } = validateSpec(spec)
  const facts = []

  for (const period of spec.periods) {
    for (const universe of spec.universes) {
      for (const concept of spec.concepts) {
        for (const estimand of spec.estimands) {
          facts.push({
            period: period.id,
            universe,
            concept,
            estimand,
            geography_level: "national",
            geography_id: spec.national_geography.id,
            estimate: transform(period.national_base, universe, concept, estimand, spec.algorithm),
            uncertainty_status: "not_supplied",
            quality_status: "fixture",
            coverage: 1,
            warning_codes: [],
          })

          for (const geography of spec.geographies) {
            facts.push({
              period: period.id,
              universe,
              concept,
              estimand,
              geography_level: spec.geography_level,
              geography_id: geography.id,
              estimate: transform(
                geography.incidence_base + period.adjustment,
                universe,
                concept,
                estimand,
                spec.algorithm,
              ),
              uncertainty_status: "not_supplied",
              quality_status: "fixture",
              coverage: 1,
              warning_codes: [],
            })
          }
        }
      }
    }
  }

  const keys = facts.map(factKey)
  assert(new Set(keys).size === facts.length, "duplicate fact key")
  const expectedCount =
    (geographyIds.length + 1) *
    spec.periods.length *
    spec.universes.length *
    spec.concepts.length *
    spec.estimands.length
  assert(facts.length === expectedCount, `expected ${expectedCount} facts, got ${facts.length}`)

  const factsJson = `${JSON.stringify(facts, null, 2)}\n`
  const factsSha256 = sha256(factsJson)
  const metadata = {
    schema_version: "atlas-fixture-release/v1",
    release_id: spec.release_id,
    scientific_status: spec.scientific_status,
    not_for_interpretation: spec.not_for_interpretation,
    periods: spec.periods.map(({ id, label }) => ({ id, label })),
    universes: spec.universes,
    concepts: spec.concepts,
    estimands: spec.estimands,
    geography_level: spec.geography_level,
    national_geography: spec.national_geography,
    parents: spec.parents,
    comparability: spec.comparability,
    jurisdiction_count: geographyIds.length,
    fact_count: facts.length,
    source_spec_sha256: sourceSpecSha256,
    facts_sha256: factsSha256,
  }

  return { metadata, facts, factsJson, factsSha256, sourceSpecSha256 }
}

export async function projectFixtureRelease() {
  const spec = JSON.parse(await readFile(specPath, "utf8"))
  const release = materializeRelease(spec)
  const releaseDir = path.join(root, "public/data/releases", spec.release_id)
  await mkdir(releaseDir, { recursive: true })

  const metadataJson = `${JSON.stringify(release.metadata, null, 2)}\n`
  const metadataSha256 = sha256(metadataJson)
  const manifest = {
    release_id: spec.release_id,
    source_spec: "fixtures/releases/w2-synthetic/release-spec.json",
    source_spec_sha256: release.sourceSpecSha256,
    files: {
      "metadata.json": metadataSha256,
      "facts.json": release.factsSha256,
    },
  }
  const catalog = {
    schema_version: "atlas-public-catalog/v1",
    default_release_id: spec.release_id,
    releases: [
      {
        release_id: spec.release_id,
        scientific_status: spec.scientific_status,
        not_for_interpretation: true,
        metadata: `/data/releases/${spec.release_id}/metadata.json`,
        facts: `/data/releases/${spec.release_id}/facts.json`,
        manifest: `/data/releases/${spec.release_id}/manifest.json`,
      },
    ],
  }

  await Promise.all([
    writeFile(path.join(releaseDir, "metadata.json"), metadataJson),
    writeFile(path.join(releaseDir, "facts.json"), release.factsJson),
    writeFile(path.join(releaseDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`),
    mkdir(path.join(root, "public/data"), { recursive: true }).then(() =>
      writeFile(path.join(root, "public/data/catalog.json"), `${JSON.stringify(catalog, null, 2)}\n`),
    ),
  ])

  console.log(
    `Projected ${spec.release_id}: ${release.facts.length} facts, facts sha256 ${release.factsSha256}`,
  )
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await projectFixtureRelease()
}
