import { createHash } from "node:crypto"
import { access, readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const publicRoot = path.join(root, "public")
const CANONICAL_PERIODS = [
  "2024-Q1",
  "2024-Q2",
  "2024-Q3",
  "2024-Q4",
  "2025-Q1",
  "2025-Q2",
  "2025-Q3",
  "2025-Q4",
]
const PROFILES = {
  province_2010: { count: 24, id: /^\d{2}$/ },
  department_2010: { count: 525, id: /^\d{5}$/ },
}
const EXPECTED_NATIONAL_FACTS = 8 * 2 * 2 * 3

function fail(message) {
  throw new Error(`Public projection verification failed: ${message}`)
}

function invariant(condition, message) {
  if (!condition) fail(message)
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex")
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"))
}

function publicPath(url) {
  invariant(typeof url === "string" && url.startsWith("/data/"), `invalid public URL ${url}`)
  const resolved = path.resolve(publicRoot, url.slice(1))
  invariant(resolved.startsWith(publicRoot + path.sep), `public URL escapes public/: ${url}`)
  return resolved
}

function exactArray(actual, expected) {
  return (
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index])
  )
}

function factCellKey(fact) {
  return [fact.universe, fact.concept, fact.estimand].join("|")
}

function validateFactCellCompleteness(facts, expectedGeographyIds, period, level) {
  const expectedCells = new Set()
  for (const geographyId of expectedGeographyIds) {
    for (const universe of ["persons", "households"]) {
      for (const concept of ["poverty", "indigence"]) {
        for (const estimand of ["fgt0", "fgt1", "fgt2"]) {
          expectedCells.add(
            [geographyId, universe, concept, estimand].join("|"),
          )
        }
      }
    }
  }

  const observed = new Set()
  for (const fact of facts) {
    invariant(fact.period === period, `${level}/${period} contains fact from ${fact.period}`)
    invariant(fact.geography_level === level, `${level}/${period} contains ${fact.geography_level}`)
    invariant(
      expectedGeographyIds.has(fact.geography_id),
      `${level}/${period} contains foreign geography ${fact.geography_id}`,
    )
    const key = [fact.geography_id, factCellKey(fact)].join("|")
    invariant(!observed.has(key), `${level}/${period} duplicate fact ${key}`)
    observed.add(key)
  }
  invariant(
    observed.size === expectedCells.size &&
      [...expectedCells].every((key) => observed.has(key)),
    `${level}/${period} fact cube is incomplete`,
  )
}

