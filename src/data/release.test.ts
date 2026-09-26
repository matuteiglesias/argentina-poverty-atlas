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


  it("accepts EPH agglomerate facts with EPH_TOTAL instead of national ARG", () => {
    const ids = [
      "02","03","04","05","06","07","08","09","10","12","13","14","15","17",
      "18","19","20","22","23","25","26","27","29","30","31","32","33","34",
      "36","38","91","93",
    ]
    const release: AtlasRelease = {
      metadata: {
        schema_version: "atlas-poverty-release-set/v1",
        release_id: "aglo-test",
        scientific_status: "research_estimate",
        not_for_interpretation: true,
        periods: [{ id: "2024-Q3", label: "2024-Q3" }],
        universes: ["persons", "households"],
        concepts: ["poverty", "indigence"],
        estimands: ["fgt0", "fgt1", "fgt2"],
        geography_level: "eph_agglomerate",
        aggregate_geography: {
          level: "eph_coverage",
          id: "EPH_TOTAL",
          name: "Total aglomerados EPH",
        },
        parents: {},
        comparability: {},
      },
      geographies: ids.map((id) => ({ id, name: id, shortName: id })),
      facts: [
        {
          period: "2024-Q3",
          universe: "persons",
          concept: "poverty",
          estimand: "fgt0",
          geography_level: "eph_agglomerate",
          geography_id: "32",
          estimate: 0.31,
          uncertainty_status: "not_supplied",
          quality_status: "research_estimate",
        },
        {
          period: "2024-Q3",
          universe: "persons",
          concept: "poverty",
          estimand: "fgt0",
          geography_level: "eph_coverage",
          geography_id: "EPH_TOTAL",
          estimate: 0.38,
          uncertainty_status: "not_supplied",
          quality_status: "research_estimate",
        },
      ],
    }
    expect(() => validateAtlasRelease(release)).not.toThrow()
    expect(
      release.facts.some(
        (fact) => fact.geography_level === "national" || fact.geography_id === "ARG",
      ),
    ).toBe(false)
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
