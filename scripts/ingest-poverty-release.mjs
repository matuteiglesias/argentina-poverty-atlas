import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const required = ["poverty_estimates.csv", "capabilities.json", "geography_join_contract.json", "release_manifest.json", "run_qa.json", "LIMITATIONS.md", "checksums.sha256"]

function fail(message) { throw new Error(`Poverty release ingest failed: ${message}`) }
function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex") }
function parseCsv(text) {
  const lines = text.trimEnd().split(/\r?\n/)
  const headers = lines.shift().split(",")
  return lines.map((line) => {
    const cells = line.split(",")
    return Object.fromEntries(headers.map((h, i) => [h, cells[i]]))
  })
}
function json(value) { return `${JSON.stringify(value, null, 2)}\n` }

async function verifyRelease(dir) {
  for (const name of required) {
    try { await readFile(path.join(dir, name)) } catch { fail(`missing required file ${name}`) }
  }
  const checks = (await readFile(path.join(dir, "checksums.sha256"), "utf8")).trim().split(/\r?\n/)
  for (const line of checks) {
    const [digest, name] = line.split(/  /)
    if (!required.includes(name)) fail(`checksum inventory contains unsupported file ${name}`)
    const actual = sha256(await readFile(path.join(dir, name)))
    if (actual !== digest) fail(`checksum mismatch for ${name}`)
  }
  const manifest = JSON.parse(await readFile(path.join(dir, "release_manifest.json"), "utf8"))
  if (manifest.schema_version !== "poverty-estimate-release/v2") fail("unsupported release schema")
  if (manifest.artifact_type !== "poverty-estimate-release/v2") fail("unsupported artifact type")
  if (manifest.scientific_status !== "research_estimate") fail("real ingest requires research_estimate")
  if (manifest.uncertainty_status !== "not_supplied") fail("unsupported uncertainty status")
  const capabilities = JSON.parse(await readFile(path.join(dir, "capabilities.json"), "utf8"))
  const geography = JSON.parse(await readFile(path.join(dir, "geography_join_contract.json"), "utf8"))
  if (capabilities.schema_version !== "poverty-estimate-capabilities/v1") fail("unsupported capabilities schema")
  if (geography.join_semantics !== "exact_governed_id" || geography.numeric_coercion_allowed) fail("unsupported geography join semantics")
  const rows = parseCsv(await readFile(path.join(dir, "poverty_estimates.csv"), "utf8"))
  const expectedHeaders = ["release_id", "estimation_period", "frame_vintage", "universe", "geography_level", "geography_id", "concept", "estimand", "estimate", "unit", "weighted_numerator", "weighted_denominator", "coverage", "design_id", "weight_semantics", "uncertainty_status"]
  const header = (await readFile(path.join(dir, "poverty_estimates.csv"), "utf8")).split(/\r?\n/, 1)[0].split(",")
  if (header.join("|") !== expectedHeaders.join("|")) fail("poverty_estimates.csv schema differs from the consumer contract")
  const key = (r) => [r.estimation_period, r.universe, r.concept, r.estimand, r.geography_level, r.geography_id].join("|")
  const keys = new Set()
  for (const row of rows) {
    if (keys.has(key(row))) fail(`duplicate fact key ${key(row)}`)
    keys.add(key(row))
    const value = Number(row.estimate)
    if (!Number.isFinite(value) || value < 0 || value > 1) fail(`invalid estimate ${key(row)}`)
    if (row.unit !== "proportion" || row.uncertainty_status !== "not_supplied") fail(`unsupported fact semantics ${key(row)}`)
    if (row.geography_level === "province_2010" && !/^\d{2}$/.test(row.geography_id)) fail(`invalid province ID ${row.geography_id}`)
    if (row.geography_level === "national" && row.geography_id !== "ARG") fail("invalid national ID")
  }
  if (rows.length !== 300) fail(`expected 300 facts, got ${rows.length}`)
  const provinceIds = new Set(rows.filter((r) => r.geography_level === "province_2010").map((r) => r.geography_id))
  const capabilityIds = new Set((capabilities.geographies ?? []).map((g) => g.id))
  const contractIds = new Set(geography.geography_ids ?? [])
  if (provinceIds.size !== 24) fail("expected 24 provinces")
  if ([...provinceIds].sort().join("|") !== [...capabilityIds].sort().join("|") || [...provinceIds].sort().join("|") !== [...contractIds].sort().join("|")) fail("province geography IDs do not exactly agree across facts, capabilities, and join contract")
  return { manifest, capabilities, geography, rows }
}

