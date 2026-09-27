import type {
  AtlasReleaseMetadata,
  TemporalComparisonPermission,
} from "@/data/release"

export type PresentationMode =
  | "demo"
  | "commissioning"
  | "research_public"

export interface PresentationPermissions {
  mode: PresentationMode
  source: "declared" | "legacy_fail_closed"
  ordinaryHeadline: boolean
  pointInspection: boolean
  populationCounts: boolean
  uncertaintyIntervals: boolean
  inferentialRanking: boolean
  temporalComparison: TemporalComparisonPermission | "not_authorized"
}

export function derivePresentationPermissions(
  metadata: AtlasReleaseMetadata,
): PresentationPermissions {
  const declared = metadata.permissions
  if (!declared) {
    return {
      mode: "commissioning",
      source: "legacy_fail_closed",
      ordinaryHeadline: false,
      pointInspection: true,
      populationCounts: false,
      uncertaintyIntervals: false,
      inferentialRanking: false,
      temporalComparison: "not_authorized",
    }
  }

  const mode: PresentationMode =
    declared.interpretation === "demo_only"
      ? "demo"
      : declared.interpretation === "research_public"
        ? "research_public"
        : "commissioning"

  return {
    mode,
    source: "declared",
    ordinaryHeadline:
      mode === "research_public" &&
      declared.operations.point_estimates === "authorized",
    pointInspection:
      declared.operations.point_estimates === "authorized" ||
      declared.operations.point_estimates === "demo_only",
    // The current capability schema intentionally has no positive state for
    // these operations. A future schema evolution must widen both the type and
    // this adapter before the UI can expose them.
    populationCounts: false,
    uncertaintyIntervals: false,
    inferentialRanking: false,
    temporalComparison: declared.operations.temporal_comparison,
  }
}
