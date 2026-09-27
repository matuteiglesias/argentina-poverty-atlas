import { createHash } from "node:crypto"
import { access, readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const publicRoot = path.join(root, "public")
const PROFILES = {
  province_2010: { count: 24, id: /^\d{2}$/ },
  department_2010: { count: 525, id: /^\d{5}$/ },
}
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

function validatePeriodEnvelope(periods, level) {
  invariant(Array.isArray(periods) && periods.length > 0, `${level} periods must be nonempty`)
  const parsed = periods.map((period) => {
    const match = /^(20\d{2})-Q([1-4])$/.exec(String(period))
    invariant(Boolean(match), `${level} has invalid period ${period}`)
    return { id: String(period), ordinal: Number(match[1]) * 4 + Number(match[2]) }
  })
  invariant(
    new Set(parsed.map((item) => item.id)).size === parsed.length,
    `${level} periods contain duplicates`,
  )
  for (let index = 1; index < parsed.length; index += 1) {
    invariant(
      parsed[index].ordinal === parsed[index - 1].ordinal + 1,
      `${level} periods must form one ordered contiguous quarterly envelope`,
    )
  }
  return parsed.map((item) => item.id)
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
  const aggregateUrl = entry.aggregate ?? entry.national
  invariant(Boolean(aggregateUrl), `${level} catalog requires aggregate or legacy national URL`)
  const aggregateFacts = await readJson(publicPath(aggregateUrl))
  const manifest = await readJson(publicPath(entry.manifest))

  invariant(metadata.release_id === entry.release_id, `${level} release_id drift`)
  invariant(metadata.geography_level === level, `${level} metadata level drift`)
  const periods = validatePeriodEnvelope(
    metadata.periods.map((item) => item.id),
    level,
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
  invariant(manifest.period_count === periods.length, `${level} manifest period count drift`)

  for (const [relative, expectedHash] of Object.entries(manifest.files ?? {})) {
    const bytes = await readFile(path.join(path.dirname(publicPath(entry.manifest)), relative))
    invariant(
      sha256(bytes) === expectedHash,
      `${level} checksum mismatch for ${relative}`,
    )
  }

  const expectedAggregateFacts = periods.length * 2 * 2 * 3
  invariant(
    Array.isArray(aggregateFacts) && aggregateFacts.length === expectedAggregateFacts,
    `${level} aggregate facts must contain exactly ${expectedAggregateFacts} facts`,
  )
  const aggregateKeys = new Set()
  for (const fact of aggregateFacts) {
    invariant(fact.geography_level === "national", `${level} aggregate file contains territorial fact`)
    invariant(fact.geography_id === "ARG", `${level} aggregate fact is not ARG`)
    invariant(periods.includes(fact.period), `${level} aggregate fact has invalid period`)
    const key = [fact.period, factCellKey(fact)].join("|")
    invariant(!aggregateKeys.has(key), `${level} duplicate aggregate fact ${key}`)
    aggregateKeys.add(key)
  }
  invariant(aggregateKeys.size === expectedAggregateFacts, `${level} aggregate cube incomplete`)

  const factPeriods = Object.keys(entry.facts_by_period ?? {})
  invariant(
    exactArray(factPeriods, periods),
    `${level} facts_by_period differs from metadata periods`,
  )

  for (const period of periods) {
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
    periods: periods.length,
    national_facts: expectedAggregateFacts,
    territorial_facts:
      profile.count * periods.length * 2 * 2 * 3,
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