function generatedModule({ manifest, capabilities, rows }) {
  const geographies = capabilities.geographies.map((g) => ({ id: g.id, name: g.name, shortName: g.short_name ?? g.name }))
  const facts = rows.map((r) => ({ period: r.estimation_period, universe: r.universe, concept: r.concept, estimand: r.estimand, geography_level: r.geography_level, geography_id: r.geography_id, estimate: Number(r.estimate), uncertainty_status: "not_supplied", quality_status: "research_estimate", coverage: Number(r.coverage), warning_codes: ["research_estimate", "not_official_statistics"] }))
  const metadata = { schema_version: manifest.schema_version, release_id: manifest.release_id, scientific_status: manifest.scientific_status, not_for_interpretation: true, periods: capabilities.periods, universes: capabilities.universes, concepts: capabilities.concepts, estimands: capabilities.estimands, geography_level: "province_2010", national_geography: { id: "ARG", name: "Argentina" }, parents: manifest.parents, comparability: { frame_vintage: manifest.frame_vintage, uncertainty: manifest.uncertainty_status, status: "research estimate; not official INDEC statistics" } }
  return `import { validateAtlasRelease, factKey, type AtlasRelease, type Concept, type Estimand, type PeriodId, type PovertyFact, type Universe } from "@/data/release"\n\nexport const activeRelease: AtlasRelease = validateAtlasRelease(${JSON.stringify({ metadata, geographies, facts })})\nexport const fixtureRelease = activeRelease\nexport const periods = activeRelease.metadata.periods\nexport const provinces = activeRelease.geographies\nexport const universes = activeRelease.metadata.universes\nexport const concepts = activeRelease.metadata.concepts\nexport const estimands = activeRelease.metadata.estimands\nexport type { Concept, Estimand, PeriodId, PovertyFact, Universe }\nconst index = new Map(activeRelease.facts.map((fact) => [factKey(fact), fact]))\nexport function getFact(geographyId: string, period: PeriodId, universe: Universe, concept: Concept, estimand: Estimand) {\n  const level = geographyId === "ARG" ? "national" : "province_2010"\n  return index.get([period, universe, concept, estimand, level, geographyId].join("|")) ?? null\n}\nexport function getEstimate(...args: Parameters<typeof getFact>) { return getFact(...args)?.estimate ?? null }\nexport function fixtureEstimate(...args: Parameters<typeof getFact>) { const value = getEstimate(...args); if (value === null) throw new Error('Missing released fact'); return value }\nexport function getProvince(id: string | null) { return provinces.find((p) => p.id === id) ?? null }\nexport function getPeriodLabel(id: PeriodId) { return periods.find((p) => p.id === id)?.label ?? id }\nexport const labels = { universes: { persons: "Personas", households: "Hogares" }, concepts: { poverty: "Pobreza", indigence: "Indigencia" }, estimands: { fgt0: "Incidencia", fgt1: "Brecha", fgt2: "Severidad" } } as const\n`
}

async function main() {
  const source = process.env.POVERTY_RELEASE_DIR
  if (!source) {
    await writeFile(path.join(root, "src/data/activeRelease.ts"), 'export * from "@/data/fixture"\n')
    const { projectFixtureRelease } = await import("./project-fixture-release.mjs")
    await projectFixtureRelease()
    return
  }
  const release = await verifyRelease(path.resolve(source))
  const publicDir = path.join(root, "public/data/releases", release.manifest.release_id)
  await mkdir(publicDir, { recursive: true })
  const metadata = { schema_version: release.manifest.schema_version, release_id: release.manifest.release_id, scientific_status: release.manifest.scientific_status, not_for_interpretation: true, periods: release.capabilities.periods, universes: release.capabilities.universes, concepts: release.capabilities.concepts, estimands: release.capabilities.estimands, geography_level: "province_2010", national_geography: { id: "ARG", name: "Argentina" }, parents: release.manifest.parents, comparability: { frame_vintage: release.manifest.frame_vintage, uncertainty: release.manifest.uncertainty_status, status: "research estimate; not official INDEC statistics" } }
  const facts = release.rows.map((r) => ({ period: r.estimation_period, universe: r.universe, concept: r.concept, estimand: r.estimand, geography_level: r.geography_level, geography_id: r.geography_id, estimate: Number(r.estimate), uncertainty_status: "not_supplied", quality_status: "research_estimate", coverage: Number(r.coverage), warning_codes: ["research_estimate", "not_official_statistics"] }))
  await writeFile(path.join(publicDir, "metadata.json"), json(metadata)); await writeFile(path.join(publicDir, "facts.json"), json(facts))
  const files = { "metadata.json": sha256(Buffer.from(json(metadata))), "facts.json": sha256(Buffer.from(json(facts))) }
  await writeFile(path.join(publicDir, "manifest.json"), json({ release_id: release.manifest.release_id, source_release: release.manifest.release_id, files }))
  await writeFile(path.join(root, "public/data/catalog.json"), json({ schema_version: "atlas-public-catalog/v1", default_release_id: release.manifest.release_id, releases: [{ release_id: release.manifest.release_id, scientific_status: release.manifest.scientific_status, not_for_interpretation: true, metadata: `/data/releases/${release.manifest.release_id}/metadata.json`, facts: `/data/releases/${release.manifest.release_id}/facts.json`, manifest: `/data/releases/${release.manifest.release_id}/manifest.json` }] }))
  await writeFile(path.join(root, "src/data/activeRelease.ts"), generatedModule(release))
  console.log(`Ingested ${release.manifest.release_id}: ${facts.length} facts`)
}
await main()
