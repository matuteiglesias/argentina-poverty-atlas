import { describe, expect, it } from "vitest"
import type { AtlasReleaseMetadata } from "@/data/release"
import { derivePresentationPermissions } from "@/data/releasePermissions"

function metadata(): AtlasReleaseMetadata {
  return {
    schema_version: "atlas-poverty-release-set/v1",
    release_id: "test",
    scientific_status: "research_estimate",
    not_for_interpretation: true,
    periods: [{ id: "2024-Q3", label: "2024-Q3" }],
    universes: ["persons", "households"],
    concepts: ["poverty", "indigence"],
    estimands: ["fgt0", "fgt1", "fgt2"],
    geography_level: "province_2010",
    national_geography: { id: "ARG", name: "Argentina" },
    parents: {},
    comparability: {},
  }
}

describe("release presentation permissions", () => {
  it("fails closed when legacy metadata has no upstream permissions", () => {
    const result = derivePresentationPermissions(metadata())
    expect(result.mode).toBe("commissioning")
    expect(result.source).toBe("legacy_fail_closed")
    expect(result.ordinaryHeadline).toBe(false)
    expect(result.populationCounts).toBe(false)
    expect(result.uncertaintyIntervals).toBe(false)
    expect(result.inferentialRanking).toBe(false)
    expect(result.temporalComparison).toBe("not_authorized")
  })

  it("keeps not_for_interpretation research releases in commissioning mode", () => {
    const value = metadata()
    value.estimand_contract = {
      measure: "proportion",
      universes: ["households", "persons"],
      analysis_weight_semantics: "unit_analysis_weight",
      design_ids: ["unit_weight_target_year_sample_research_v1"],
      population_mass_authority: null,
      household_total_authority: false,
    }
    value.permissions = {
      interpretation: "commissioning_only",
      operations: {
        point_estimates: "authorized",
        population_counts: "not_authorized",
        uncertainty_intervals: "not_authorized",
        inferential_ranking: "not_authorized",
        temporal_comparison: "descriptive_only",
      },
    }
    const result = derivePresentationPermissions(value)
    expect(result.mode).toBe("commissioning")
    expect(result.ordinaryHeadline).toBe(false)
    expect(result.pointInspection).toBe(true)
    expect(result.temporalComparison).toBe("descriptive_only")
  })

  it("allows an ordinary headline only when upstream explicitly says research_public", () => {
    const value = metadata()
    value.not_for_interpretation = false
    value.estimand_contract = {
      measure: "proportion",
      universes: ["households", "persons"],
      analysis_weight_semantics: "unit_analysis_weight",
      design_ids: ["unit_weight_target_year_sample_research_v1"],
      population_mass_authority: null,
      household_total_authority: false,
    }
    value.permissions = {
      interpretation: "research_public",
      operations: {
        point_estimates: "authorized",
        population_counts: "not_authorized",
        uncertainty_intervals: "not_authorized",
        inferential_ranking: "not_authorized",
        temporal_comparison: "descriptive_only",
      },
    }
    const result = derivePresentationPermissions(value)
    expect(result.mode).toBe("research_public")
    expect(result.ordinaryHeadline).toBe(true)
    expect(result.populationCounts).toBe(false)
    expect(result.uncertaintyIntervals).toBe(false)
  })
})
