export const universes = ["persons", "households"] as const
export const concepts = ["poverty", "indigence"] as const
export const estimands = ["fgt0", "fgt1", "fgt2"] as const

export type Universe = (typeof universes)[number]
export type Concept = (typeof concepts)[number]
export type Estimand = (typeof estimands)[number]
export type PeriodId = string

export interface ReleasePeriod {
  id: PeriodId
  label: string
}

export interface ReleaseGeography {
  id: string
  name: string
  shortName: string
}

export interface PovertyFact {
  period: PeriodId
  universe: Universe
  concept: Concept
  estimand: Estimand
  geography_level: "province_2010" | "national"
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
  geography_level: "province_2010"
  national_geography: { id: "ARG"; name: string }
  parents: Record<string, string>
  comparability: Record<string, string>
}

export interface AtlasRelease {
  metadata: AtlasReleaseMetadata
  geographies: ReleaseGeography[]
  facts: PovertyFact[]
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
  assert(metadata.periods.length > 0, "at least one period is required")
  assert(metadata.national_geography.id === "ARG", "national geography must be ARG")

  const periodIds = new Set(metadata.periods.map((period) => period.id))
  assert(periodIds.size === metadata.periods.length, "period IDs must be unique")

  const geographyIds = new Set(geographies.map((geography) => geography.id))
  assert(geographyIds.size === geographies.length, "geography IDs must be unique")
  assert(
    geographies.every((geography) => /^\d{2}$/.test(geography.id)),
    "province IDs must remain two-character strings",
  )

  const seenFactKeys = new Set<string>()
  for (const fact of facts) {
    assert(periodIds.has(fact.period), `unsupported period ${fact.period}`)
    assert(universes.includes(fact.universe), `unsupported universe ${fact.universe}`)
    assert(concepts.includes(fact.concept), `unsupported concept ${fact.concept}`)
    assert(estimands.includes(fact.estimand), `unsupported estimand ${fact.estimand}`)
    assert(Number.isFinite(fact.estimate), `non-finite estimate for ${factKey(fact)}`)
    assert(fact.estimate >= 0 && fact.estimate <= 1, `estimate outside [0,1] for ${factKey(fact)}`)

    if (fact.geography_level === "national") {
      assert(fact.geography_id === "ARG", "national facts must use geography_id ARG")
    } else {
      assert(
        geographyIds.has(fact.geography_id),
        `incompatible geography ID ${fact.geography_id}`,
      )
    }

    const key = factKey(fact)
    assert(!seenFactKeys.has(key), `duplicate fact key ${key}`)
    seenFactKeys.add(key)

    if (fact.uncertainty_status === "not_supplied") {
      assert(fact.standard_error === undefined, `standard_error supplied while uncertainty is absent for ${key}`)
      assert(fact.ci_lower === undefined && fact.ci_upper === undefined, `CI supplied while uncertainty is absent for ${key}`)
      assert(fact.cv === undefined, `cv supplied while uncertainty is absent for ${key}`)
      assert(fact.uncertainty_method === undefined, `uncertainty_method supplied while uncertainty is absent for ${key}`)
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
