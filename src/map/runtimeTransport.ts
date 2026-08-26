import {
  geometryTransportManifest,
  isPublishedGeometryTransport,
  type GeometryTransportManifest,
} from "@/map/geometryTransport"

export interface RuntimeGeometryTransport {
  geography_level: "province_2010"
  geography_release_id: string
  feature_id_property: "geography_id"
  mapbox_source: string
  source_layer: string
  style_url: "mapbox://styles/mapbox/standard"
  expected_geography_ids: string[]
}

/**
 * Convert the exact W3 governed manifest into the small shape the runtime join
 * needs. A blocked W3 manifest is not a degraded transport: it is no transport.
 */
export function runtimeTransportFromManifest(
  manifest: GeometryTransportManifest,
): RuntimeGeometryTransport | null {
  if (!isPublishedGeometryTransport(manifest)) return null

  return {
    geography_level: "province_2010",
    geography_release_id: `${manifest.parent_release.geography_id}@${manifest.parent_release.release_version}`,
    feature_id_property: "geography_id",
    mapbox_source: `mapbox://${manifest.mapbox.tileset_id}`,
    source_layer: manifest.mapbox.source_layer,
    style_url: "mapbox://styles/mapbox/standard",
    expected_geography_ids: [...manifest.fixture_geography_ids],
  }
}

export const runtimeGeometryTransport = runtimeTransportFromManifest(
  geometryTransportManifest,
)
