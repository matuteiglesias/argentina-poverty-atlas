import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import path from "node:path"

export const REQUIRED_RELEASE_FILES = [
  "poverty_estimates.csv",
  "capabilities.json",
  "geography_join_contract.json",
  "release_manifest.json",
  "run_qa.json",
  "LIMITATIONS.md",
  "checksums.sha256",
]

export const GEOGRAPHY_PROFILES = {
  province_2010: { pattern: /^\d{2}$/, expectedCount: 24 },
  department_2010: { pattern: /^\d{5}$/, expectedCount: 525 },
  eph_agglomerate: { pattern: /^\d{2}$/, expectedCount: 32 },
}
const NON_SPATIAL_LEVELS = new Set(["national", "eph_coverage"])

const EXPECTED_HEADERS = [
  "release_id",
  "estimation_period",
  "frame_vintage",
  "universe",
  "geography_level",
  "geography_id",
  "concept",
  "estimand",
  "estimate",
  "unit",
  "weighted_numerator",
  "weighted_denominator",
  "coverage",
  "design_id",
  "weight_semantics",
  "uncertainty_status",
]
const EXPECTED_UNIVERSES = ["households", "persons"]
const EXPECTED_CONCEPTS = ["indigence", "poverty"]
const EXPECTED_ESTIMANDS = ["fgt0", "fgt1", "fgt2"]
const ACCEPTED_STATUSES = new Set(["research_estimate", "synthetic_fixture"])

function fail(message) {
  throw new Error(`Poverty release ingest failed: ${message}`)
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex")
}

function parseCsv(text) {
  const lines = text.trimEnd().split(/\r?\n/)
  const headers = lines.shift()?.split(",") ?? []
  return {
    headers,
    rows: lines.filter(Boolean).map((line) => {
      const cells = line.split(",")
      if (cells.length !== headers.length) fail("poverty_estimates.csv contains an unsupported quoted/comma field")
      return Object.fromEntries(headers.map((header, index) => [header, cells[index]]))
    }),
  }
}

function exactSet(left, right) {
  return left.size === right.size && [...left].every((value) => right.has(value))
}

function normalizedDimension(value, fallback) {
  if (!Array.isArray(value) || value.length === 0) return [...fallback]
  return [...value].map(String).sort()
}

function geographyMetadata(capabilities, ids, geographyLevel) {
  const declared = Array.isArray(capabilities.geographies) ? capabilities.geographies : []
  const byId = new Map(
    declared
      .filter((item) => item && typeof item.id === "string")
      .map((item) => [item.id, item]),
  )
  return [...ids].sort().map((id) => {
    const item = byId.get(id)
    return {
      id,
      name: item?.name ?? id,
      shortName: item?.short_name ?? item?.name ?? id,
      ...(geographyLevel === "department_2010" ? { provinceId: id.slice(0, 2) } : {}),
    }
  })
}

