import type { AtlasState } from "@/lib/atlasState"
import type {
  AtlasRelease,
  Concept,
  Estimand,
  PovertyFact,
  ReleaseGeography,
} from "@/data/release"
import type { RuntimeGeometryTransport } from "@/map/runtimeTransport"

export const MAP_SOURCE_ID = "atlas-provinces"
export const MAP_LAYERS = {
  fill: "poverty-fill",
  boundary: "poverty-border",
} as const

export const CHOROPLETH_COLORS = [
  "#fff7ec",
  "#fee8c8",
  "#fdbb84",
  "#fc8d59",
  "#d7301f",
  "#7f0000",
] as const
export const NO_DATA_COLOR = "#d7dce2"

interface FeatureStateTarget {
  source: string
  sourceLayer: string
  id: string
}

interface MapFeature {
  id?: string | number
  properties?: Record<string, unknown>
}

export interface MapLayerEvent {
  features?: MapFeature[]
}

export type MapLayerEventHandler = (event: MapLayerEvent) => void
export type RuntimeMapEventName = "mousemove" | "mouseleave" | "click"

export interface MapRuntime {
  getLayer(id: string): unknown
  addLayer(layer: Record<string, unknown>): void
  setPaintProperty(layerId: string, property: string, value: unknown): void
  setFeatureState(
    target: FeatureStateTarget,
    state: Record<string, string | number | boolean>,
  ): void
  on(type: RuntimeMapEventName, layerId: string, handler: MapLayerEventHandler): void
  off(type: RuntimeMapEventName, layerId: string, handler: MapLayerEventHandler): void
  setCursor?(cursor: "pointer" | ""): void
}

export interface LegendModel {
  min: 0
  max: number
  stops: { value: number; color: string }[]
}

function roundDomain(max: number) {
  const step = max <= 0.1 ? 0.02 : max <= 0.3 ? 0.05 : 0.1
  return Math.max(step, Math.ceil(max / step) * step)
}

export function getLegendModelFromMax(max: number): LegendModel {
  return {
    min: 0,
    max,
    stops: CHOROPLETH_COLORS.map((color, index) => ({
      color,
      value: (max * index) / (CHOROPLETH_COLORS.length - 1),
    })),
  }
}

/** A release-wide domain is stable across periods and persons/households. */
export function getLegendModel(
  release: AtlasRelease,
  concept: Concept,
  estimand: Estimand,
): LegendModel {
  const values = release.facts
    .filter(
      (fact) =>
        fact.geography_level === release.metadata.geography_level &&
        fact.concept === concept &&
        fact.estimand === estimand,
    )
    .map((fact) => fact.estimate)
  return getLegendModelFromMax(roundDomain(Math.max(...values)))
}

export function buildFillColorExpression(legend: LegendModel): unknown[] {
  return [
    "interpolate",
    ["linear"],
    ["get", "__atlas_estimate"],
    ...legend.stops.flatMap((stop) => [stop.value, stop.color]),
  ]
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value))
}

function parseHexColor(color: string) {
  const value = color.replace("#", "")
  if (!/^[0-9a-f]{6}$/i.test(value)) return null
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  }
}

function hexChannel(value: number) {
  return Math.round(value).toString(16).padStart(2, "0")
}

export function colorForEstimate(legend: LegendModel, estimate: number) {
  const stops = legend.stops
  if (stops.length === 0) return NO_DATA_COLOR
  if (estimate <= stops[0].value) return stops[0].color
  if (estimate >= stops[stops.length - 1].value) return stops[stops.length - 1].color

  for (let index = 1; index < stops.length; index += 1) {
    const right = stops[index]
    const left = stops[index - 1]
    if (estimate > right.value) continue
    const leftRgb = parseHexColor(left.color)
    const rightRgb = parseHexColor(right.color)
    if (!leftRgb || !rightRgb || right.value === left.value) return right.color
    const weight = clamp01((estimate - left.value) / (right.value - left.value))
    const mix = (a: number, b: number) => a + (b - a) * weight
    return `#${hexChannel(mix(leftRgb.r, rightRgb.r))}${hexChannel(mix(leftRgb.g, rightRgb.g))}${hexChannel(mix(leftRgb.b, rightRgb.b))}`
  }
  return stops[stops.length - 1].color
}

export function buildGeographyColorExpression(
  transport: RuntimeGeometryTransport,
  source: RuntimeFactSource,
  state: AtlasState,
): unknown[] {
  const legend = source.legendForState(state)
  const matches: unknown[] = []
  for (const geography of source.geographies) {
    const fact = source.factForState(state, geography.id)
    matches.push(
      geography.id,
      fact ? colorForEstimate(legend, fact.estimate) : NO_DATA_COLOR,
    )
  }
  return [
    "match",
    ["get", transport.feature_id_property],
    ...matches,
    NO_DATA_COLOR,
  ]
}

