import { describe, expect, it } from "vitest"
import {
  geometryTransportManifest,
  provinceGeometryIds,
  validateGeometryTransportManifest,
} from "@/map/geometryTransport"

const publishedManifest = {
  ...geometryTransportManifest,
  status: "published",
  parent_release: {
    repository: "matuteiglesias/argentina-geography",
    commit_sha: "a".repeat(40),
    geography_id: "example:province",
    release_version: "example-v1",
    level: "province",
    source_snapshot_sha256: "a".repeat(64),
    artifact_sha256: "b".repeat(64),
    feature_count: 24,
  },
  mapbox: {
    ...geometryTransportManifest.mapbox,
    tileset_id: "matuteiglesias2.argentina-provinces-example",
    source_layer: "provinces",
    published_feature_count: 24,
    publication_time: "2026-08-26T00:00:00Z",
    publication_job_id: "example-job",
  },
}

describe("W3 geometry transport manifest", () => {
  it("accepts the current fail-closed upstream blocker", () => {
    expect(geometryTransportManifest.status).toBe("blocked_upstream")
    expect(geometryTransportManifest.parent_release).toBeNull()
    expect(geometryTransportManifest.fixture_geography_ids).toEqual(provinceGeometryIds)
  })

  it("accepts a fully pinned 24-feature published transport", () => {
    expect(
      validateGeometryTransportManifest(publishedManifest, provinceGeometryIds).status,
    ).toBe("published")
  })

  it("rejects fixture identity drift", () => {
    const invalid = {
      ...geometryTransportManifest,
      fixture_geography_ids: [...provinceGeometryIds.slice(0, 23), "99"],
    }
    expect(() => validateGeometryTransportManifest(invalid, provinceGeometryIds)).toThrow(
      /exactly match/,
    )
  })

  it("rejects a non-province published parent", () => {
    const invalid = {
      ...publishedManifest,
      parent_release: { ...publishedManifest.parent_release, level: "radio" },
    }
    expect(() => validateGeometryTransportManifest(invalid, provinceGeometryIds)).toThrow(
      /province-level/,
    )
  })

  it("rejects poverty-valued geometry transport", () => {
    const invalid = {
      ...geometryTransportManifest,
      payload_policy: {
        ...geometryTransportManifest.payload_policy,
        poverty_values_embedded: true,
      },
    }
    expect(() => validateGeometryTransportManifest(invalid, provinceGeometryIds)).toThrow(
      /poverty values cannot be embedded/,
    )
  })
})