export async function verifyDetachedRelease(directory) {
  const dir = path.resolve(directory)
  for (const name of REQUIRED_RELEASE_FILES) {
    try {
      await readFile(path.join(dir, name))
    } catch {
      fail(`missing required file ${name}: ${dir}`)
    }
  }

  const checksumLines = (await readFile(path.join(dir, "checksums.sha256"), "utf8"))
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
  if (checksumLines.length === 0) fail("checksum inventory must be nonempty")
  for (const line of checksumLines) {
    const [digest, name] = line.split(/  /)
    if (!digest || !name || !REQUIRED_RELEASE_FILES.includes(name) || name === "checksums.sha256") {
      fail(`checksum inventory contains unsupported entry ${line}`)
    }
    if (sha256(await readFile(path.join(dir, name))) !== digest) {
      fail(`checksum mismatch for ${name}`)
    }
  }

  const manifest = JSON.parse(await readFile(path.join(dir, "release_manifest.json"), "utf8"))
  if (manifest.schema_version !== "poverty-estimate-release/v2") fail("unsupported release schema")
  if (manifest.artifact_type !== undefined && manifest.artifact_type !== "poverty-estimate-release/v2") {
    fail("unsupported artifact type")
  }
  if (!ACCEPTED_STATUSES.has(manifest.scientific_status)) fail("unsupported scientific status")
  if (manifest.uncertainty_status !== "not_supplied") fail("unsupported uncertainty status")

  const capabilities = JSON.parse(await readFile(path.join(dir, "capabilities.json"), "utf8"))
  const geography = JSON.parse(
    await readFile(path.join(dir, "geography_join_contract.json"), "utf8"),
  )
  if (capabilities.schema_version !== "poverty-estimate-capabilities/v1") {
    fail("unsupported capabilities schema")
  }
  if (geography.join_semantics !== "exact_governed_id") fail("unsupported geography join semantics")
  if (geography.geometry_embedded === true) fail("poverty release cannot embed geometry")
  if (geography.numeric_coercion_allowed === true) fail("numeric geography coercion is forbidden")
  if (geography.fuzzy_matching_allowed === true) fail("fuzzy geography matching is forbidden")

  const parsed = parseCsv(await readFile(path.join(dir, "poverty_estimates.csv"), "utf8"))
  if (parsed.headers.join("|") !== EXPECTED_HEADERS.join("|")) {
    fail("poverty_estimates.csv schema differs from the consumer contract")
  }
  if (parsed.rows.length === 0) fail("poverty estimate table must be nonempty")

  const keys = new Set()
  const spatialLevels = new Set()
  const aggregateIdentities = new Set()
  const periods = new Set()
  const releaseIds = new Set()
  const frameVintages = new Set()
  const universes = new Set()
  const concepts = new Set()
  const estimands = new Set()
  for (const row of parsed.rows) {
    const key = [
      row.estimation_period,
      row.universe,
      row.concept,
      row.estimand,
      row.geography_level,
      row.geography_id,
    ].join("|")
    if (keys.has(key)) fail(`duplicate fact key ${key}`)
    keys.add(key)

    const estimate = Number(row.estimate)
    const numerator = Number(row.weighted_numerator)
    const denominator = Number(row.weighted_denominator)
    const coverage = Number(row.coverage)
    if (!Number.isFinite(estimate) || estimate < 0 || estimate > 1) fail(`invalid estimate ${key}`)
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
      fail(`invalid persisted weighted components ${key}`)
    }
    if (!Number.isFinite(coverage)) fail(`invalid coverage ${key}`)
    if (row.unit !== "proportion" || row.uncertainty_status !== "not_supplied") {
      fail(`unsupported fact semantics ${key}`)
    }
    if (NON_SPATIAL_LEVELS.has(row.geography_level)) {
      aggregateIdentities.add(`${row.geography_level}|${row.geography_id}`)
    } else {
      spatialLevels.add(row.geography_level)
    }
    periods.add(row.estimation_period)
    releaseIds.add(row.release_id)
    frameVintages.add(row.frame_vintage)
    universes.add(row.universe)
    concepts.add(row.concept)
    estimands.add(row.estimand)
  }

  if (spatialLevels.size !== 1) fail("each detached release must contain exactly one spatial geography level")
  if (aggregateIdentities.size !== 1) {
    fail("each detached release must contain exactly one aggregate geography identity")
  }
  if (periods.size !== 1) fail("each detached release must contain exactly one estimation period")
  if (releaseIds.size !== 1) fail("fact rows must share one release_id")
  if (frameVintages.size !== 1) fail("fact rows must share one frame_vintage")

  const geographyLevel = [...spatialLevels][0]
  const profile = GEOGRAPHY_PROFILES[geographyLevel]
  if (!profile) fail(`unsupported geography level ${geographyLevel}`)
  const geographyIds = new Set(
    parsed.rows
      .filter((row) => row.geography_level === geographyLevel)
      .map((row) => row.geography_id),
  )
  if (geographyIds.size !== profile.expectedCount) {
    fail(`expected ${profile.expectedCount} ${geographyLevel} IDs, got ${geographyIds.size}`)
  }
  for (const id of geographyIds) {
    if (!profile.pattern.test(id)) fail(`invalid ${geographyLevel} ID ${id}`)
  }

  const declaredCapabilityIds = new Set(
    (capabilities.geographies ?? [])
      .map((item) => item?.id)
      .filter((id) => typeof id === "string"),
  )
  if (declaredCapabilityIds.size > 0 && !exactSet(geographyIds, declaredCapabilityIds)) {
    fail("facts and capabilities geography inventories differ")
  }
  const declaredContractIds = new Set(
    Array.isArray(geography.geography_ids) ? geography.geography_ids.map(String) : [],
  )
  if (declaredContractIds.size > 0 && !exactSet(geographyIds, declaredContractIds)) {
    fail("facts and geography join contract inventories differ")
  }
  if (
    geography.geography_level !== undefined &&
    geography.geography_level !== geographyLevel
  ) {
    fail("geography join contract level differs from facts")
  }
  const manifestLevel = manifest.geography_level
  if (manifestLevel !== undefined && manifestLevel !== geographyLevel) {
    fail("manifest geography level differs from facts")
  }

  const [aggregateLevel, aggregateId] = [...aggregateIdentities][0].split("|")
  if (aggregateLevel === "national") {
    if (aggregateId !== "ARG") fail("legacy national aggregate must use ARG")
    if (manifest.aggregate_geography !== undefined) {
      fail("legacy national/ARG release must not declare aggregate_geography")
    }
  } else {
    const declared = manifest.aggregate_geography
    if (
      !declared ||
      declared.level !== aggregateLevel ||
      declared.id !== aggregateId
    ) {
      fail("manifest aggregate_geography differs from aggregate facts")
    }
  }

  const period = [...periods][0]
  if (manifest.estimation_period !== period) fail("manifest period differs from facts")
  const expectedFactCount = profile.expectedCount * 12 + 12
  if (parsed.rows.length !== expectedFactCount) {
    fail(`expected ${expectedFactCount} facts, got ${parsed.rows.length}`)
  }

  const normalizedUniverses = [...universes].sort()
  const normalizedConcepts = [...concepts].sort()
  const normalizedEstimands = [...estimands].sort()
  if (normalizedUniverses.join("|") !== EXPECTED_UNIVERSES.join("|")) fail("universe cube differs")
  if (normalizedConcepts.join("|") !== EXPECTED_CONCEPTS.join("|")) fail("concept cube differs")
  if (normalizedEstimands.join("|") !== EXPECTED_ESTIMANDS.join("|")) fail("estimand cube differs")

  const capabilityUniverses = normalizedDimension(
    capabilities.universes ?? capabilities.dimensions?.universes,
    normalizedUniverses,
  )
  const capabilityConcepts = normalizedDimension(
    capabilities.concepts ?? capabilities.dimensions?.concepts,
    normalizedConcepts,
  )
  const capabilityEstimands = normalizedDimension(
    capabilities.estimands ?? capabilities.dimensions?.estimands,
    normalizedEstimands,
  )
  if (capabilityUniverses.join("|") !== normalizedUniverses.join("|")) fail("capabilities universes differ")
  if (capabilityConcepts.join("|") !== normalizedConcepts.join("|")) fail("capabilities concepts differ")
  if (capabilityEstimands.join("|") !== normalizedEstimands.join("|")) fail("capabilities estimands differ")

  const normalizedFacts = parsed.rows.map((row) => ({
    period: row.estimation_period,
    universe: row.universe,
    concept: row.concept,
    estimand: row.estimand,
    geography_level: row.geography_level,
    geography_id: row.geography_id,
    estimate: Number(row.estimate),
    uncertainty_status: row.uncertainty_status,
    quality_status: manifest.scientific_status,
    coverage: Number(row.coverage),
    warning_codes:
      manifest.scientific_status === "research_estimate"
        ? ["research_estimate", "not_official_statistics"]
        : ["synthetic_fixture"],
  }))

  return {
    directory: dir,
    manifest,
    capabilities,
    geography,
    geographyLevel,
    geographyIds: [...geographyIds].sort(),
    geographies: geographyMetadata(capabilities, geographyIds, geographyLevel),
    period,
    frameVintage: [...frameVintages][0],
    universes: normalizedUniverses,
    concepts: normalizedConcepts,
    estimands: normalizedEstimands,
    rows: parsed.rows,
    facts: normalizedFacts,
    aggregate: {
      level: aggregateLevel,
      id: aggregateId,
      name: aggregateLevel === "national" ? "Argentina" : "Total aglomerados EPH",
    },
  }
}

