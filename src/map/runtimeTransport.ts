import type { GeographyLevel } from "@/data/release"
import {
  geometryTransportManifestForLevel,
  isPublishedGeometryTransport,
  type GeometryTransportManifest,
} from "@/map/geometryTransport"

export interface RuntimeGeometryTransport {
  geography_level: GeographyLevel
  geography_release_id: string
  feature_id_property: "geography_id"
  mapbox_source: string
  source_layer: string
  style_url: "mapbox://styles/mapbox/standard"
  expected_geography_ids: string[]
}

function levelFromManifest(manifest: GeometryTransportManifest): GeographyLevel {
  if (manifest.parent_release?.level === "department") return "department_2010"
  if (manifest.upstream_audit.required_level === "department") return "department_2010"
  return "province_2010"
}

/**
 * Convert one exact governed transport manifest into the small shape the runtime
 * join needs. Ready/blocked manifests are not degraded transports: they are no
 * transport.
 */
export function runtimeTransportFromManifest(
  manifest: GeometryTransportManifest,
  expectedLevel: GeographyLevel = levelFromManifest(manifest),
): RuntimeGeometryTransport | null {
  if (!isPublishedGeometryTransport(manifest)) return null
  const level = levelFromManifest(manifest)
  if (level !== expectedLevel) {
    throw new Error(
      `Runtime geometry level mismatch: expected ${expectedLevel}, got ${level}`,
    )
  }

  return {
    geography_level: level,
    geography_release_id: `${manifest.parent_release.geography_id}@${manifest.parent_release.release_version}`,
    feature_id_property: "geography_id",
    mapbox_source: `mapbox://${manifest.mapbox.tileset_id}`,
    source_layer: manifest.mapbox.source_layer,
    style_url: "mapbox://styles/mapbox/standard",
    expected_geography_ids: [...manifest.fixture_geography_ids],
  }
}

const runtimeTransportByLevel: Record<
  GeographyLevel,
  RuntimeGeometryTransport | null
> = {
  province_2010: runtimeTransportFromManifest(
    geometryTransportManifestForLevel("province_2010"),
    "province_2010",
  ),
  department_2010: runtimeTransportFromManifest(
    geometryTransportManifestForLevel("department_2010"),
    "department_2010",
  ),
}

export function runtimeGeometryTransportForLevel(
  level: GeographyLevel,
): RuntimeGeometryTransport | null {
  return runtimeTransportByLevel[level]
}

// Backwards-compatible province seam for the editorial homepage.
export const runtimeGeometryTransport = runtimeTransportByLevel.province_2010
