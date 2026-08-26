export interface EditorialCamera {
  longitude: number
  latitude: number
  zoom: number
}

export const EDITORIAL_START_CAMERA: EditorialCamera = {
  longitude: -63.2,
  latitude: -27.3,
  zoom: 4.05,
}

export const EDITORIAL_END_CAMERA: EditorialCamera = {
  longitude: -64.3,
  latitude: -38.5,
  zoom: 2.72,
}

export function clampStoryProgress(value: number) {
  return Math.min(1, Math.max(0, value))
}

function lerp(start: number, end: number, progress: number) {
  return start + (end - start) * progress
}

export function editorialCameraAt(progress: number): EditorialCamera {
  const bounded = clampStoryProgress(progress)
  return {
    longitude: lerp(
      EDITORIAL_START_CAMERA.longitude,
      EDITORIAL_END_CAMERA.longitude,
      bounded,
    ),
    latitude: lerp(
      EDITORIAL_START_CAMERA.latitude,
      EDITORIAL_END_CAMERA.latitude,
      bounded,
    ),
    zoom: lerp(
      EDITORIAL_START_CAMERA.zoom,
      EDITORIAL_END_CAMERA.zoom,
      bounded,
    ),
  }
}
