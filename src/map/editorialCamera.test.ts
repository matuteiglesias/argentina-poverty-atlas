import { describe, expect, it } from "vitest"
import {
  EDITORIAL_END_CAMERA,
  EDITORIAL_START_CAMERA,
  clampStoryProgress,
  editorialCameraAt,
} from "@/map/editorialCamera"

describe("editorialCameraAt", () => {
  it("starts at the intended close north/north-central frame", () => {
    expect(editorialCameraAt(0)).toEqual(EDITORIAL_START_CAMERA)
  })

  it("ends at the intended whole-country frame", () => {
    expect(editorialCameraAt(1)).toEqual(EDITORIAL_END_CAMERA)
  })

  it("moves continuously toward a lower zoom and more southern center", () => {
    const middle = editorialCameraAt(0.5)
    expect(middle.zoom).toBeLessThan(EDITORIAL_START_CAMERA.zoom)
    expect(middle.zoom).toBeGreaterThan(EDITORIAL_END_CAMERA.zoom)
    expect(middle.latitude).toBeLessThan(EDITORIAL_START_CAMERA.latitude)
    expect(middle.latitude).toBeGreaterThan(EDITORIAL_END_CAMERA.latitude)
  })

  it("clamps page progress rather than extrapolating the camera", () => {
    expect(clampStoryProgress(-1)).toBe(0)
    expect(clampStoryProgress(2)).toBe(1)
    expect(editorialCameraAt(-1)).toEqual(EDITORIAL_START_CAMERA)
    expect(editorialCameraAt(2)).toEqual(EDITORIAL_END_CAMERA)
  })
})
