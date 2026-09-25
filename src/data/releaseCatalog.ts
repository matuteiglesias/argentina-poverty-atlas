import {
  concepts,
  estimands,
  validateAtlasRelease,
  type AtlasRelease,
  type AtlasReleaseMetadata,
  type Concept,
  type Estimand,
  type PeriodId,
  type PovertyFact,
  type ReleaseGeography,
} from "@/data/release"

export const labels = {
  universes: { persons: "Personas", households: "Hogares" },
  concepts: { poverty: "Pobreza", indigence: "Indigencia" },
  estimands: { fgt0: "Incidencia", fgt1: "Brecha", fgt2: "Severidad" },
} as const

export interface AtlasReleaseDescriptor {
  metadata: AtlasReleaseMetadata
  geographies: ReleaseGeography[]
  metadataUrl: string
  geographiesUrl: string
  nationalUrl: string
  manifestUrl: string
  factsByPeriod: Record<PeriodId, string>
  legendMax: Record<string, number>
  embeddedFacts?: readonly PovertyFact[]
}

export function legendDomainKey(concept: Concept, estimand: Estimand) {
  return `${concept}|${estimand}`
}

function roundLegendDomain(max: number) {
  const step = max <= 0.1 ? 0.02 : max <= 0.3 ? 0.05 : 0.1
  return Math.max(step, Math.ceil(max / step) * step)
}

export function legendDomainsFromFacts(facts: readonly PovertyFact[]) {
  const result: Record<string, number> = {}
  for (const concept of concepts) {
    for (const estimand of estimands) {
      const values = facts
        .filter(
          (fact) =>
            fact.geography_level !== "national" &&
            fact.concept === concept &&
            fact.estimand === estimand,
        )
        .map((fact) => fact.estimate)
      result[legendDomainKey(concept, estimand)] = roundLegendDomain(
        values.length > 0 ? Math.max(...values) : 0,
      )
    }
  }
  return result
}

export function descriptorFromEmbeddedRelease(
  release: AtlasRelease,
): AtlasReleaseDescriptor {
  validateAtlasRelease(release)
  return validateReleaseDescriptor({
    metadata: release.metadata,
    geographies: release.geographies,
    metadataUrl: `embedded:${release.metadata.release_id}:metadata`,
    geographiesUrl: `embedded:${release.metadata.release_id}:geographies`,
    nationalUrl: `embedded:${release.metadata.release_id}:national`,
    manifestUrl: `embedded:${release.metadata.release_id}:manifest`,
    factsByPeriod: Object.fromEntries(
      release.metadata.periods.map((period) => [
        period.id,
        `embedded:${release.metadata.release_id}:${period.id}`,
      ]),
    ),
    legendMax: legendDomainsFromFacts(release.facts),
    embeddedFacts: release.facts,
  })
}

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Release descriptor validation failed: ${message}`)
}

export function validateReleaseDescriptor(
  descriptor: AtlasReleaseDescriptor,
): AtlasReleaseDescriptor {
  validateAtlasRelease({
    metadata: descriptor.metadata,
    geographies: descriptor.geographies,
    facts: [],
  })
  invariant(Boolean(descriptor.metadataUrl), "metadataUrl is required")
  invariant(Boolean(descriptor.geographiesUrl), "geographiesUrl is required")
  invariant(Boolean(descriptor.nationalUrl), "nationalUrl is required")
  invariant(Boolean(descriptor.manifestUrl), "manifestUrl is required")

  const periodIds = descriptor.metadata.periods.map((period) => period.id)
  invariant(
    periodIds.every((period) => Boolean(descriptor.factsByPeriod[period])),
    "every declared period requires a facts URL",
  )
  invariant(
    Object.keys(descriptor.factsByPeriod).every((period) => periodIds.includes(period)),
    "factsByPeriod cannot contain undeclared periods",
  )

  for (const concept of concepts) {
    for (const estimand of estimands) {
      const key = legendDomainKey(concept, estimand)
      const max = descriptor.legendMax[key]
      invariant(Number.isFinite(max) && max > 0, `legendMax ${key} must be positive`)
    }
  }
  return descriptor
}

export function validateReleaseDescriptors(
  descriptors: readonly AtlasReleaseDescriptor[],
): AtlasReleaseDescriptor[] {
  return descriptors.map((descriptor) => validateReleaseDescriptor(descriptor))
}
