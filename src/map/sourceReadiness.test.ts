import { describe, expect, it } from "vitest"
import { loadedGeographyIds } from "@/map/sourceReadiness"

describe("loadedGeographyIds", () => {
  it("deduplicates loaded geography IDs and ignores non-string identities", () => {
    expect(
      loadedGeographyIds(
        [
          { properties: { geography_id: "02" } },
          { properties: { geography_id: "06" } },
          { properties: { geography_id: "02" } },
          { properties: { geography_id: 10 } },
          { properties: {} },
        ],
        "geography_id",
      ),
    ).toEqual(["02", "06"])
  })

  it("honors the configured feature identity property", () => {
    expect(
      loadedGeographyIds(
        [{ properties: { custom_id: "a", geography_id: "ignored" } }],
        "custom_id",
      ),
    ).toEqual(["a"])
  })
})
