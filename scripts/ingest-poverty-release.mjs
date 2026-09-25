import { createHash } from "node:crypto"
import { readFile, mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
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

async function writePublicRelease(release) {
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
  return {
    release_id: release.metadata.release_id,
    scientific_status: release.metadata.scientific_status,
    geography_level: release.metadata.geography_level,
    not_for_interpretation: true,
    metadata: `/data/releases/${release.metadata.release_id}/metadata.json`,
    facts: `/data/releases/${release.metadata.release_id}/facts.json`,
    manifest: `/data/releases/${release.metadata.release_id}/manifest.json`,
  }
}

async function writePublicCollection(releases, defaultRelease) {
  const entries = []
  for (const release of releases) entries.push(await writePublicRelease(release))
  await mkdir(path.join(root, "public/data"), { recursive: true })
  await writeFile(
    path.join(root, "public/data/catalog.json"),
    json({
      schema_version: "atlas-public-catalog/v1",
      default_release_id: defaultRelease.metadata.release_id,
      releases: entries,
    }),
  )
}

async function writeGeneratedCollection(releases, defaultRelease) {
  if (releases.length === 1) {
    await writeFile(
      path.join(root, "src/data/activeRelease.ts"),
      generatedModule(defaultRelease),
    )
    await writeFile(
      path.join(root, "src/data/activeReleases.ts"),
      'import { activeRelease } from "@/data/activeRelease"\n\nexport const activeReleases = [activeRelease] as const\n',
    )
    return
  }

  const byLevel = new Map(
    releases.map((release) => [release.metadata.geography_level, release]),
  )
  const province = byLevel.get("province_2010")
  const department = byLevel.get("department_2010")
  if (!province || !department || releases.length !== 2) {
    fail("commissioned release collection must contain exactly province_2010 and department_2010")
  }
  await writeFile(
    path.join(root, "src/data/activeRelease.province.ts"),
    generatedModule(province),
  )
  await writeFile(
    path.join(root, "src/data/activeRelease.department.ts"),
    generatedModule(department),
  )
  await writeFile(
    path.join(root, "src/data/activeRelease.ts"),
    'export * from "@/data/activeRelease.province"\n',
  )
  await writeFile(
    path.join(root, "src/data/activeReleases.ts"),
    [
      'import { activeRelease as provinceRelease } from "@/data/activeRelease.province"',
      'import { activeRelease as departmentRelease } from "@/data/activeRelease.department"',
      "",
      "export const activeReleases = [provinceRelease, departmentRelease] as const",
      "",
    ].join("\n"),
  )
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

async function loadGeographyLabels(directory) {
  const manifestPath = path.join(directory, "manifest.json")
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"))
  if (manifest?.dataset?.dataset_id !== "arggeo.indec.census.2010.department-footprint") {
    fail("DEPARTMENT_GEOGRAPHY_RELEASE_DIR is not the governed Census-2010 department release")
  }
  if (manifest?.department_identity?.feature_count !== 525) {
    fail("department geography release must contain exactly 525 identities")
  }
  const displayName = manifest?.artifacts?.display_geojson
  const expectedDisplayHash = manifest?.display_derivative?.content_sha256
  if (typeof displayName !== "string" || typeof expectedDisplayHash !== "string") {
    fail("department geography release lacks governed display derivative identity")
  }
  const displayBytes = await readFile(path.join(directory, displayName))
  if (sha256(displayBytes) !== expectedDisplayHash) {
    fail("department geography display derivative checksum mismatch")
  }
  const display = JSON.parse(displayBytes.toString("utf8"))
  if (display?.type !== "FeatureCollection" || !Array.isArray(display.features)) {
    fail("department geography display derivative is not a FeatureCollection")
  }
  if (display.features.length !== 525) {
    fail(`department geography display derivative has ${display.features.length} features`)
  }

  const departments = new Map()
  const provinces = new Map()
  for (const feature of display.features) {
    const properties = feature?.properties ?? {}
    const id = String(properties.geography_id ?? "")
    const departmentName = String(properties.department_name ?? "").trim()
    const provinceId = String(properties.province_2010_id ?? "")
    const provinceName = String(properties.province_name ?? "").trim()
    if (!/^\d{5}$/.test(id) || !/^\d{2}$/.test(provinceId)) {
      fail(`invalid geography label identity ${id}/${provinceId}`)
    }
    if (id.slice(0, 2) !== provinceId || !departmentName || !provinceName) {
      fail(`incomplete geography label metadata for ${id}`)
    }
    if (departments.has(id)) fail(`duplicate department display label ${id}`)
    departments.set(id, {
      id,
      name: departmentName,
      shortName: departmentName,
      provinceId,
      provinceName,
    })
    const existingProvince = provinces.get(provinceId)
    if (existingProvince && existingProvince.name !== provinceName) {
      fail(`province display label disagreement for ${provinceId}`)
    }
    provinces.set(provinceId, {
      id: provinceId,
      name: provinceName,
      shortName: provinceName,
    })
  }
  if (departments.size !== 525 || provinces.size !== 24) {
    fail("department geography labels must cover exactly 525 departments / 24 provinces")
  }
  return { departments, provinces }
}

function enrichGeographies(release, labelMap) {
  const observed = new Set(release.geographies.map((geography) => geography.id))
  const expected = new Set(labelMap.keys())
  if (
    observed.size !== expected.size ||
    [...observed].some((id) => !expected.has(id))
  ) {
    fail(`${release.metadata.geography_level} release IDs differ from governed display labels`)
  }
  return {
    ...release,
    geographies: release.geographies.map((geography) => {
      const label = labelMap.get(geography.id)
      if (!label) fail(`missing governed label for ${geography.id}`)
      return { ...geography, ...label }
    }),
  }
}

function assertNationalCompatibility(province, department) {
  const key = (fact) =>
    [fact.period, fact.universe, fact.concept, fact.estimand].join("|")
  const provinceNational = new Map(
    province.facts
      .filter((fact) => fact.geography_level === "national")
      .map((fact) => [key(fact), fact.estimate]),
  )
  const departmentNational = new Map(
    department.facts
      .filter((fact) => fact.geography_level === "national")
      .map((fact) => [key(fact), fact.estimate]),
  )
  if (provinceNational.size !== 96 || departmentNational.size !== 96) {
    fail("commissioned level sets must each expose exactly 96 national facts")
  }
  for (const [cell, value] of provinceNational) {
    const other = departmentNational.get(cell)
    if (other === undefined || Math.abs(value - other) > 1e-12) {
      fail(`province/department national reconciliation drift at ${cell}`)
    }
  }
}

async function commissionedBatchProjections(batchRoot) {
  const geographyRoot = process.env.DEPARTMENT_GEOGRAPHY_RELEASE_DIR?.trim()
  if (!geographyRoot) {
    fail("POVERTY_BATCH_ROOT requires DEPARTMENT_GEOGRAPHY_RELEASE_DIR for governed display labels")
  }
  const labels = await loadGeographyLabels(path.resolve(geographyRoot))
  const departmentDirectories = CANONICAL_EIGHT_PERIODS.map((period) =>
    path.join(batchRoot, "releases", period),
  )
  const provinceDirectories = CANONICAL_EIGHT_PERIODS.map((period) =>
    path.join(batchRoot, "province-oracles", period),
  )
  const [departmentRaw, provinceRaw] = await Promise.all([
    verifyAndProjectReleaseSet(departmentDirectories, {
      expectedPeriods: CANONICAL_EIGHT_PERIODS,
      releaseId: "atlas-poverty-release-set-department-2024q1-2025q4-v1",
    }),
    verifyAndProjectReleaseSet(provinceDirectories, {
      expectedPeriods: CANONICAL_EIGHT_PERIODS,
      releaseId: "atlas-poverty-release-set-province-2024q1-2025q4-v1",
    }),
  ])
  if (departmentRaw.metadata.geography_level !== "department_2010") {
    fail("batch releases/ must contain department_2010 releases")
  }
  if (provinceRaw.metadata.geography_level !== "province_2010") {
    fail("batch province-oracles/ must contain province_2010 releases")
  }
  const department = enrichGeographies(departmentRaw, labels.departments)
  const province = enrichGeographies(provinceRaw, labels.provinces)
  assertNationalCompatibility(province, department)
  return [province, department]
}

async function main() {
  const batchRoot = process.env.POVERTY_BATCH_ROOT?.trim()
  if (batchRoot) {
    const releases = await commissionedBatchProjections(path.resolve(batchRoot))
    const defaultRelease = releases.find(
      (release) => release.metadata.geography_level === "province_2010",
    )
    if (!defaultRelease) fail("commissioned batch lacks province default release")
    await writePublicCollection(releases, defaultRelease)
    await writeGeneratedCollection(releases, defaultRelease)
    console.log(
      `Ingested commissioned 8Q collection: ${releases.map((release) => `${release.metadata.geography_level}=${release.facts.length}`).join(", ")}`,
    )
    return
  }

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
          "set POVERTY_RELEASE_DIR / POVERTY_RELEASE_DIRS, POVERTY_BATCH_ROOT, " +
          "or vendor one under data/releases/active",
      )
    }
    await writeFile(
      path.join(root, "src/data/activeRelease.ts"),
      'export * from "@/data/fixture"\n',
    )
    await writeFile(
      path.join(root, "src/data/activeReleases.ts"),
      'import { activeRelease } from "@/data/activeRelease"\n\nexport const activeReleases = [activeRelease] as const\n',
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
      fail("legacy multi-release ingest currently requires department_2010")
    }
  }

  await writePublicCollection([release], release)
  await writeGeneratedCollection([release], release)
  console.log(
    `Ingested ${release.metadata.release_id}: ${release.metadata.periods.length} periods, ${release.geographies.length} geographies, ${release.facts.length} facts`,
  )
}

await main()
