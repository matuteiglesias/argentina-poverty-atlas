import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
  projectVerifiedReleaseSet,
  verifyDetachedRelease,
  verifyAndProjectReleaseSet,
} from "./poverty-release-set.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const CANONICAL_EIGHT_PERIODS = [
  "2024-Q1",
  "2024-Q2",
  "2024-Q3",
  "2024-Q4",
  "2025-Q1",
  "2025-Q2",
  "2025-Q3",
  "2025-Q4",
]

function fail(message) {
  throw new Error(`Poverty release ingest failed: ${message}`)
}
function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex")
}
function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

function parentStrings(value) {
  if (Array.isArray(value)) {
    return Object.fromEntries(
      value.map((item, index) => [
        String(item?.role ?? `parent_${index + 1}`),
        String(item?.release_id ?? item?.release ?? item?.manifest_sha256 ?? "unknown"),
      ]),
    )
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        typeof item === "string" ? item : JSON.stringify(item),
      ]),
    )
  }
  return {}
}

function singleReleaseProjection(release) {
  return {
    metadata: {
      schema_version: release.manifest.schema_version,
      release_id: release.manifest.release_id,
      scientific_status: release.manifest.scientific_status,
      not_for_interpretation: true,
      periods: [{ id: release.period, label: release.period }],
      universes: [...release.universes],
      concepts: [...release.concepts],
      estimands: [...release.estimands],
      geography_level: release.geographyLevel,
      national_geography: { id: "ARG", name: "Argentina" },
      parents: parentStrings(release.manifest.parents),
      comparability: {
        frame_vintage: release.frameVintage,
        uncertainty: release.manifest.uncertainty_status,
        status: "research estimate; not official INDEC statistics",
      },
    },
    geographies: release.geographies,
    facts: release.facts,
    sourceReleases: [release],
  }
}

function generatedModule(release) {
  return `import { validateAtlasRelease, factKey, type AtlasRelease, type Concept, type Estimand, type GeographyLevel, type PeriodId, type PovertyFact, type Universe } from "@/data/release"

export const activeRelease: AtlasRelease = validateAtlasRelease(${JSON.stringify({
    metadata: release.metadata,
    geographies: release.geographies,
    facts: release.facts,
  })})
export const fixtureRelease = activeRelease
export const periods = activeRelease.metadata.periods
export const geographies = activeRelease.geographies
// Compatibility alias until D6 removes province-only component names.
export const provinces = activeRelease.geographies
export const universes = activeRelease.metadata.universes
export const concepts = activeRelease.metadata.concepts
export const estimands = activeRelease.metadata.estimands
export const geographyLevel: GeographyLevel = activeRelease.metadata.geography_level
export type { Concept, Estimand, GeographyLevel, PeriodId, PovertyFact, Universe }
const index = new Map(activeRelease.facts.map((fact) => [factKey(fact), fact]))
export function getFact(geographyId: string, period: PeriodId, universe: Universe, concept: Concept, estimand: Estimand) {
  const level = geographyId === "ARG" ? "national" : activeRelease.metadata.geography_level
  return index.get([period, universe, concept, estimand, level, geographyId].join("|")) ?? null
}
export function getEstimate(...args: Parameters<typeof getFact>) { return getFact(...args)?.estimate ?? null }
export function fixtureEstimate(...args: Parameters<typeof getFact>) { const value = getEstimate(...args); if (value === null) throw new Error("Missing released fact"); return value }
export function getGeography(id: string | null) { return geographies.find((item) => item.id === id) ?? null }
export const getProvince = getGeography
export function getPeriodLabel(id: PeriodId) { return periods.find((period) => period.id === id)?.label ?? id }
export const labels = { universes: { persons: "Personas", households: "Hogares" }, concepts: { poverty: "Pobreza", indigence: "Indigencia" }, estimands: { fgt0: "Incidencia", fgt1: "Brecha", fgt2: "Severidad" } } as const
`
}