export function factForState(
  release: AtlasRelease,
  state: AtlasState,
  geographyId: string,
): PovertyFact | null {
  return (
    release.facts.find(
      (fact) =>
        fact.geography_level === release.metadata.geography_level &&
        fact.geography_id === geographyId &&
        fact.period === state.period &&
        fact.universe === state.universe &&
        fact.concept === state.concept &&
        fact.estimand === state.estimand,
    ) ?? null
  )
}

export interface RuntimeFactSource {
  geographies: readonly ReleaseGeography[]
  factForState(state: AtlasState, geographyId: string): PovertyFact | null
  legendForState(state: AtlasState): LegendModel
}

function runtimeFactSourceFromRelease(release: AtlasRelease): RuntimeFactSource {
  return {
    geographies: release.geographies,
    factForState: (state, geographyId) => factForState(release, state, geographyId),
    legendForState: (state) => getLegendModel(release, state.concept, state.estimand),
  }
}

function normalizeFactSource(
  source: AtlasRelease | RuntimeFactSource,
): RuntimeFactSource {
  return "metadata" in source ? runtimeFactSourceFromRelease(source) : source
}

export function buildLayerSpecs(transport: RuntimeGeometryTransport) {
  const shared = {
    source: MAP_SOURCE_ID,
    "source-layer": transport.source_layer,
  }
  return [
    {
      id: MAP_LAYERS.fill,
      type: "fill",
      ...shared,
      slot: "middle",
      paint: {
        "fill-color": NO_DATA_COLOR,
        "fill-color-transition": { duration: 220, delay: 0 },
        "fill-opacity": 0.88,
      },
    },
    {
      id: MAP_LAYERS.boundary,
      type: "line",
      ...shared,
      slot: "top",
      paint: {
        "line-color": "#ffffff",
        "line-opacity": 0.82,
        "line-width": ["interpolate", ["linear"], ["zoom"], 2, 0.55, 5, 0.95],
      },
    },
  ]
}

function eventGeographyId(
  event: MapLayerEvent,
  transport: RuntimeGeometryTransport,
): string | null {
  const feature = event.features?.[0]
  if (!feature) return null
  if (typeof feature.id === "string") return feature.id
  const propertyId = feature.properties?.[transport.feature_id_property]
  return typeof propertyId === "string" ? propertyId : null
}

export function createRuntimeJoin(
  map: MapRuntime,
  transport: RuntimeGeometryTransport,
  releaseOrSource: AtlasRelease | RuntimeFactSource,
  onSelect: (geographyId: string) => void,
  onHover: (geographyId: string | null) => void = () => undefined,
) {
  const source = normalizeFactSource(releaseOrSource)
  for (const layer of buildLayerSpecs(transport)) {
    if (!map.getLayer(String(layer.id))) map.addLayer(layer)
  }

  let hoveredId: string | null = null

  const setHovered = (nextId: string | null) => {
    if (hoveredId === nextId) return
    hoveredId = nextId
    map.setCursor?.(hoveredId ? "pointer" : "")
    onHover(hoveredId)
  }

  const onMouseMove: MapLayerEventHandler = (event) => {
    const geographyId = eventGeographyId(event, transport)
    setHovered(
      geographyId && transport.expected_geography_ids.includes(geographyId)
        ? geographyId
        : null,
    )
  }
  const onMouseLeave: MapLayerEventHandler = () => setHovered(null)
  const onClick: MapLayerEventHandler = (event) => {
    const geographyId = eventGeographyId(event, transport)
    if (geographyId && transport.expected_geography_ids.includes(geographyId)) {
      onSelect(geographyId)
    }
  }

  map.on("mousemove", MAP_LAYERS.fill, onMouseMove)
  map.on("mouseleave", MAP_LAYERS.fill, onMouseLeave)
  map.on("click", MAP_LAYERS.fill, onClick)

  return {
    applyState(state: AtlasState) {
      const legend = source.legendForState(state)
      map.setPaintProperty(
        MAP_LAYERS.fill,
        "fill-color",
        buildGeographyColorExpression(transport, source, state),
      )
      return legend
    },
    setHovered,
    destroy() {
      setHovered(null)
      map.off("mousemove", MAP_LAYERS.fill, onMouseMove)
      map.off("mouseleave", MAP_LAYERS.fill, onMouseLeave)
      map.off("click", MAP_LAYERS.fill, onClick)
    },
  }
}

export type RuntimeJoin = ReturnType<typeof createRuntimeJoin>
