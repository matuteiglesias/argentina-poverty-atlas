import { activeReleases } from "@/data/activeReleases"
import {
  geographyLevels,
  type AtlasRelease,
  type Concept,
  type Estimand,
  type GeographyLevel,
  type PeriodId,
  type PovertyFact,
  type ReleaseGeography,
  type ReleasePeriod,
  type Universe,
} from "@/data/release"

export interface ReleaseRegistry {
  releases: ReadonlyMap<GeographyLevel, AtlasRelease>
  availableLevels: readonly GeographyLevel[]
  defaultLevel: GeographyLevel
}

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Release registry validation failed: ${message}`)
}

export function makeReleaseRegistry(releases: readonly AtlasRelease[]): ReleaseRegistry {
  invariant(releases.length > 0, "at least one release is required")
  const byLevel = new Map<GeographyLevel, AtlasRelease>()
  for (const release of releases) {
    const level = release.metadata.geography_level
    invariant(geographyLevels.includes(level), `unsupported geography level ${level}`)
    invariant(!byLevel.has(level), `duplicate release for ${level}`)
    byLevel.set(level, release)
  }
  const availableLevels = geographyLevels.filter((level) => byLevel.has(level))
  invariant(availableLevels.length > 0, "no supported geography releases found")
  const defaultLevel = availableLevels.includes("province_2010")
    ? "province_2010"
    : availableLevels[0]
  return { releases: byLevel, availableLevels, defaultLevel }
}

export const releaseRegistry = makeReleaseRegistry(activeReleases)
export const availableGeographyLevels = releaseRegistry.availableLevels
export const defaultGeographyLevel = releaseRegistry.defaultLevel

export function getReleaseForLevel(level: GeographyLevel): AtlasRelease {
  const release = releaseRegistry.releases.get(level)
  if (!release) throw new Error(`No active release for geography level ${level}`)
  return release
}

export function getPeriodsForLevel(level: GeographyLevel): ReleasePeriod[] {
  return getReleaseForLevel(level).metadata.periods
}

export function getGeographiesForLevel(level: GeographyLevel): ReleaseGeography[] {
  return getReleaseForLevel(level).geographies
}

export function getGeography(level: GeographyLevel, id: string | null): ReleaseGeography | null {
  if (!id) return null
  return getGeographiesForLevel(level).find((geography) => geography.id === id) ?? null
}

export function getFactForLevel(
  level: GeographyLevel,
  geographyId: string,
  period: PeriodId,
  universe: Universe,
  concept: Concept,
  estimand: Estimand,
): PovertyFact | null {
  const release = getReleaseForLevel(level)
  const factLevel = geographyId === "ARG" ? "national" : level
  return (
    release.facts.find(
      (fact) =>
        fact.period === period &&
        fact.universe === universe &&
        fact.concept === concept &&
        fact.estimand === estimand &&
        fact.geography_level === factLevel &&
        fact.geography_id === geographyId,
    ) ?? null
  )
}

export function getEstimateForLevel(
  level: GeographyLevel,
  geographyId: string,
  period: PeriodId,
  universe: Universe,
  concept: Concept,
  estimand: Estimand,
): number | null {
  return getFactForLevel(level, geographyId, period, universe, concept, estimand)?.estimate ?? null
}

export function requireEstimateForLevel(
  level: GeographyLevel,
  geographyId: string,
  period: PeriodId,
  universe: Universe,
  concept: Concept,
  estimand: Estimand,
): number {
  const value = getEstimateForLevel(level, geographyId, period, universe, concept, estimand)
  if (value === null) {
    throw new Error(
      `Missing released fact for ${level}/${period}/${universe}/${concept}/${estimand}/${geographyId}`,
    )
  }
  return value
}

export const geographyLevelLabels: Record<GeographyLevel, string> = {
  province_2010: "Provincias",
  department_2010: "Departamentos",
}