async function writePublicProjection(release) {
  const publicDir = path.join(root, "public/data/releases", release.metadata.release_id)
  await mkdir(publicDir, { recursive: true })
  const metadataJson = json(release.metadata)
  const factsJson = json(release.facts)
  const sourceReleases = release.sourceReleases.map((item) => ({
    period: item.period,
    release_id: item.manifest.release_id,
    scientific_status: item.manifest.scientific_status,
  }))
  const manifest = {
    schema_version:
      release.sourceReleases.length > 1
        ? "atlas-poverty-release-set-manifest/v1"
        : "atlas-public-release-manifest/v1",
    release_id: release.metadata.release_id,
    source_releases: sourceReleases,
    files: {
      "metadata.json": sha256(Buffer.from(metadataJson)),
      "facts.json": sha256(Buffer.from(factsJson)),
    },
  }
  await writeFile(path.join(publicDir, "metadata.json"), metadataJson)
  await writeFile(path.join(publicDir, "facts.json"), factsJson)
  await writeFile(path.join(publicDir, "manifest.json"), json(manifest))

  await mkdir(path.join(root, "public/data"), { recursive: true })
  await writeFile(
    path.join(root, "public/data/catalog.json"),
    json({
      schema_version: "atlas-public-catalog/v1",
      default_release_id: release.metadata.release_id,
      releases: [
        {
          release_id: release.metadata.release_id,
          scientific_status: release.metadata.scientific_status,
          not_for_interpretation: true,
          metadata: `/data/releases/${release.metadata.release_id}/metadata.json`,
          facts: `/data/releases/${release.metadata.release_id}/facts.json`,
          manifest: `/data/releases/${release.metadata.release_id}/manifest.json`,
        },
      ],
    }),
  )
  await writeFile(path.join(root, "src/data/activeRelease.ts"), generatedModule(release))
}

function explicitDirectories() {
  const many = process.env.POVERTY_RELEASE_DIRS?.trim()
  if (many) {
    const directories = many
      .split(path.delimiter)
      .map((item) => item.trim())
      .filter(Boolean)
    if (directories.length === 0) fail("POVERTY_RELEASE_DIRS resolved to no directories")
    return directories
  }
  const one = process.env.POVERTY_RELEASE_DIR?.trim()
  return one ? [one] : []
}

async function main() {
  let directories = explicitDirectories()
  const vendoredSource = path.join(root, "data/releases/active")

  if (directories.length === 0) {
    try {
      await readFile(path.join(vendoredSource, "release_manifest.json"))
      directories = [vendoredSource]
    } catch {
      directories = []
    }
  }

  const requireRealRelease =
    process.env.POVERTY_RELEASE_REQUIRED === "1" ||
    process.env.VERCEL_ENV === "production"

  if (directories.length === 0) {
    if (requireRealRelease) {
      fail(
        "production build requires verified poverty-estimate-release/v2 input; " +
          "set POVERTY_RELEASE_DIR / POVERTY_RELEASE_DIRS or vendor one under data/releases/active",
      )
    }
    await writeFile(
      path.join(root, "src/data/activeRelease.ts"),
      'export * from "@/data/fixture"\n',
    )
    const { projectFixtureRelease } = await import("./project-fixture-release.mjs")
    await projectFixtureRelease()
    return
  }

  let release
  if (directories.length === 1) {
    release = singleReleaseProjection(
      await verifyDetachedRelease(path.resolve(directories[0])),
    )
  } else {
    release = await verifyAndProjectReleaseSet(
      directories.map((directory) => path.resolve(directory)),
      { expectedPeriods: CANONICAL_EIGHT_PERIODS },
    )
    if (release.metadata.geography_level !== "department_2010") {
      fail("canonical multi-release ingest currently requires department_2010")
    }
  }

  await writePublicProjection(release)
  console.log(
    `Ingested ${release.metadata.release_id}: ${release.metadata.periods.length} periods, ${release.geographies.length} geographies, ${release.facts.length} facts`,
  )
}

await main()