function stableSetKey(values) {
  return [...values].sort().join("|")
}

export function projectVerifiedReleaseSet(releases, options = {}) {
  if (!Array.isArray(releases) || releases.length === 0) fail("release set must be nonempty")
  const level = releases[0].geographyLevel
  const geographyKey = stableSetKey(releases[0].geographyIds)
  const universeKey = releases[0].universes.join("|")
  const conceptKey = releases[0].concepts.join("|")
  const estimandKey = releases[0].estimands.join("|")
  const periods = new Set()
  const aggregateKey = `${releases[0].aggregate.level}|${releases[0].aggregate.id}`

  for (const release of releases) {
    if (release.geographyLevel !== level) fail("release set mixes geography levels")
    if (stableSetKey(release.geographyIds) !== geographyKey) fail("release set geography inventories differ")
    if (release.universes.join("|") !== universeKey) fail("release set universe cubes differ")
    if (release.concepts.join("|") !== conceptKey) fail("release set concept cubes differ")
    if (release.estimands.join("|") !== estimandKey) fail("release set estimand cubes differ")
    if (`${release.aggregate.level}|${release.aggregate.id}` !== aggregateKey) {
      fail("release set aggregate geography identities differ")
    }
    if (periods.has(release.period)) fail(`duplicate release-set period ${release.period}`)
    periods.add(release.period)
  }

  if (Array.isArray(options.expectedPeriods)) {
    const expected = new Set(options.expectedPeriods)
    if (!exactSet(periods, expected)) {
      fail(
        `release-set periods differ: expected ${[...expected].sort().join(",")}, got ${[
          ...periods,
        ]
          .sort()
          .join(",")}`,
      )
    }
  }

  const ordered = [...releases].sort((a, b) => a.period.localeCompare(b.period))
  const facts = ordered.flatMap((release) => release.facts)
  const factKeys = facts.map((fact) =>
    [
      fact.period,
      fact.universe,
      fact.concept,
      fact.estimand,
      fact.geography_level,
      fact.geography_id,
    ].join("|"),
  )
  if (new Set(factKeys).size !== facts.length) fail("release set contains duplicate fact keys")

  const releaseId =
    options.releaseId ??
    `atlas-poverty-release-set-${level.replace("_2010", "")}-${[
      ...periods,
    ]
      .sort()
      .join("_")
      .toLowerCase()}-v1`

  return {
    metadata: {
      schema_version: "atlas-poverty-release-set/v1",
      release_id: releaseId,
      scientific_status:
        ordered.every((release) => release.manifest.scientific_status === "research_estimate")
          ? "research_estimate"
          : "synthetic_fixture",
      not_for_interpretation: true,
      periods: ordered.map((release) => ({ id: release.period, label: release.period })),
      universes: [...ordered[0].universes],
      concepts: [...ordered[0].concepts],
      estimands: [...ordered[0].estimands],
      geography_level: level,
      aggregate_geography: { ...ordered[0].aggregate },
      ...(ordered[0].aggregate.level === "national" && ordered[0].aggregate.id === "ARG"
        ? { national_geography: { id: "ARG", name: "Argentina" } }
        : {}),
      parents: Object.fromEntries(
        ordered.map((release) => [release.period, String(release.manifest.release_id)]),
      ),
      comparability: {
        uncertainty: "not_supplied",
        status: "verified detached research releases; not official INDEC statistics",
      },
    },
    geographies: ordered[0].geographies,
    facts,
    sourceReleases: ordered,
  }
}

export async function verifyAndProjectReleaseSet(directories, options = {}) {
  const releases = []
  for (const directory of directories) {
    releases.push(await verifyDetachedRelease(directory))
  }
  return projectVerifiedReleaseSet(releases, options)
}
