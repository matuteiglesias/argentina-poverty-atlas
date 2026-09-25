import { createHash } from "node:crypto"
import { mkdtemp, mkdir, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"

import {
  projectVerifiedReleaseSet,
  verifyAndProjectReleaseSet,
  verifyDetachedRelease,
} from "./poverty-release-set.mjs"

const periods = [
  "2024-Q1",
  "2024-Q2",
  "2024-Q3",
  "2024-Q4",
  "2025-Q1",
  "2025-Q2",
  "2025-Q3",
  "2025-Q4",
]

function sha256(value) {
  return createHash("sha256").update(value).digest("hex")
}

function ids(level) {
  if (level === "province_2010") {
    return [
      "02", "06", "10", "14", "18", "22", "26", "30", "34", "38", "42", "46",
      "50", "54", "58", "62", "66", "70", "74", "78", "82", "86", "90", "94",
    ]
  }
  return Array.from({ length: 525 }, (_, index) =>
    String(index + 1).padStart(5, "0"),
  )
}

function csvFor(level, period, geographyIds) {
  const header = [
    "release_id",
    "estimation_period",
    "frame_vintage",
    "universe",
    "geography_level",
    "geography_id",
    "concept",
    "estimand",
    "estimate",
    "unit",
    "weighted_numerator",
    "weighted_denominator",
    "coverage",
    "design_id",
    "weight_semantics",
    "uncertainty_status",
  ]
  const releaseId = `release-${period.toLowerCase()}-${level}`
  const rows = []
  for (const universe of ["households", "persons"]) {
    for (const concept of ["indigence", "poverty"]) {
      for (const estimand of ["fgt0", "fgt1", "fgt2"]) {
        for (const geographyId of geographyIds) {
          rows.push([
            releaseId,
            period,
            "2010",
            universe,
            level,
            geographyId,
            concept,
            estimand,
            "0.25",
            "proportion",
            "25",
            "100",
            "1",
            "unit_weight_target_year_sample_research_v1",
            "unit_analysis_weight",
            "not_supplied",
          ])
        }
        rows.push([
          releaseId,
          period,
          "2010",
          universe,
          "national",
          "ARG",
          concept,
          estimand,
          "0.25",
          "proportion",
          String(25 * geographyIds.length),
          String(100 * geographyIds.length),
          "1",
          "unit_weight_target_year_sample_research_v1",
          "unit_analysis_weight",
          "not_supplied",
        ])
      }
    }
  }
  return {
    releaseId,
    text: [header.join(","), ...rows.map((row) => row.join(","))].join("\n") + "\n",
  }
}

async function makeDetached(root, level, period, options = {}) {
  const directory = path.join(root, period)
  await mkdir(directory, { recursive: true })
  const geographyIds = ids(level)
  if (options.replaceLastId) geographyIds[geographyIds.length - 1] = options.replaceLastId
  const { releaseId, text: estimates } = csvFor(level, period, geographyIds)
  const manifest = {
    schema_version: "poverty-estimate-release/v2",
    artifact_type: "poverty-estimate-release/v2",
    release_id: releaseId,
    estimation_period: period,
    frame_vintage: "2010",
    scientific_status: "research_estimate",
    uncertainty_status: "not_supplied",
    geography_level: level,
    parents: {},
  }
  const capabilities = {
    schema_version: "poverty-estimate-capabilities/v1",
    release_id: releaseId,
    scientific_status: "research_estimate",
    universes: ["persons", "households"],
    concepts: ["poverty", "indigence"],
    estimands: ["fgt0", "fgt1", "fgt2"],
    geography_levels: [level, "national"],
    periods: [{ id: period, label: period }],
    geographies: options.omitConvenienceInventories
      ? undefined
      : geographyIds.map((id) => ({ id, name: id, short_name: id })),
  }
  const geography = {
    schema_version: "poverty-geography-join/v1",
    geometry_embedded: false,
    geometry_owner: "matuteiglesias/argentina-geography",
    join_key: ["geography_level", "geography_id"],
    join_semantics: "exact_governed_id",
    numeric_coercion_allowed: false,
    fuzzy_matching_allowed: false,
    geography_level: level,
    geography_ids: options.omitConvenienceInventories ? undefined : geographyIds,
  }
  const qa = { schema_version: "poverty-estimate-qa/v2" }
  const limitations = "# Limitations\n\n- synthetic test shell for consumer verification.\n"
  const files = {
    "poverty_estimates.csv": estimates,
    "capabilities.json": JSON.stringify(capabilities, null, 2) + "\n",
    "geography_join_contract.json": JSON.stringify(geography, null, 2) + "\n",
    "release_manifest.json": JSON.stringify(manifest, null, 2) + "\n",
    "run_qa.json": JSON.stringify(qa, null, 2) + "\n",
    "LIMITATIONS.md": limitations,
  }
  for (const [name, value] of Object.entries(files)) {
    await writeFile(path.join(directory, name), value)
  }
  const checksums = Object.entries(files)
    .map(([name, value]) => `${sha256(value)}  ${name}`)
    .join("\n")
  await writeFile(path.join(directory, "checksums.sha256"), checksums + "\n")
  return directory
}

describe("detached poverty release-set verification", () => {
  it("keeps the existing one-period province shape valid", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "atlas-province-"))
    const directory = await makeDetached(root, "province_2010", "2024-Q3")
    const release = await verifyDetachedRelease(directory)
    expect(release.geographyIds).toHaveLength(24)
    expect(release.rows).toHaveLength(300)
  })

  it("accepts canonical producer v2 without convenience geography arrays", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "atlas-canonical-"))
    const directory = await makeDetached(root, "department_2010", "2024-Q1", {
      omitConvenienceInventories: true,
    })
    const release = await verifyDetachedRelease(directory)
    expect(release.geographyIds).toHaveLength(525)
    expect(release.rows).toHaveLength(6312)
  })

  it("projects eight verified department releases without recomputation", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "atlas-department-"))
    const directories = []
    for (const period of periods) {
      directories.push(await makeDetached(root, "department_2010", period))
    }
    const releaseSet = await verifyAndProjectReleaseSet(directories, {
      expectedPeriods: periods,
    })
    expect(releaseSet.metadata.schema_version).toBe("atlas-poverty-release-set/v1")
    expect(releaseSet.metadata.geography_level).toBe("department_2010")
    expect(releaseSet.metadata.periods).toHaveLength(8)
    expect(releaseSet.geographies).toHaveLength(525)
    expect(
      releaseSet.facts.filter((fact) => fact.geography_level === "department_2010"),
    ).toHaveLength(50400)
    expect(
      releaseSet.facts.filter((fact) => fact.geography_level === "national"),
    ).toHaveLength(96)
    expect(releaseSet.facts).toHaveLength(50496)
  }, 30_000)

  it("rejects a partial canonical eight-quarter set", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "atlas-partial-"))
    const releases = []
    for (const period of periods.slice(0, 7)) {
      const directory = await makeDetached(root, "department_2010", period)
      releases.push(await verifyDetachedRelease(directory))
    }
    expect(() =>
      projectVerifiedReleaseSet(releases, { expectedPeriods: periods }),
    ).toThrow(/release-set periods differ/)
  })

  it("rejects numeric-width identity drift before projection", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "atlas-id-drift-"))
    const directory = await makeDetached(root, "department_2010", "2024-Q1", {
      replaceLastId: "9999",
    })
    await expect(verifyDetachedRelease(directory)).rejects.toThrow(
      /invalid department_2010 ID/,
    )
  })
})
