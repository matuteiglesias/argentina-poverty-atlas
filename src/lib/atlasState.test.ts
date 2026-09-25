import { describe, expect, it } from "vitest"
import { fixtureRelease } from "@/data/fixtureRelease"
import { descriptorFromEmbeddedRelease } from "@/data/releaseCatalog"
import { makeReleaseRegistry } from "@/data/releaseRegistry"
import type { AtlasRelease } from "@/data/release"
import {
  applyAtlasPatchWithRegistry,
  buildAtlasHref,
  defaultAtlasState,
  normalizeAtlasStateWithRegistry,
  normalizeRoute,
  parseAtlasState,
} from "@/lib/atlasState"

function dualRegistry() {
  const province = structuredClone(fixtureRelease)
  const department = structuredClone(fixtureRelease) as AtlasRelease
  department.metadata.release_id = "department-test-release"
  department.metadata.geography_level = "department_2010"
  department.metadata.periods = [
    { id: "2024-Q1", label: "2024-Q1" },
    { id: "2024-Q2", label: "2024-Q2" },
    { id: "2024-Q3", label: "2024-Q3" },
    { id: "2024-Q4", label: "2024-Q4" },
    { id: "2025-Q1", label: "2025-Q1" },
    { id: "2025-Q2", label: "2025-Q2" },
    { id: "2025-Q3", label: "2025-Q3" },
    { id: "2025-Q4", label: "2025-Q4" },
  ]
  department.geographies = [
    {
      id: "06028",
      name: "Almirante Brown",
      shortName: "Almirante Brown",
      provinceId: "06",
      provinceName: "Buenos Aires",
    },
  ]
  department.facts = []
  return makeReleaseRegistry([descriptorFromEmbeddedRelease(province), descriptorFromEmbeddedRelease(department)])
}

describe("atlas URL state", () => {
  it("parses a complete supported state without coercing geography IDs", () => {
    const state = parseAtlasState(
      `?level=${defaultAtlasState.level}&period=${defaultAtlasState.period}&universe=households&concept=indigence&estimand=fgt2&place=06`,
    )

    expect(state).toEqual({
      level: defaultAtlasState.level,
      period: defaultAtlasState.period,
      universe: "households",
      concept: "indigence",
      estimand: "fgt2",
      place: "06",
    })
  })

  it("fails closed to defaults for unsupported values", () => {
    const state = parseAtlasState(
      "?level=radio&period=real-2026-Q1&universe=people&concept=income&estimand=mean&place=6",
    )

    expect(state).toEqual(defaultAtlasState)
  })

  it("keeps the supported public routes bounded", () => {
    expect(normalizeRoute("/explorar")).toBe("/explorar")
    expect(normalizeRoute("/admin")).toBe("/")
  })

  it("serializes a shareable explorer URL with geography level", () => {
    const href = buildAtlasHref("/explorar", {
      ...defaultAtlasState,
      place: "94",
    })
    expect(href).toContain(`level=${defaultAtlasState.level}`)
    expect(href).toContain("place=94")
  })

  it("clears stale place and repairs period when switching geography level", () => {
    const registry = dualRegistry()
    const provinceState = normalizeAtlasStateWithRegistry(
      {
        level: "province_2010",
        period: fixtureRelease.metadata.periods[0].id,
        universe: "persons",
        concept: "poverty",
        estimand: "fgt0",
        place: "06",
      },
      registry,
    )
    const departmentState = applyAtlasPatchWithRegistry(
      provinceState,
      { level: "department_2010" },
      registry,
    )
    expect(departmentState.level).toBe("department_2010")
    expect(departmentState.place).toBeNull()
    expect(departmentState.period).toBe("2025-Q4")
  })

  it("preserves exact five-digit department identity only in department mode", () => {
    const registry = dualRegistry()
    const departmentState = normalizeAtlasStateWithRegistry(
      {
        level: "department_2010",
        period: "2025-Q2",
        universe: "persons",
        concept: "poverty",
        estimand: "fgt0",
        place: "06028",
      },
      registry,
    )
    expect(departmentState.place).toBe("06028")
    const provinceState = applyAtlasPatchWithRegistry(
      departmentState,
      { level: "province_2010" },
      registry,
    )
    expect(provinceState.place).toBeNull()
  })
})