async function verifyRelease(entry) {
  const level = entry.geography_level
  const profile = PROFILES[level]
  invariant(profile, `unsupported geography level ${level}`)

  const metadata = await readJson(publicPath(entry.metadata))
  const geographies = await readJson(publicPath(entry.geographies))
  const national = await readJson(publicPath(entry.national))
  const manifest = await readJson(publicPath(entry.manifest))

  invariant(metadata.release_id === entry.release_id, `${level} release_id drift`)
  invariant(metadata.geography_level === level, `${level} metadata level drift`)
  const periods = metadata.periods.map((item) => item.id)
  invariant(
    exactArray(periods, CANONICAL_PERIODS),
    `${level} periods must be exactly ${CANONICAL_PERIODS.join(", ")}`,
  )

  invariant(Array.isArray(geographies), `${level} geographies.json must be an array`)
  invariant(
    geographies.length === profile.count,
    `${level} must contain exactly ${profile.count} geographies, found ${geographies.length}`,
  )
  const geographyIds = geographies.map((item) => item.id)
  invariant(
    geographyIds.every((id) => typeof id === "string" && profile.id.test(id)),
    `${level} geography IDs violate governed string format`,
  )
  invariant(
    new Set(geographyIds).size === geographyIds.length,
    `${level} geography IDs are not unique`,
  )
  const geographyIdSet = new Set(geographyIds)

  invariant(
    manifest.schema_version === "atlas-public-partitioned-release-manifest/v1",
    `${level} manifest schema is not partitioned v1`,
  )
  invariant(manifest.release_id === entry.release_id, `${level} manifest release drift`)
  invariant(manifest.geography_level === level, `${level} manifest level drift`)
  invariant(manifest.geography_count === profile.count, `${level} manifest geography count drift`)
  invariant(manifest.period_count === 8, `${level} manifest period count drift`)

  for (const [relative, expectedHash] of Object.entries(manifest.files ?? {})) {
    const bytes = await readFile(path.join(path.dirname(publicPath(entry.manifest)), relative))
    invariant(
      sha256(bytes) === expectedHash,
      `${level} checksum mismatch for ${relative}`,
    )
  }

  invariant(
    Array.isArray(national) && national.length === EXPECTED_NATIONAL_FACTS,
    `${level} national.json must contain exactly ${EXPECTED_NATIONAL_FACTS} facts`,
  )
  const nationalKeys = new Set()
  for (const fact of national) {
    invariant(fact.geography_level === "national", `${level} national.json contains territorial fact`)
    invariant(fact.geography_id === "ARG", `${level} national fact is not ARG`)
    invariant(CANONICAL_PERIODS.includes(fact.period), `${level} national fact has invalid period`)
    const key = [fact.period, factCellKey(fact)].join("|")
    invariant(!nationalKeys.has(key), `${level} duplicate national fact ${key}`)
    nationalKeys.add(key)
  }
  invariant(nationalKeys.size === EXPECTED_NATIONAL_FACTS, `${level} national cube incomplete`)

  const factPeriods = Object.keys(entry.facts_by_period ?? {})
  invariant(
    exactArray(factPeriods, CANONICAL_PERIODS),
    `${level} facts_by_period must expose exactly eight canonical quarters`,
  )

  for (const period of CANONICAL_PERIODS) {
    const factsUrl = entry.facts_by_period[period]
    const facts = await readJson(publicPath(factsUrl))
    const expectedCount = profile.count * 2 * 2 * 3
    invariant(
      Array.isArray(facts) && facts.length === expectedCount,
      `${level}/${period} must contain exactly ${expectedCount} territorial facts, found ${facts?.length}`,
    )
    validateFactCellCompleteness(facts, geographyIdSet, period, level)
  }

  const legacyFacts = path.join(path.dirname(publicPath(entry.manifest)), "facts.json")
  try {
    await access(legacyFacts)
    fail(`${level} still exposes legacy monolithic facts.json`)
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Public projection verification failed:")) {
      throw error
    }
  }

  return {
    level,
    release_id: entry.release_id,
    geographies: profile.count,
    periods: 8,
    national_facts: EXPECTED_NATIONAL_FACTS,
    territorial_facts:
      profile.count * 8 * 2 * 2 * 3,
  }
}

const catalogPath = path.join(publicRoot, "data/catalog.json")
const catalog = await readJson(catalogPath)

if (catalog.schema_version === "atlas-public-catalog/v1") {
  console.log(
    "Public projection: legacy catalog/v1 bootstrap accepted; commissioned v2 assertions activate after the local real-data projection.",
  )
  process.exit(0)
}

invariant(
  catalog.schema_version === "atlas-public-catalog/v2",
  `unexpected catalog schema ${catalog.schema_version}`,
)
invariant(Array.isArray(catalog.releases), "catalog releases must be an array")
invariant(catalog.releases.length === 2, "commissioned catalog must contain exactly two releases")

const byLevel = new Map(catalog.releases.map((entry) => [entry.geography_level, entry]))
invariant(byLevel.size === 2, "catalog geography levels must be unique")
invariant(byLevel.has("province_2010"), "catalog missing province_2010")
invariant(byLevel.has("department_2010"), "catalog missing department_2010")
invariant(
  catalog.default_release_id === byLevel.get("province_2010").release_id,
  "province_2010 must remain the default release",
)

const results = []
for (const level of ["province_2010", "department_2010"]) {
  results.push(await verifyRelease(byLevel.get(level)))
}

console.log("Public projection verification: PASS")
for (const result of results) {
  console.log(
    `${result.level}: ${result.geographies} geographies, ${result.periods} periods, ${result.national_facts} national facts, ${result.territorial_facts} territorial facts`,
  )
}
