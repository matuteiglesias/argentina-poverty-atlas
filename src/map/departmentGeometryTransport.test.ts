import { describe, expect, it } from "vitest"
import {
  departmentGeometryIds,
  departmentGeometryTransportManifest,
  validateDepartmentGeometryTransport,
} from "@/map/departmentGeometryTransport"

describe("department W3 geometry transport", () => {
  it("pins the exact governed 525 five-digit identities", () => {
    expect(departmentGeometryIds).toHaveLength(525)
    expect(new Set(departmentGeometryIds).size).toBe(525)
    expect(departmentGeometryIds.every((id) => /^\d{5}$/.test(id))).toBe(true)
    expect(departmentGeometryIds).toContain("02001")
    expect(departmentGeometryIds).toContain("94014")
  })

  it("accepts the committed ready or published contract", () => {
    const manifest = validateDepartmentGeometryTransport(
      departmentGeometryTransportManifest,
    )
    expect(manifest.parent_release.feature_count).toBe(525)
    expect(manifest.payload_policy.geometry_only).toBe(true)
    expect(manifest.payload_policy.poverty_values_embedded).toBe(false)
    expect(manifest.payload_policy.atlas_side_dissolve).toBe(false)
  })

  it("rejects leading-zero loss even when count remains 525", () => {
    const invalid = {
      ...departmentGeometryTransportManifest,
      fixture_geography_ids: [
        "2001",
        ...departmentGeometryIds.slice(1),
      ],
    }
    expect(() => validateDepartmentGeometryTransport(invalid)).toThrow(
      /five-digit/,
    )
  })

  it("rejects duplicate identities", () => {
    const invalid = {
      ...departmentGeometryTransportManifest,
      fixture_geography_ids: [
        departmentGeometryIds[0],
        departmentGeometryIds[0],
        ...departmentGeometryIds.slice(2),
      ],
    }
    expect(() => validateDepartmentGeometryTransport(invalid)).toThrow(
      /unique/,
    )
  })

  it("rejects Atlas-side dissolve or poverty-valued geometry", () => {
    const dissolve = {
      ...departmentGeometryTransportManifest,
      payload_policy: {
        ...departmentGeometryTransportManifest.payload_policy,
        atlas_side_dissolve: true,
      },
    }
    expect(() => validateDepartmentGeometryTransport(dissolve)).toThrow(
      /Atlas-side dissolve/,
    )

    const valued = {
      ...departmentGeometryTransportManifest,
      payload_policy: {
        ...departmentGeometryTransportManifest.payload_policy,
        poverty_values_embedded: true,
      },
    }
    expect(() => validateDepartmentGeometryTransport(valued)).toThrow(
      /poverty values/,
    )
  })

  it("published state requires the complete provider proof shape", () => {
    const published = {
      ...departmentGeometryTransportManifest,
      status: "published",
      parent_release: {
        ...departmentGeometryTransportManifest.parent_release,
        display_geojson_sha256: "b".repeat(64),
      },
      mapbox: {
        ...departmentGeometryTransportManifest.mapbox,
        tileset_id: "matuteiglesias2.arg-dept-cpv2010",
        source_layer: "departments",
        published_feature_count: 525,
        publication_time: "2026-09-25T00:00:00Z",
        publication_job_id: "example",
      },
    }
    expect(validateDepartmentGeometryTransport(published).status).toBe(
      "published",
    )
  })
})
