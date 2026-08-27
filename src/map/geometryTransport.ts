import manifestJson from "../../mapbox/manifests/province-w3.json"
import { provinces } from "@/data/fixture"

const EXPECTED_SCHEMA = "argentina-poverty-atlas.geometry-transport/v1"
const SHA256 = /^[a-f0-9]{64}$/

export interface PinnedParentRelease {
  repository: string
  commit_sha: string
  dataset_id: string
  geography_id: string | null
  release_version: string
  level: "province"
  source_snapshot_sha256: string
  artifact_sha256: string
  feature_count: 24
}

export interface PublishedParentRelease extends PinnedParentRelease {
  geography_id: string
}

export interface GeometryTransportManifest {
  schema: string
  transport_id: string
  status: "blocked_upstream" | "ready_for_publication" | "published"
  inspected_at: string
  atlas_base_commit: string
  fixture_geography_ids: string[]
  upstream_audit: {
    repository: string
    commit_sha: string
    required_level: string
    blocker_issue: string
    finding: string
    candidate_evidence: unknown[]
  }
  parent_release: PinnedParentRelease | null
  mapbox: {
    style_url: string
    tileset_id: string | null
    source_layer: string | null
    feature_id_property: string
    published_feature_count: number | null
    publication_time: string | null
    publication_job_id: string | null
  }
  payload_policy: {
    geometry_only: boolean
    poverty_values_embedded: boolean
    required_feature_property: string
  }
  external_gates: {
    dedicated_browser_token: string
    publication_credential: string
    w0_issue: string
  }
}

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Invalid W3 geometry transport manifest: ${message}`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function validatePinnedParent(value: unknown): asserts value is Record<string, unknown> {
  invariant(isRecord(value), "non-blocked transport requires an exact parent release")
  invariant(value.repository === "matuteiglesias/argentina-geography", "unexpected parent repository")
  invariant(value.dataset_id === "arggeo.ign.administrative.province", "unexpected parent dataset")
  invariant(
    value.geography_id === null ||
      (typeof value.geography_id === "string" && value.geography_id.length > 0),
    "parent geography_id must be null or a non-empty catalog identity",
  )
  invariant(typeof value.release_version === "string" && value.release_version.length > 0, "parent release_version is required")
  invariant(value.level === "province", "parent must be province-level")
  invariant(value.feature_count === 24, "parent must have exactly 24 features")
  invariant(
    typeof value.source_snapshot_sha256 === "string" && SHA256.test(value.source_snapshot_sha256),
    "parent source snapshot must be SHA-256 addressed",
  )
  invariant(
    typeof value.artifact_sha256 === "string" && SHA256.test(value.artifact_sha256),
    "parent artifact must be SHA-256 addressed",
  )
}

export function validateGeometryTransportManifest(
  value: unknown,
  expectedGeographyIds: readonly string[],
): GeometryTransportManifest {
  invariant(isRecord(value), "manifest must be an object")
  invariant(value.schema === EXPECTED_SCHEMA, `schema must be ${EXPECTED_SCHEMA}`)
  invariant(
    value.status === "blocked_upstream" ||
      value.status === "ready_for_publication" ||
      value.status === "published",
    "unknown status",
  )
  invariant(Array.isArray(value.fixture_geography_ids), "fixture_geography_ids must be an array")

  const fixtureIds = value.fixture_geography_ids
  invariant(fixtureIds.every((id) => typeof id === "string"), "fixture geography IDs must be strings")
  invariant(new Set(fixtureIds).size === fixtureIds.length, "fixture geography IDs must be unique")
  invariant(fixtureIds.length === 24, "fixture must contain exactly 24 geography IDs")
  invariant(
    [...fixtureIds].sort().join("|") === [...expectedGeographyIds].sort().join("|"),
    "manifest IDs must exactly match the atlas fixture IDs",
  )

  invariant(isRecord(value.mapbox), "mapbox section is required")
  invariant(value.mapbox.style_url === "mapbox://styles/mapbox/standard", "W3 must use Mapbox Standard")
  invariant(value.mapbox.feature_id_property === "geography_id", "feature identity must be geography_id")

  invariant(isRecord(value.payload_policy), "payload_policy is required")
  invariant(value.payload_policy.geometry_only === true, "transport must be geometry-only")
  invariant(value.payload_policy.poverty_values_embedded === false, "poverty values cannot be embedded")
  invariant(value.payload_policy.required_feature_property === "geography_id", "required feature property must be geography_id")

  invariant(isRecord(value.upstream_audit), "upstream_audit is required")
  invariant(value.upstream_audit.repository === "matuteiglesias/argentina-geography", "unexpected upstream repository")
  invariant(value.upstream_audit.required_level === "province", "upstream level must be province")

  if (value.status === "blocked_upstream") {
    invariant(value.parent_release === null, "blocked transport cannot claim a parent release")
    invariant(
      typeof value.upstream_audit.blocker_issue === "string" && value.upstream_audit.blocker_issue.length > 0,
      "blocked transport must name its upstream blocker",
    )
    return value as unknown as GeometryTransportManifest
  }

  validatePinnedParent(value.parent_release)

  if (value.status === "ready_for_publication") {
    invariant(value.mapbox.tileset_id === null, "ready transport cannot claim a tileset before provider proof")
    invariant(value.mapbox.source_layer === null, "ready transport cannot claim a source layer before provider proof")
    invariant(value.mapbox.published_feature_count === null, "ready transport cannot claim published features")
    invariant(value.mapbox.publication_time === null, "ready transport cannot claim publication time")
    invariant(value.mapbox.publication_job_id === null, "ready transport cannot claim publication job")
    return value as unknown as GeometryTransportManifest
  }

  invariant(
    typeof value.parent_release.geography_id === "string" && value.parent_release.geography_id.length > 0,
    "published transport requires the exact catalog geography_id",
  )
  invariant(typeof value.mapbox.tileset_id === "string" && value.mapbox.tileset_id.length > 0, "published transport requires tileset_id")
  invariant(typeof value.mapbox.source_layer === "string" && value.mapbox.source_layer.length > 0, "published transport requires source_layer")
  invariant(value.mapbox.published_feature_count === 24, "published Mapbox transport must report 24 features")
  invariant(typeof value.mapbox.publication_time === "string" && value.mapbox.publication_time.length > 0, "published transport requires publication_time")

  return value as unknown as GeometryTransportManifest
}

export const provinceGeometryIds = provinces.map((province) => province.id)
export const geometryTransportManifest = validateGeometryTransportManifest(
  manifestJson,
  provinceGeometryIds,
)

export function isPublishedGeometryTransport(
  manifest: GeometryTransportManifest,
): manifest is GeometryTransportManifest & {
  status: "published"
  parent_release: PublishedParentRelease
  mapbox: GeometryTransportManifest["mapbox"] & {
    tileset_id: string
    source_layer: string
    published_feature_count: 24
    publication_time: string
  }
} {
  return manifest.status === "published"
}
