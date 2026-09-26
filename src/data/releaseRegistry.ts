import { useEffect, useState } from "react"
import { activeReleases } from "@/data/activeReleases"
import {
  aggregateGeography,
  concepts,
  estimands,
  geographyLevels,
  universes,
  validateAtlasRelease,
  type Concept,
  type Estimand,
  type GeographyLevel,
  type PeriodId,
  type PovertyFact,
  type ReleaseGeography,
  type ReleasePeriod,
  type Universe,
} from "@/data/release"
import {
  legendDomainKey,
  type AtlasReleaseDescriptor,
} from "@/data/releaseCatalog"

export interface ReleaseRegistry {
  releases: ReadonlyMap<GeographyLevel, AtlasReleaseDescriptor>
  availableLevels: readonly GeographyLevel[]
  defaultLevel: GeographyLevel
}

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Release registry validation failed: ${message}`)
}

export function makeReleaseRegistry(
  releases: readonly AtlasReleaseDescriptor[],
): ReleaseRegistry {
  invariant(releases.length > 0, "at least one release is required")
  const byLevel = new Map<GeographyLevel, AtlasReleaseDescriptor>()
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

export function getReleaseForLevel(level: GeographyLevel): AtlasReleaseDescriptor {
  const release = releaseRegistry.releases.get(level)
  if (!release) throw new Error(`No active release for geography level ${level}`)
  return release
}

export function getPeriodsForLevel(level: GeographyLevel): ReleasePeriod[] {
  return getReleaseForLevel(level).metadata.periods
}

export function getPeriodLabel(level: GeographyLevel, id: PeriodId) {
  return getPeriodsForLevel(level).find((period) => period.id === id)?.label ?? id
}

export function getGeographiesForLevel(level: GeographyLevel): ReleaseGeography[] {
  return getReleaseForLevel(level).geographies
}

export function getGeography(
  level: GeographyLevel,
  id: string | null,
): ReleaseGeography | null {
  if (!id) return null
  return getGeographiesForLevel(level).find((geography) => geography.id === id) ?? null
}

const aggregateIndexes = new Map<GeographyLevel, Map<string, PovertyFact>>()
const periodIndexes = new Map<string, Map<string, PovertyFact>>()
const inFlight = new Map<string, Promise<void>>()

function periodCacheKey(level: GeographyLevel, period: PeriodId) {
  return `${level}|${period}`
}

function factLookupKey(
  geographyId: string,
  period: PeriodId,
  universe: Universe,
  concept: Concept,
  estimand: Estimand,
) {
  return [period, universe, concept, estimand, geographyId].join("|")
}

function indexFacts(facts: readonly PovertyFact[]) {
  return new Map(
    facts.map((fact) => [
      factLookupKey(
        fact.geography_id,
        fact.period,
        fact.universe,
        fact.concept,
        fact.estimand,
      ),
      fact,
    ]),
  )
}

function validateAggregateFacts(
  release: AtlasReleaseDescriptor,
  facts: PovertyFact[],
) {
  const aggregate = aggregateGeography(release.metadata)
  validateAtlasRelease({
    metadata: release.metadata,
    geographies: release.geographies,
    facts,
  })
  invariant(
    facts.every(
      (fact) =>
        fact.geography_level === aggregate.level &&
        fact.geography_id === aggregate.id,
    ),
    `${release.metadata.release_id} aggregate facts contain territorial rows`,
  )
  const expected =
    release.metadata.periods.length * universes.length * concepts.length * estimands.length
  invariant(
    facts.length === expected,
    `${release.metadata.release_id} aggregate partition must contain exactly ${expected} facts`,
  )
  return facts
}

function validatePeriodFacts(
  release: AtlasReleaseDescriptor,
  period: PeriodId,
  facts: PovertyFact[],
) {
  validateAtlasRelease({
    metadata: release.metadata,
    geographies: release.geographies,
    facts,
  })
  invariant(
    facts.every(
      (fact) =>
        fact.period === period &&
        fact.geography_level === release.metadata.geography_level &&
        fact.geography_id !== "ARG",
    ),
    `${release.metadata.release_id}/${period} contains facts outside its territorial partition`,
  )
  return facts
}

async function fetchFacts(url: string): Promise<PovertyFact[]> {
  const response = await fetch(url, { headers: { Accept: "application/json" } })
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`)
  const value: unknown = await response.json()
  invariant(Array.isArray(value), `${url} must contain a JSON array`)
  return value as PovertyFact[]
}

