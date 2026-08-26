import { fixtureRelease, provinces } from "@/data/fixture"

export const GEOMETRY_TRANSPORT_URL = "/data/geography_transport.json"

export interface GeometryTransport {
  geography_level: "province_2010"
  geography_release_id: string
  feature_id_property: "geography_id"
  mapbox_source: string
  source_layer: string
  expected_geography_ids: string[]
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null
}

function readString(...values: unknown[]) {
  return values.find(
    (value): value is string => typeof value === "string" && value.length > 0,
  )
}

function normalizedMapboxSource(value: string) {
  return value.startsWith("mapbox://") ? value : `mapbox://${value}`
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Geometry transport validation failed: ${message}`)
}

/**
 * W4 consumes W3's governed transport rather than owning geometry publication.
 * The small alias allowance keeps the handoff tolerant to a nested `mapbox`
 * object while the scientific/geography identity fields remain exact.
 */
export function validateGeometryTransport(value: unknown): GeometryTransport {
  const raw = asRecord(value)
  assert(raw, "manifest must be an object")
  const mapbox = asRecord(raw.mapbox)

  const geographyLevel = readString(raw.geography_level)
  const geographyReleaseId = readString(raw.geography_release_id)
  const featureIdProperty = readString(
    raw.feature_id_property,
    mapbox?.feature_id_property,
  )
  const source = readString(
    raw.mapbox_source,
    raw.tileset_url,
    raw.mapbox_tileset_id,
    mapbox?.source,
    mapbox?.tileset_url,
    mapbox?.tileset_id,
  )
  const sourceLayer = readString(
    raw.source_layer,
    raw.mapbox_source_layer,
    mapbox?.source_layer,
  )
  const expectedIds = raw.expected_geography_ids

  assert(
    geographyLevel === fixtureRelease.metadata.geography_level,
    `expected geography_level ${fixtureRelease.metadata.geography_level}`,
  )
  assert(typeof geographyReleaseId === "string", "geography_release_id is required")
  assert(featureIdProperty === "geography_id", "feature identity must be geography_id")
  assert(typeof source === "string", "Mapbox tileset/source identity is required")
  assert(typeof sourceLayer === "string", "source_layer is required")
  assert(Array.isArray(expectedIds), "expected_geography_ids is required")
  assert(
    expectedIds.every((id): id is string => typeof id === "string"),
    "expected geography IDs must be strings",
  )

  const fixtureIds = provinces.map((province) => province.id).sort()
  const transportIds = [...expectedIds].sort()
  assert(
    JSON.stringify(transportIds) === JSON.stringify(fixtureIds),
    "transport geography IDs must exactly match the 24 fixture IDs",
  )

  return {
    geography_level: "province_2010",
    geography_release_id: geographyReleaseId,
    feature_id_property: "geography_id",
    mapbox_source: normalizedMapboxSource(source),
    source_layer: sourceLayer,
    expected_geography_ids: [...expectedIds],
  }
}

export async function loadGeometryTransport(
  url = GEOMETRY_TRANSPORT_URL,
): Promise<GeometryTransport> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Geometry transport unavailable (${response.status})`)
  }
  return validateGeometryTransport(await response.json())
}
