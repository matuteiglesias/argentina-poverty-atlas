import { describe, expect, it } from "vitest"
import { fixtureRelease, getFact } from "@/data/fixtureRelease"
import {
  assertW2FixtureRelease,
  validateAtlasRelease,
  type AtlasRelease,
} from "@/data/release"

function cloneRelease(): AtlasRelease {
  return structuredClone(fixtureRelease)
}

describe("W2 deterministic fixture release", () => {
  it("materializes the complete 24-jurisdiction fixture with deterministic identity", () => {
    expect(assertW2FixtureRelease(fixtureRelease)).toBe(fixtureRelease)
    expect(fixtureRelease.metadata.release_id).toBe(
      "fixture-ar-24j-6p-v1-db7698bb2dff",
    )
    expect(fixtureRelease.geographies).toHaveLength(24)
    expect(fixtureRelease.metadata.periods).toHaveLength(6)
    expect(fixtureRelease.facts).toHaveLength(1800)
    expect(
      getFact("06", "demo-2026-S1", "persons", "poverty", "fgt0")?.estimate,
    ).toBe(0.344)
  })

  it("accepts an explicit missing-geography estimate variant without filling it", () => {
    const release = cloneRelease()
    const index = release.facts.findIndex(
      (fact) => fact.geography_id === "06" && fact.period === "demo-2026-S1",
    )
    release.facts.splice(index, 1)

    expect(() => validateAtlasRelease(release)).not.toThrow()
    expect(release.facts).toHaveLength(1799)
  })

  it("accepts a quality-warning variant and preserves warning codes", () => {
    const release = cloneRelease()
    const fact = release.facts.find((item) => item.geography_id === "22")!
    fact.quality_status = "warning"
    fact.warning_codes = ["fixture_quality_warning"]

    expect(() => validateAtlasRelease(release)).not.toThrow()
    expect(fact.warning_codes).toEqual(["fixture_quality_warning"])
  })

  it("rejects a duplicate fact key", () => {
    const release = cloneRelease()
    release.facts.push(structuredClone(release.facts[0]))

    expect(() => validateAtlasRelease(release)).toThrow(/duplicate fact key/)
  })

  it("rejects an incompatible geography ID", () => {
    const release = cloneRelease()
    const fact = release.facts.find((item) => item.geography_level === "province_2010")!
    fact.geography_id = "99"

    expect(() => validateAtlasRelease(release)).toThrow(/incompatible geography ID 99/)
  })

  it("accepts uncertainty absence only as explicit not_supplied metadata", () => {
    const release = cloneRelease()
    const fact = release.facts[0]

    expect(fact.uncertainty_status).toBe("not_supplied")
    expect(fact.standard_error).toBeUndefined()
    expect(fact.ci_lower).toBeUndefined()
    expect(fact.ci_upper).toBeUndefined()
    expect(() => validateAtlasRelease(release)).not.toThrow()
  })
})
