export const periods = [
  { id: "demo-2023-S2", label: "Demo 2023 · S2" },
  { id: "demo-2024-S1", label: "Demo 2024 · S1" },
  { id: "demo-2024-S2", label: "Demo 2024 · S2" },
  { id: "demo-2025-S1", label: "Demo 2025 · S1" },
  { id: "demo-2025-S2", label: "Demo 2025 · S2" },
  { id: "demo-2026-S1", label: "Demo 2026 · S1" },
] as const

export const universes = ["persons", "households"] as const
export const concepts = ["poverty", "indigence"] as const
export const estimands = ["fgt0", "fgt1", "fgt2"] as const

export type PeriodId = (typeof periods)[number]["id"]
export type Universe = (typeof universes)[number]
export type Concept = (typeof concepts)[number]
export type Estimand = (typeof estimands)[number]

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

export interface Province {
  id: string
  name: string
  shortName: string
  fixtureBase: number
}

export const provinces: Province[] = [
  { id: "02", name: "Ciudad Autónoma de Buenos Aires", shortName: "CABA", fixtureBase: 0.18 },
  { id: "06", name: "Buenos Aires", shortName: "Buenos Aires", fixtureBase: 0.37 },
  { id: "10", name: "Catamarca", shortName: "Catamarca", fixtureBase: 0.41 },
  { id: "14", name: "Córdoba", shortName: "Córdoba", fixtureBase: 0.31 },
  { id: "18", name: "Corrientes", shortName: "Corrientes", fixtureBase: 0.47 },
  { id: "22", name: "Chaco", shortName: "Chaco", fixtureBase: 0.53 },
  { id: "26", name: "Chubut", shortName: "Chubut", fixtureBase: 0.26 },
  { id: "30", name: "Entre Ríos", shortName: "Entre Ríos", fixtureBase: 0.34 },
  { id: "34", name: "Formosa", shortName: "Formosa", fixtureBase: 0.51 },
  { id: "38", name: "Jujuy", shortName: "Jujuy", fixtureBase: 0.45 },
  { id: "42", name: "La Pampa", shortName: "La Pampa", fixtureBase: 0.24 },
  { id: "46", name: "La Rioja", shortName: "La Rioja", fixtureBase: 0.39 },
  { id: "50", name: "Mendoza", shortName: "Mendoza", fixtureBase: 0.33 },
  { id: "54", name: "Misiones", shortName: "Misiones", fixtureBase: 0.49 },
  { id: "58", name: "Neuquén", shortName: "Neuquén", fixtureBase: 0.28 },
  { id: "62", name: "Río Negro", shortName: "Río Negro", fixtureBase: 0.29 },
  { id: "66", name: "Salta", shortName: "Salta", fixtureBase: 0.48 },
  { id: "70", name: "San Juan", shortName: "San Juan", fixtureBase: 0.36 },
  { id: "74", name: "San Luis", shortName: "San Luis", fixtureBase: 0.27 },
  { id: "78", name: "Santa Cruz", shortName: "Santa Cruz", fixtureBase: 0.22 },
  { id: "82", name: "Santa Fe", shortName: "Santa Fe", fixtureBase: 0.32 },
  { id: "86", name: "Santiago del Estero", shortName: "Santiago del Estero", fixtureBase: 0.5 },
  { id: "90", name: "Tucumán", shortName: "Tucumán", fixtureBase: 0.46 },
  { id: "94", name: "Tierra del Fuego, Antártida e Islas del Atlántico Sur", shortName: "Tierra del Fuego", fixtureBase: 0.2 },
]

const periodAdjustment: Record<PeriodId, number> = {
  "demo-2023-S2": 0.045,
  "demo-2024-S1": 0.025,
  "demo-2024-S2": 0.012,
  "demo-2025-S1": -0.004,
  "demo-2025-S2": -0.018,
  "demo-2026-S1": -0.026,
}

const nationalBase: Record<PeriodId, number> = {
  "demo-2023-S2": 0.39,
  "demo-2024-S1": 0.375,
  "demo-2024-S2": 0.358,
  "demo-2025-S1": 0.342,
  "demo-2025-S2": 0.329,
  "demo-2026-S1": 0.318,
}

function clamp(value: number) {
  return Math.min(0.88, Math.max(0.025, value))
}

function transformFixtureValue(
  incidence: number,
  universe: Universe,
  concept: Concept,
  estimand: Estimand,
) {
  let value = incidence
  if (universe === "households") value *= 0.91
  if (concept === "indigence") value *= 0.29
  if (estimand === "fgt1") value *= 0.34
  if (estimand === "fgt2") value *= 0.16
  return clamp(value)
}

/**
 * Fixture-only synthetic generator for W1 UI proof.
 * W2 replaces this module with a deterministic atlas-consumable release artifact.
 */
export function fixtureEstimate(
  geographyId: string,
  period: PeriodId,
  universe: Universe,
  concept: Concept,
  estimand: Estimand,
) {
  const incidence =
    geographyId === "ARG"
      ? nationalBase[period]
      : (provinces.find((province) => province.id === geographyId)?.fixtureBase ??
          nationalBase[period]) + periodAdjustment[period]

  return transformFixtureValue(incidence, universe, concept, estimand)
}

export function getProvince(id: string | null) {
  return provinces.find((province) => province.id === id) ?? null
}

export function getPeriodLabel(id: PeriodId) {
  return periods.find((period) => period.id === id)?.label ?? id
}