function embeddedAggregateFacts(release: AtlasReleaseDescriptor) {
  const aggregate = aggregateGeography(release.metadata)
  return (release.embeddedFacts ?? []).filter(
    (fact) =>
      fact.geography_level === aggregate.level &&
      fact.geography_id === aggregate.id,
  )
}

function embeddedPeriodFacts(
  release: AtlasReleaseDescriptor,
  period: PeriodId,
) {
  return (release.embeddedFacts ?? []).filter(
    (fact) =>
      fact.period === period &&
      fact.geography_level === release.metadata.geography_level,
  )
}

async function loadAggregateFacts(level: GeographyLevel) {
  if (aggregateIndexes.has(level)) return
  const key = `${level}|aggregate`
  const existing = inFlight.get(key)
  if (existing) return existing
  const release = getReleaseForLevel(level)
  const task = (async () => {
    const facts = release.embeddedFacts
      ? embeddedAggregateFacts(release)
      : await fetchFacts(release.aggregateUrl ?? release.nationalUrl!)
    aggregateIndexes.set(level, indexFacts(validateAggregateFacts(release, [...facts])))
  })().finally(() => inFlight.delete(key))
  inFlight.set(key, task)
  return task
}

async function loadPeriodFacts(level: GeographyLevel, period: PeriodId) {
  const cacheKey = periodCacheKey(level, period)
  if (periodIndexes.has(cacheKey)) return
  const existing = inFlight.get(cacheKey)
  if (existing) return existing
  const release = getReleaseForLevel(level)
  const url = release.factsByPeriod[period]
  invariant(Boolean(url), `${release.metadata.release_id} has no facts partition for ${period}`)
  const task = (async () => {
    const facts = release.embeddedFacts
      ? embeddedPeriodFacts(release, period)
      : await fetchFacts(url)
    periodIndexes.set(
      cacheKey,
      indexFacts(validatePeriodFacts(release, period, [...facts])),
    )
  })().finally(() => inFlight.delete(cacheKey))
  inFlight.set(cacheKey, task)
  return task
}

export async function loadReleaseData(level: GeographyLevel, period: PeriodId) {
  await Promise.all([loadAggregateFacts(level), loadPeriodFacts(level, period)])
}

export async function loadAllPeriodsForLevel(level: GeographyLevel) {
  const periods = getPeriodsForLevel(level)
  await Promise.all([
    loadAggregateFacts(level),
    ...periods.map((period) => loadPeriodFacts(level, period.id)),
  ])
}

export type ReleaseDataStatus =
  | { kind: "idle" | "loading" }
  | { kind: "ready" }
  | { kind: "error"; message: string }

export function useAllPeriodsForLevel(
  level: GeographyLevel,
  enabled = true,
): ReleaseDataStatus {
  const [status, setStatus] = useState<ReleaseDataStatus>(() =>
    enabled ? { kind: "loading" } : { kind: "idle" },
  )

  useEffect(() => {
    if (!enabled) {
      setStatus({ kind: "idle" })
      return
    }
    let cancelled = false
    setStatus({ kind: "loading" })
    void loadAllPeriodsForLevel(level)
      .then(() => {
        if (!cancelled) setStatus({ kind: "ready" })
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setStatus({
            kind: "error",
            message: error instanceof Error ? error.message : "No se pudo cargar la serie territorial",
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [enabled, level])

  return status
}

export function getFactForLevel(
  level: GeographyLevel,
  geographyId: string,
  period: PeriodId,
  universe: Universe,
  concept: Concept,
  estimand: Estimand,
): PovertyFact | null {
  const aggregate = aggregateGeography(getReleaseForLevel(level).metadata)
  const index =
    geographyId === aggregate.id
      ? aggregateIndexes.get(level)
      : periodIndexes.get(periodCacheKey(level, period))
  return (
    index?.get(factLookupKey(geographyId, period, universe, concept, estimand)) ?? null
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
  const value = getEstimateForLevel(
    level,
    geographyId,
    period,
    universe,
    concept,
    estimand,
  )
  if (value === null) {
    throw new Error(
      `Missing loaded fact for ${level}/${period}/${universe}/${concept}/${estimand}/${geographyId}`,
    )
  }
  return value
}

export function getLegendMaxForLevel(
  level: GeographyLevel,
  concept: Concept,
  estimand: Estimand,
) {
  const key = legendDomainKey(concept, estimand)
  const value = getReleaseForLevel(level).legendMax[key]
  invariant(Number.isFinite(value) && value > 0, `missing legend max ${key} for ${level}`)
  return value
}

export const geographyLevelLabels: Record<GeographyLevel, string> = {
  province_2010: "Provincias",
  department_2010: "Departamentos",
  eph_agglomerate: "Aglomerados EPH",
}
