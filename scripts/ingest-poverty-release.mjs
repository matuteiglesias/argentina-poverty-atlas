import { createHash } from "node:crypto"
import { readFile, mkdir, rm, writeFile } from "node:fs/promises"
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

function legendDomainKey(concept, estimand) {
  return `${concept}|${estimand}`
}

function roundLegendDomain(max) {
  const step = max <= 0.1 ? 0.02 : max <= 0.3 ? 0.05 : 0.1
  return Math.max(step, Math.ceil(max / step) * step)
}

function legendDomains(release) {
  const result = {}
  for (const concept of release.metadata.concepts) {
    for (const estimand of release.metadata.estimands) {
      const values = release.facts
        .filter(
          (fact) =>
            fact.geography_level === release.metadata.geography_level &&
            fact.concept === concept &&
            fact.estimand === estimand,
        )
        .map((fact) => fact.estimate)
      if (values.length === 0) fail(`cannot derive legend domain for ${concept}/${estimand}`)
      result[legendDomainKey(concept, estimand)] = roundLegendDomain(Math.max(...values))
    }
  }
  return result
}

async function writePublicRelease(release) {
  const publicDir = path.join(root, "public/data/releases", release.metadata.release_id)
  const factsDir = path.join(publicDir, "facts")
  await mkdir(factsDir, { recursive: true })

  const metadataJson = json(release.metadata)
  const geographiesJson = json(release.geographies)
  const nationalFacts = release.facts.filter(
    (fact) => fact.geography_level === "national" && fact.geography_id === "ARG",
  )
  const expectedNational =
    release.metadata.periods.length *
    release.metadata.universes.length *
    release.metadata.concepts.length *
    release.metadata.estimands.length
  if (nationalFacts.length !== expectedNational) {
    fail(
      `${release.metadata.release_id} must expose exactly ${expectedNational} explicit national facts`,
    )
  }
  const nationalJson = json(nationalFacts)

  const files = {
    "metadata.json": sha256(Buffer.from(metadataJson)),
    "geographies.json": sha256(Buffer.from(geographiesJson)),
    "national.json": sha256(Buffer.from(nationalJson)),
  }
  const factsByPeriod = {}

  for (const period of release.metadata.periods) {
    const facts = release.facts.filter(
      (fact) =>
        fact.period === period.id &&
        fact.geography_level === release.metadata.geography_level,
    )
    const expected =
      release.geographies.length *
      release.metadata.universes.length *
      release.metadata.concepts.length *
      release.metadata.estimands.length
    if (facts.length !== expected) {
      fail(
        `${release.metadata.release_id}/${period.id} must expose exactly ${expected} territorial facts, found ${facts.length}`,
      )
    }
    const factsJson = json(facts)
    const relative = `facts/${period.id}.json`
    files[relative] = sha256(Buffer.from(factsJson))
    await writeFile(path.join(publicDir, relative), factsJson)
    factsByPeriod[period.id] =
      `/data/releases/${release.metadata.release_id}/${relative}`
  }

  const sourceReleases = release.sourceReleases.map((item) => ({
    period: item.period,
    release_id: item.manifest.release_id,
    scientific_status: item.manifest.scientific_status,
  }))
  const manifest = {
    schema_version: "atlas-public-partitioned-release-manifest/v1",
    release_id: release.metadata.release_id,
    source_releases: sourceReleases,
    geography_level: release.metadata.geography_level,
    geography_count: release.geographies.length,
    period_count: release.metadata.periods.length,
    files,
  }

  await writeFile(path.join(publicDir, "metadata.json"), metadataJson)
  await writeFile(path.join(publicDir, "geographies.json"), geographiesJson)
  await writeFile(path.join(publicDir, "national.json"), nationalJson)
  await writeFile(path.join(publicDir, "manifest.json"), json(manifest))

  return {
    release_id: release.metadata.release_id,
    scientific_status: release.metadata.scientific_status,
    geography_level: release.metadata.geography_level,
    not_for_interpretation: true,
    metadata: `/data/releases/${release.metadata.release_id}/metadata.json`,
    geographies: `/data/releases/${release.metadata.release_id}/geographies.json`,
    national: `/data/releases/${release.metadata.release_id}/national.json`,
    facts_by_period: factsByPeriod,
    legend_max: legendDomains(release),
    manifest: `/data/releases/${release.metadata.release_id}/manifest.json`,
  }
}

async function writePublicCollection(releases, defaultRelease) {
  const releasesRoot = path.join(root, "public/data/releases")
  await rm(releasesRoot, { recursive: true, force: true })
  await mkdir(releasesRoot, { recursive: true })
  const entries = []
  for (const release of releases) entries.push(await writePublicRelease(release))
  await mkdir(path.join(root, "public/data"), { recursive: true })
  await writeFile(
    path.join(root, "public/data/catalog.json"),
    json({
      schema_version: "atlas-public-catalog/v2",
      default_release_id: defaultRelease.metadata.release_id,
      releases: entries,
    }),
  )
  return entries
}

function descriptorProjection(release, entry) {
  return {
    metadata: release.metadata,
    geographies: release.geographies,
    metadataUrl: entry.metadata,
    geographiesUrl: entry.geographies,
    nationalUrl: entry.national,
    manifestUrl: entry.manifest,
    factsByPeriod: entry.facts_by_period,
    legendMax: entry.legend_max,
  }
}

async function writeGeneratedCollection(releases, entries) {
  if (releases.length !== entries.length) {
    fail("generated descriptor count differs from public catalog count")
  }
  const descriptors = releases.map((release, index) =>
    descriptorProjection(release, entries[index]),
  )
  const module = `import { validateReleaseDescriptors } from "@/data/releaseCatalog"

export const activeReleases = validateReleaseDescriptors(${JSON.stringify(descriptors, null, 2)})
`
  await writeFile(path.join(root, "src/data/activeReleases.ts"), module)
  await writeFile(
    path.join(root, "src/data/activeRelease.ts"),
    'export { labels } from "@/data/releaseCatalog"\n',
  )
  await rm(path.join(root, "src/data/activeRelease.province.ts"), { force: true })
  await rm(path.join(root, "src/data/activeRelease.department.ts"), { force: true })
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
    const entries = await writePublicCollection(releases, defaultRelease)
    await writeGeneratedCollection(releases, entries)
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
      'import { activeRelease } from "@/data/activeRelease"\nimport { descriptorFromEmbeddedRelease } from "@/data/releaseCatalog"\n\nexport const activeReleases = [descriptorFromEmbeddedRelease(activeRelease)] as const\n',
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

  const entries = await writePublicCollection([release], release)
  await writeGeneratedCollection([release], entries)
  console.log(
    `Ingested ${release.metadata.release_id}: ${release.metadata.periods.length} periods, ${release.geographies.length} geographies, ${release.facts.length} facts`,
  )
}

await main()
