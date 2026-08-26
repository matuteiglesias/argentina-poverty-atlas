export {
  concepts,
  estimands,
  fixtureRelease,
  getEstimate,
  getFact,
  getPeriodLabel,
  getProvince,
  labels,
  periods,
  provinces,
  universes,
  type Concept,
  type Estimand,
  type PeriodId,
  type PovertyFact,
  type Universe,
} from "@/data/fixtureRelease"

import {
  getEstimate,
  type Concept,
  type Estimand,
  type PeriodId,
  type Universe,
} from "@/data/fixtureRelease"

/**
 * W1 compatibility seam. Values now come from the materialized W2 release fact
 * index; no estimate is calculated by presentation components.
 */
export function fixtureEstimate(
  geographyId: string,
  period: PeriodId,
  universe: Universe,
  concept: Concept,
  estimand: Estimand,
) {
  const estimate = getEstimate(geographyId, period, universe, concept, estimand)
  if (estimate === null) {
    throw new Error(
      `Canonical W2 fixture is missing ${period}/${universe}/${concept}/${estimand}/${geographyId}`,
    )
  }
  return estimate
}
