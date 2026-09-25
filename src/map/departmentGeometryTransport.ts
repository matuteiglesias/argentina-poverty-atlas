import manifestJson from "../../mapbox/manifests/department-w3.json"

const EXPECTED_SCHEMA = "argentina-poverty-atlas.geometry-transport/v1"
const SHA256 = /^[a-f0-9]{64}$/
const SHA1 = /^[a-f0-9]{40}$/
const DEPARTMENT_ID = /^\d{5}$/

export interface DepartmentParentRelease {
  repository: "matuteiglesias/argentina-geography"
  commit_sha: string
  dataset_id: "arggeo.indec.census.2010.department-footprint"
  geography_id: string
  release_version: "derived-2010-national-c9184f47fd46"
  level: "department"
  canonical_geoparquet_sha256: string
  department_id_set_sha256: string
  display_geojson_sha256: string | null
  feature_count: 525
}

export interface DepartmentGeometryTransportManifest {
  schema: string
  transport_id: "department-w3"
  status: "ready_for_publication" | "published"
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
  parent_release: DepartmentParentRelease
  mapbox: {
    style_url: "mapbox://styles/mapbox/standard"
    tileset_id: string | null
    source_layer: string | null
    feature_id_property: "geography_id"
    published_feature_count: number | null
    publication_time: string | null
    publication_job_id: string | null
  }
  payload_policy: {
    geometry_only: true
    poverty_values_embedded: false
    atlas_side_dissolve: false
    required_feature_property: "geography_id"
  }
  external_gates: Record<string, string>
}

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Invalid department geometry transport: ${message}`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function validateDepartmentGeometryTransport(
  value: unknown,
): DepartmentGeometryTransportManifest {
  invariant(isRecord(value), "manifest must be an object")
  invariant(value.schema === EXPECTED_SCHEMA, `schema must be ${EXPECTED_SCHEMA}`)
  invariant(value.transport_id === "department-w3", "transport_id must be department-w3")
  invariant(
    value.status === "ready_for_publication" || value.status === "published",
    "unsupported status",
  )
  invariant(
    Array.isArray(value.fixture_geography_ids),
    "fixture_geography_ids must be an array",
  )
  const ids = value.fixture_geography_ids
  invariant(ids.length === 525, "exactly 525 department IDs are required")
  invariant(ids.every((id) => typeof id === "string" && DEPARTMENT_ID.test(id)), "department IDs must be five-digit strings")
  invariant(new Set(ids).size === 525, "department IDs must be unique")

  invariant(isRecord(value.parent_release), "parent_release is required")
  const parent = value.parent_release
  invariant(
    parent.repository === "matuteiglesias/argentina-geography",
    "unexpected parent repository",
  )
  invariant(SHA1.test(String(parent.commit_sha ?? "")), "parent commit must be SHA-1 pinned")
  invariant(
    parent.dataset_id === "arggeo.indec.census.2010.department-footprint",
    "unexpected parent dataset",
  )
  invariant(parent.level === "department", "parent must be department-level")
  invariant(parent.feature_count === 525, "parent must contain 525 features")
  invariant(
    SHA256.test(String(parent.canonical_geoparquet_sha256 ?? "")),
    "canonical GeoParquet must be SHA-256 addressed",
  )
  invariant(
    SHA256.test(String(parent.department_id_set_sha256 ?? "")),
    "department ID set must be SHA-256 addressed",
  )
  invariant(
    parent.display_geojson_sha256 === null ||
      SHA256.test(String(parent.display_geojson_sha256)),
    "display derivative hash must be null or SHA-256",
  )

  invariant(isRecord(value.payload_policy), "payload_policy is required")
  invariant(value.payload_policy.geometry_only === true, "transport must be geometry-only")
  invariant(
    value.payload_policy.poverty_values_embedded === false,
    "poverty values cannot be embedded",
  )
  invariant(
    value.payload_policy.atlas_side_dissolve === false,
    "Atlas-side dissolve is forbidden",
  )
  invariant(
    value.payload_policy.required_feature_property === "geography_id",
    "feature identity must be geography_id",
  )

  invariant(isRecord(value.mapbox), "mapbox section is required")
  invariant(
    value.mapbox.style_url === "mapbox://styles/mapbox/standard",
    "transport must use Mapbox Standard",
  )
  invariant(
    value.mapbox.feature_id_property === "geography_id",
    "Mapbox feature identity must be geography_id",
  )

  if (value.status === "ready_for_publication") {
    invariant(value.mapbox.tileset_id === null, "ready transport cannot claim a tileset")
    invariant(value.mapbox.source_layer === null, "ready transport cannot claim a source layer")
    invariant(
      value.mapbox.published_feature_count === null,
      "ready transport cannot claim published features",
    )
    invariant(
      value.mapbox.publication_time === null,
      "ready transport cannot claim publication time",
    )
    return value as unknown as DepartmentGeometryTransportManifest
  }

  invariant(
    typeof value.mapbox.tileset_id === "string" && value.mapbox.tileset_id.length > 0,
    "published transport requires tileset_id",
  )
  invariant(
    typeof value.mapbox.source_layer === "string" && value.mapbox.source_layer.length > 0,
    "published transport requires source_layer",
  )
  invariant(
    value.mapbox.published_feature_count === 525,
    "published transport must report 525 features",
  )
  invariant(
    typeof value.mapbox.publication_time === "string" &&
      value.mapbox.publication_time.length > 0,
    "published transport requires publication time",
  )
  invariant(
    SHA256.test(String(parent.display_geojson_sha256 ?? "")),
    "published transport requires a pinned display hash",
  )
  return value as unknown as DepartmentGeometryTransportManifest
}

export const departmentGeometryTransportManifest =
  validateDepartmentGeometryTransport(manifestJson)

export const departmentGeometryIds = [
  ...departmentGeometryTransportManifest.fixture_geography_ids,
]
