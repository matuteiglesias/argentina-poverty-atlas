export const universes = ["persons", "households"] as const
export const concepts = ["poverty", "indigence"] as const
export const estimands = ["fgt0", "fgt1", "fgt2"] as const
export const geographyLevels = ["province_2010", "department_2010", "eph_agglomerate"] as const
export const aggregateGeographyLevels = ["national", "eph_coverage"] as const

export type Universe = (typeof universes)[number]
export type Concept = (typeof concepts)[number]
export type Estimand = (typeof estimands)[number]
export type GeographyLevel = (typeof geographyLevels)[number]
export type AggregateGeographyLevel = (typeof aggregateGeographyLevels)[number]
export type PeriodId = string

export interface ReleasePeriod {
  id: PeriodId
  label: string
}

export interface ReleaseGeography {
  id: string
  name: string
  shortName: string
  provinceId?: string
  provinceName?: string
}

export interface PovertyFact {
  period: PeriodId
  universe: Universe
  concept: Concept
  estimand: Estimand
  geography_level: GeographyLevel | AggregateGeographyLevel
  geography_id: string
  estimate: number
  uncertainty_status: "not_supplied" | string
  quality_status: string
  coverage?: number
  warning_codes?: string[]
  standard_error?: number
  ci_lower?: number
  ci_upper?: number
  cv?: number
  uncertainty_method?: string
}

export interface AtlasReleaseMetadata {
  schema_version: string
  release_id: string
  scientific_status: string
  not_for_interpretation: boolean
  periods: ReleasePeriod[]
  universes: Universe[]
  concepts: Concept[]
  estimands: Estimand[]
  geography_level: GeographyLevel
  aggregate_geography?: { level: AggregateGeographyLevel; id: string; name: string }
  /** Legacy compatibility for province/department fixture descriptors. */
  national_geography?: { id: "ARG"; name: string }
  parents: Record<string, string>
  comparability: Record<string, string>
}

export interface AtlasRelease {
  metadata: AtlasReleaseMetadata
  geographies: ReleaseGeography[]
  facts: PovertyFact[]
}

const geographyProfiles: Record<
  GeographyLevel,
  { pattern: RegExp; expectedCount: number }
> = {
  province_2010: { pattern: /^\d{2}$/, expectedCount: 24 },
  department_2010: { pattern: /^\d{5}$/, expectedCount: 525 },
  eph_agglomerate: { pattern: /^\d{2}$/, expectedCount: 32 },
}

export function geographyProfile(level: GeographyLevel) {
  return geographyProfiles[level]
}


export function aggregateGeography(metadata: AtlasReleaseMetadata) {
  if (metadata.aggregate_geography) return metadata.aggregate_geography
  assert(
    metadata.national_geography?.id === "ARG",
    "release requires aggregate_geography or legacy national_geography",
  )
  return {
    level: "national" as const,
    id: "ARG",
    name: metadata.national_geography.name,
  }
}

export function factKey(fact: PovertyFact) {
  return [
    fact.period,
    fact.universe,
    fact.concept,
    fact.estimand,
    fact.geography_level,
    fact.geography_id,
  ].join("|")
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Atlas release validation failed: ${message}`)
}

export function validateAtlasRelease(release: AtlasRelease) {
  const { metadata, geographies, facts } = release
  assert(Boolean(metadata.release_id), "release_id is required")
  assert(
    geographyLevels.includes(metadata.geography_level),
    `unsupported geography level ${metadata.geography_level}`,
  )
  assert(metadata.periods.length > 0, "at least one period is required")
  const aggregate = aggregateGeography(metadata)
  assert(
    aggregateGeographyLevels.includes(aggregate.level),
    `unsupported aggregate geography level ${aggregate.level}`,
  )
  assert(Boolean(aggregate.id), "aggregate geography ID is required")

  const periodIds = new Set(metadata.periods.map((period) => period.id))
  assert(periodIds.size === metadata.periods.length, "period IDs must be unique")

  const geographyIds = new Set(geographies.map((geography) => geography.id))
  assert(geographyIds.size === geographies.length, "geography IDs must be unique")
  const profile = geographyProfile(metadata.geography_level)
  assert(
    geographies.every((geography) => profile.pattern.test(geography.id)),
    `${metadata.geography_level} IDs violate the governed string format`,
  )

  const seenFactKeys = new Set<string>()
  for (const fact of facts) {
    assert(periodIds.has(fact.period), `unsupported period ${fact.period}`)
    assert(universes.includes(fact.universe), `unsupported universe ${fact.universe}`)
    assert(concepts.includes(fact.concept), `unsupported concept ${fact.concept}`)
    assert(estimands.includes(fact.estimand), `unsupported estimand ${fact.estimand}`)
    assert(Number.isFinite(fact.estimate), `non-finite estimate for ${factKey(fact)}`)
    assert(
      fact.estimate >= 0 && fact.estimate <= 1,
      `estimate outside [0,1] for ${factKey(fact)}`,
    )

    if (fact.geography_level === aggregate.level) {
      assert(
        fact.geography_id === aggregate.id,
        `aggregate facts must use geography_id ${aggregate.id}`,
      )
    } else {
      assert(
        fact.geography_level === metadata.geography_level,
        `fact geography level ${fact.geography_level} differs from release level ${metadata.geography_level}`,
      )
      assert(
        geographyIds.has(fact.geography_id),
        `incompatible geography ID ${fact.geography_id}`,
      )
    }

    const key = factKey(fact)
    assert(!seenFactKeys.has(key), `duplicate fact key ${key}`)
    seenFactKeys.add(key)

    if (fact.uncertainty_status === "not_supplied") {
      assert(
        fact.standard_error === undefined,
        `standard_error supplied while uncertainty is absent for ${key}`,
      )
      assert(
        fact.ci_lower === undefined && fact.ci_upper === undefined,
        `CI supplied while uncertainty is absent for ${key}`,
      )
      assert(fact.cv === undefined, `cv supplied while uncertainty is absent for ${key}`)
      assert(
        fact.uncertainty_method === undefined,
        `uncertainty_method supplied while uncertainty is absent for ${key}`,
      )
    }
  }

  return release
}

export function assertW2FixtureRelease(release: AtlasRelease) {
  validateAtlasRelease(release)
  const { metadata, geographies, facts } = release
  assert(metadata.schema_version === "atlas-fixture-release/v1", "unexpected fixture schema")
  assert(metadata.scientific_status === "synthetic_fixture", "fixture status must be synthetic_fixture")
  assert(metadata.not_for_interpretation === true, "fixture must be marked not_for_interpretation")
  assert(metadata.geography_level === "province_2010", "W2 fixture remains province_2010")
  assert(geographies.length === 24, "W2 requires exactly 24 jurisdictions")
  assert(metadata.periods.length >= 6 && metadata.periods.length <= 8, "W2 requires 6–8 periods")
  assert(JSON.stringify(metadata.universes) === JSON.stringify(universes), "W2 universe set mismatch")
  assert(JSON.stringify(metadata.concepts) === JSON.stringify(concepts), "W2 concept set mismatch")
  assert(JSON.stringify(metadata.estimands) === JSON.stringify(estimands), "W2 estimand set mismatch")

  const expectedFacts =
    (geographies.length + 1) *
    metadata.periods.length *
    metadata.universes.length *
    metadata.concepts.length *
    metadata.estimands.length
  assert(facts.length === expectedFacts, `canonical W2 release must contain ${expectedFacts} facts`)
  return release
}
