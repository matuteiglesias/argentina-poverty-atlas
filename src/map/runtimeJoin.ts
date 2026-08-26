import type { AtlasState } from "@/lib/atlasState"
import type {
  AtlasRelease,
  Concept,
  Estimand,
  PovertyFact,
} from "@/data/release"
import type { RuntimeGeometryTransport } from "@/map/runtimeTransport"

export const MAP_SOURCE_ID = "atlas-provinces"
export const MAP_LAYERS = {
  fill: "poverty-fill",
  boundary: "poverty-border",
  hover: "poverty-hover",
  selected: "poverty-selected",
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
  const max = roundDomain(Math.max(...values))
  return {
    min: 0,
    max,
    stops: CHOROPLETH_COLORS.map((color, index) => ({
      color,
      value: (max * index) / (CHOROPLETH_COLORS.length - 1),
    })),
  }
}

export function buildFillColorExpression(legend: LegendModel): unknown[] {
  return [
    "case",
    ["==", ["feature-state", "hasData"], true],
    [
      "interpolate",
      ["linear"],
      ["feature-state", "estimate"],
      ...legend.stops.flatMap((stop) => [stop.value, stop.color]),
    ],
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
        "fill-color-transition": { duration: 260, delay: 0 },
        "fill-opacity": [
          "case",
          ["==", ["feature-state", "selected"], true],
          0.94,
          ["==", ["feature-state", "hovered"], true],
          0.9,
          0.82,
        ],
        "fill-opacity-transition": { duration: 150, delay: 0 },
      },
    },
    {
      id: MAP_LAYERS.boundary,
      type: "line",
      ...shared,
      slot: "top",
      paint: {
        "line-color": "#ffffff",
        "line-opacity": 0.88,
        "line-width": ["interpolate", ["linear"], ["zoom"], 2, 0.65, 5, 1.1],
      },
    },
    {
      id: MAP_LAYERS.hover,
      type: "line",
      ...shared,
      slot: "top",
      paint: {
        "line-color": "#334155",
        "line-opacity": [
          "case",
          ["==", ["feature-state", "hovered"], true],
          1,
          0,
        ],
        "line-opacity-transition": { duration: 90, delay: 0 },
        "line-width": 2.25,
      },
    },
    {
      id: MAP_LAYERS.selected,
      type: "line",
      ...shared,
      slot: "top",
      paint: {
        "line-color": "#020617",
        "line-opacity": [
          "case",
          ["==", ["feature-state", "selected"], true],
          1,
          0,
        ],
        "line-opacity-transition": { duration: 120, delay: 0 },
        "line-width": 4,
      },
    },
  ]
}

function featureTarget(transport: RuntimeGeometryTransport, id: string) {
  return {
    source: MAP_SOURCE_ID,
    sourceLayer: transport.source_layer,
    id,
  }
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
  release: AtlasRelease,
  onSelect: (geographyId: string) => void,
  onHover: (geographyId: string | null) => void = () => undefined,
) {
  for (const layer of buildLayerSpecs(transport)) {
    if (!map.getLayer(String(layer.id))) map.addLayer(layer)
  }

  let hoveredId: string | null = null

  const setHovered = (nextId: string | null) => {
    if (hoveredId === nextId) return
    if (hoveredId) {
      map.setFeatureState(featureTarget(transport, hoveredId), { hovered: false })
    }
    hoveredId = nextId
    if (hoveredId) {
      map.setFeatureState(featureTarget(transport, hoveredId), { hovered: true })
    }
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
      const legend = getLegendModel(release, state.concept, state.estimand)
      map.setPaintProperty(
        MAP_LAYERS.fill,
        "fill-color",
        buildFillColorExpression(legend),
      )

      for (const geography of release.geographies) {
        const fact = factForState(release, state, geography.id)
        map.setFeatureState(featureTarget(transport, geography.id), {
          hasData: fact !== null,
          estimate: fact?.estimate ?? 0,
          qualityStatus: fact?.quality_status ?? "no_data",
          warningCount: fact?.warning_codes?.length ?? 0,
          selected: state.place === geography.id,
        })
      }
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
