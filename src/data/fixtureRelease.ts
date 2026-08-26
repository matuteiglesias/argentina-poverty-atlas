import fixtureSpecJson from "../../fixtures/releases/w2-synthetic/release-spec.json"
import {
  assertW2FixtureRelease,
  concepts,
  estimands,
  factKey,
  universes,
  type AtlasRelease,
  type Concept,
  type Estimand,
  type PeriodId,
  type PovertyFact,
  type Universe,
} from "@/data/release"

interface FixtureSpec {
  release_id: string
  schema_version: string
  scientific_status: string
  not_for_interpretation: boolean
  geography_level: "province_2010"
  national_geography: { id: "ARG"; name: string }
  periods: Array<{
    id: string
    label: string
    adjustment: number
    national_base: number
  }>
  universes: Universe[]
  concepts: Concept[]
  estimands: Estimand[]
  parents: Record<string, string>
  comparability: Record<string, string>
  algorithm: {
    households_multiplier: number
    indigence_multiplier: number
    fgt1_multiplier: number
    fgt2_multiplier: number
    minimum: number
    maximum: number
    round_decimals: number
  }
  geographies: Array<{
    id: string
    name: string
    short_name: string
    incidence_base: number
  }>
}

const fixtureSpec = fixtureSpecJson as FixtureSpec

function transformFixtureValue(
  incidence: number,
  universe: Universe,
  concept: Concept,
  estimand: Estimand,
) {
  const algorithm = fixtureSpec.algorithm
  let value = incidence
  if (universe === "households") value *= algorithm.households_multiplier
  if (concept === "indigence") value *= algorithm.indigence_multiplier
  if (estimand === "fgt1") value *= algorithm.fgt1_multiplier
  if (estimand === "fgt2") value *= algorithm.fgt2_multiplier
  value = Math.min(algorithm.maximum, Math.max(algorithm.minimum, value))
  return Number(value.toFixed(algorithm.round_decimals))
}

function materializeFixtureRelease(): AtlasRelease {
  const facts: PovertyFact[] = []

  for (const period of fixtureSpec.periods) {
    for (const universe of fixtureSpec.universes) {
      for (const concept of fixtureSpec.concepts) {
        for (const estimand of fixtureSpec.estimands) {
          facts.push({
            period: period.id,
            universe,
            concept,
            estimand,
            geography_level: "national",
            geography_id: "ARG",
            estimate: transformFixtureValue(
              period.national_base,
              universe,
              concept,
              estimand,
            ),
            uncertainty_status: "not_supplied",
            quality_status: "fixture",
            coverage: 1,
            warning_codes: [],
          })

          for (const geography of fixtureSpec.geographies) {
            facts.push({
              period: period.id,
              universe,
              concept,
              estimand,
              geography_level: fixtureSpec.geography_level,
              geography_id: geography.id,
              estimate: transformFixtureValue(
                geography.incidence_base + period.adjustment,
                universe,
                concept,
                estimand,
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

  return assertW2FixtureRelease({
    metadata: {
      schema_version: "atlas-fixture-release/v1",
      release_id: fixtureSpec.release_id,
      scientific_status: fixtureSpec.scientific_status,
      not_for_interpretation: fixtureSpec.not_for_interpretation,
      periods: fixtureSpec.periods.map(({ id, label }) => ({ id, label })),
      universes: fixtureSpec.universes,
      concepts: fixtureSpec.concepts,
      estimands: fixtureSpec.estimands,
      geography_level: fixtureSpec.geography_level,
      national_geography: fixtureSpec.national_geography,
      parents: fixtureSpec.parents,
      comparability: fixtureSpec.comparability,
    },
    geographies: fixtureSpec.geographies.map(({ id, name, short_name }) => ({
      id,
      name,
      shortName: short_name,
    })),
    facts,
  })
}

export const fixtureRelease = materializeFixtureRelease()
export const periods = fixtureRelease.metadata.periods
export const provinces = fixtureRelease.geographies

export { concepts, estimands, universes }
export type { Concept, Estimand, PeriodId, PovertyFact, Universe }

export const labels = {
  universes: {
    persons: "Personas",
    households: "Hogares",
  },
  concepts: {
    poverty: "Pobreza",
    indigence: "Indigencia",
  },
  estimands: {
    fgt0: "Incidencia",
    fgt1: "Brecha",
    fgt2: "Severidad",
  },
} as const

const factIndex = new Map(fixtureRelease.facts.map((fact) => [factKey(fact), fact]))

export function getFact(
  geographyId: string,
  period: PeriodId,
  universe: Universe,
  concept: Concept,
  estimand: Estimand,
): PovertyFact | null {
  const geographyLevel = geographyId === "ARG" ? "national" : "province_2010"
  return (
    factIndex.get(
      [period, universe, concept, estimand, geographyLevel, geographyId].join("|"),
    ) ?? null
  )
}

export function getEstimate(
  geographyId: string,
  period: PeriodId,
  universe: Universe,
  concept: Concept,
  estimand: Estimand,
) {
  return getFact(geographyId, period, universe, concept, estimand)?.estimate ?? null
}

export function getProvince(id: string | null) {
  return provinces.find((province) => province.id === id) ?? null
}

export function getPeriodLabel(id: PeriodId) {
  return periods.find((period) => period.id === id)?.label ?? id
}
