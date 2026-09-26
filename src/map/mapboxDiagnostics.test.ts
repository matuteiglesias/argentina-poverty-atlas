import { describe, expect, it } from "vitest"
import {
  parseDiagnosticLevel,
  tileCenter,
  vectorTileUrl,
} from "@/map/mapboxDiagnostics"

describe("Mapbox diagnostic helpers", () => {
  it("defaults to province and accepts the governed department level", () => {
    expect(parseDiagnosticLevel("")).toBe("province_2010")
    expect(parseDiagnosticLevel("?level=department_2010")).toBe("department_2010")
    expect(parseDiagnosticLevel("?level=unknown")).toBe("province_2010")
  })

  it("centers a slippy-map tile inside its geographic footprint", () => {
    const [lon, lat] = tileCenter(3, 2, 4)
    expect(lon).toBeCloseTo(-67.5)
    expect(lat).toBeLessThan(0)
    expect(lat).toBeGreaterThan(-45)
  })

  it("builds an exact public-token MVT request without exposing any secret token", () => {
    expect(
      vectorTileUrl(
        "matuteiglesias2.example",
        { z: 3, x: 2, y: 4 },
        "pk.public",
      ),
    ).toBe(
      "https://api.mapbox.com/v4/matuteiglesias2.example/3/2/4.mvt?access_token=pk.public",
    )
  })
})
