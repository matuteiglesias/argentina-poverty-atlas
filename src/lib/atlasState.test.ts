import { describe, expect, it } from "vitest"
import {
  buildAtlasHref,
  defaultAtlasState,
  normalizeRoute,
  parseAtlasState,
} from "@/lib/atlasState"

describe("atlas URL state", () => {
  it("parses a complete supported state without coercing geography IDs", () => {
    const state = parseAtlasState(
      "?period=demo-2026-S1&universe=households&concept=indigence&estimand=fgt2&place=06",
    )

    expect(state).toEqual({
      period: "demo-2026-S1",
      universe: "households",
      concept: "indigence",
      estimand: "fgt2",
      place: "06",
    })
  })

  it("fails closed to defaults for unsupported values", () => {
    const state = parseAtlasState(
      "?period=real-2026-Q1&universe=people&concept=income&estimand=mean&place=6",
    )

    expect(state).toEqual(defaultAtlasState)
  })

  it("keeps the supported public routes bounded", () => {
    expect(normalizeRoute("/explorar")).toBe("/explorar")
    expect(normalizeRoute("/admin")).toBe("/")
  })

  it("serializes a shareable explorer URL", () => {
    expect(
      buildAtlasHref("/explorar", {
        ...defaultAtlasState,
        place: "94",
      }),
    ).toContain("place=94")
  })
})
