import "mapbox-gl/dist/mapbox-gl.css"

import { useEffect, useMemo, useRef, useState } from "react"
import type { AnyLayer, Map as MapboxMap, MapLayerMouseEvent } from "mapbox-gl"
import { Card } from "@/components/ui/card"
import {
  fixtureEstimate,
  fixtureRelease,
  getPeriodLabel,
  getProvince,
  labels,
} from "@/data/fixture"
import type { AtlasState } from "@/lib/atlasState"
import { geometryTransportManifest } from "@/map/geometryTransport"
import {
  createRuntimeJoin,
  getLegendModel,
  MAP_SOURCE_ID,
  NO_DATA_COLOR,
  type MapLayerEvent,
  type MapLayerEventHandler,
  type MapRuntime,
  type RuntimeJoin,
  type RuntimeMapEventName,
} from "@/map/runtimeJoin"
import {
  runtimeGeometryTransport,
  type RuntimeGeometryTransport,
} from "@/map/runtimeTransport"
import { formatPercent } from "@/lib/utils"

const MAPBOX_GL_VERSION = "3.29.0"

type RuntimeFeature = NonNullable<MapLayerEvent["features"]>[number]

function createMapRuntimeAdapter(map: MapboxMap): MapRuntime {
  const handlers = new Map<
    MapLayerEventHandler,
    (event: MapLayerMouseEvent) => void
  >()
  const setPaintProperty = map.setPaintProperty.bind(map) as (
    layerId: string,
    property: string,
    value: unknown,
  ) => void

  function eventHandler(handler: MapLayerEventHandler) {
    const existing = handlers.get(handler)
    if (existing) return existing
    const adapted = (event: MapLayerMouseEvent) =>
      handler({
        features: event.features as unknown as RuntimeFeature[] | undefined,
      })
    handlers.set(handler, adapted)
    return adapted
  }

  return {
    getLayer(id) {
      return map.getLayer(id)
    },
    addLayer(layer) {
      map.addLayer(layer as AnyLayer)
    },
    setPaintProperty(layerId, property, value) {
      setPaintProperty(layerId, property, value)
    },
    setFeatureState(target, state) {
      map.setFeatureState(target, state)
    },
    on(type: RuntimeMapEventName, layerId, handler) {
      map.on(type, layerId, eventHandler(handler))
    },
    off(type: RuntimeMapEventName, layerId, handler) {
      const adapted = handlers.get(handler)
      if (!adapted) return
      map.off(type, layerId, adapted)
      handlers.delete(handler)
    },
    setCursor(cursor) {
      map.getCanvas().style.cursor = cursor
    },
  }
}

interface MapboxChoroplethProps {
  state: AtlasState
  onSelect: (geographyId: string) => void
}

type RuntimeStatus =
  | { kind: "loading"; message: string }
  | { kind: "ready"; message: string; transport: RuntimeGeometryTransport }
  | { kind: "blocked"; message: string }
  | { kind: "unavailable"; message: string }
  | { kind: "error"; message: string }

function MapLegend({ state }: { state: AtlasState }) {
  const legend = useMemo(
    () => getLegendModel(fixtureRelease, state.concept, state.estimand),
    [state.concept, state.estimand],
  )

  return (
    <div className="grid gap-3 border-t border-slate-900/10 px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
        <span className="font-medium text-slate-700">
          {labels.concepts[state.concept]} · {labels.estimands[state.estimand]}
        </span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1">
          escala comparable entre períodos y universos
        </span>
      </div>

      <div aria-label={`Escala de 0 a ${formatPercent(legend.max)}`}>
        <div
          className="h-3 rounded-full border border-slate-900/10"
          style={{
            background: `linear-gradient(90deg, ${legend.stops.map((stop) => stop.color).join(", ")})`,
          }}
          aria-hidden="true"
        />
        <div className="relative mt-1.5 h-4">
          {legend.stops.map((stop, index) => {
            const left = (stop.value / legend.max) * 100
            const transform =
              index === 0
                ? "translateX(0)"
                : index === legend.stops.length - 1
                  ? "translateX(-100%)"
                  : "translateX(-50%)"
            return (
              <span
                key={stop.value}
                className="absolute whitespace-nowrap text-[10px] tabular-nums text-slate-500"
                style={{ left: `${left}%`, transform }}
              >
                {formatPercent(stop.value)}
              </span>
            )
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
        <span>Más claro → menor valor</span>
        <span>Más oscuro → mayor valor</span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-3 w-3 rounded-sm border border-slate-300"
            style={{ backgroundColor: NO_DATA_COLOR }}
            aria-hidden="true"
          />
          Sin dato
        </span>
      </div>
    </div>
  )
}

export function MapboxChoropleth({ state, onSelect }: MapboxChoroplethProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const runtimeRef = useRef<RuntimeJoin | null>(null)
  const stateRef = useRef(state)
  const selectRef = useRef(onSelect)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [status, setStatus] = useState<RuntimeStatus>(() =>
    runtimeGeometryTransport
      ? { kind: "loading", message: "Preparando transporte cartográfico…" }
      : {
          kind: "blocked",
          message: geometryTransportManifest.upstream_audit.finding,
        },
  )

  const hoveredProvince = getProvince(hoveredId)
  const hoveredValue = hoveredProvince
    ? fixtureEstimate(
        hoveredProvince.id,
        state.period,
        state.universe,
        state.concept,
        state.estimand,
      )
    : null
  const selectedProvince = getProvince(state.place)
  const selectedValue = selectedProvince
    ? fixtureEstimate(
        selectedProvince.id,
        state.period,
        state.universe,
        state.concept,
        state.estimand,
      )
    : null

  useEffect(() => {
    stateRef.current = state
    runtimeRef.current?.applyState(state)
  }, [state])

  useEffect(() => {
    selectRef.current = onSelect
  }, [onSelect])

  useEffect(() => {
    const container = containerRef.current
    const transport = runtimeGeometryTransport
    if (!container || !transport) return
    const publishedTransport: RuntimeGeometryTransport = transport

    const token = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN?.trim()
    if (!token) {
      setStatus({
        kind: "unavailable",
        message:
          "El transporte W3 está publicado, pero falta VITE_MAPBOX_PUBLIC_TOKEN. La tabla territorial sigue disponible.",
      })
      return
    }

    let disposed = false
    let map: MapboxMap | null = null
    let runtime: RuntimeJoin | null = null

    async function mountMap() {
      const mapboxgl = (await import("mapbox-gl")).default
      if (disposed || !container) return

      const coarsePointer = window.matchMedia("(pointer: coarse)").matches
      mapboxgl.accessToken = token
      map = new mapboxgl.Map({
        container,
        style: publishedTransport.style_url,
        center: [-64, -38],
        zoom: 2.8,
        minZoom: 2,
        attributionControl: true,
        cooperativeGestures: coarsePointer,
      })

      map.scrollZoom.disable()
      map.dragRotate.disable()
      map.touchZoomRotate.disableRotation()
      map.addControl(
        new mapboxgl.NavigationControl({ showCompass: false, visualizePitch: false }),
        "top-right",
      )

      map.on("load", () => {
        if (disposed || !map) return
        if (!map.getSource(MAP_SOURCE_ID)) {
          map.addSource(MAP_SOURCE_ID, {
            type: "vector",
            url: publishedTransport.mapbox_source,
            promoteId: publishedTransport.feature_id_property,
          })
        }
        runtime = createRuntimeJoin(
          createMapRuntimeAdapter(map),
          publishedTransport,
          fixtureRelease,
          (geographyId) => selectRef.current(geographyId),
          (geographyId) => {
            if (!disposed) setHoveredId(geographyId)
          },
        )
        runtimeRef.current = runtime
        runtime.applyState(stateRef.current)
        setStatus({
          kind: "ready",
          message: "Mapa listo",
          transport: publishedTransport,
        })
      })
    }

    void mountMap().catch((error: unknown) => {
      if (disposed) return
      const message = error instanceof Error ? error.message : "Error desconocido"
      setStatus({
        kind: "error",
        message: `${message}. La tabla territorial sigue disponible.`,
      })
    })

    return () => {
      disposed = true
      runtime?.destroy()
      runtimeRef.current = null
      map?.remove()
    }
  }, [])

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-900/10 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Territorio · {getPeriodLabel(state.period)}
          </p>
          <h2 className="mt-1 font-serif text-2xl font-semibold">
            Mapa provincial
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {labels.concepts[state.concept]} · {labels.universes[state.universe]} · {labels.estimands[state.estimand]}
          </p>
        </div>
        {selectedProvince && selectedValue !== null ? (
          <div className="rounded-xl border border-slate-900/10 bg-slate-50 px-3 py-2 text-sm sm:text-right">
            <span className="block text-xs text-slate-500">Selección activa</span>
            <span className="font-semibold text-slate-900">
              {selectedProvince.shortName} · {formatPercent(selectedValue)}
            </span>
          </div>
        ) : (
          <p className="max-w-xs text-sm leading-5 text-slate-500 sm:text-right">
            Pasá el cursor para leer; hacé click o tocá para fijar una jurisdicción.
          </p>
        )}
      </div>

      <div className="relative h-[26rem] bg-slate-100 sm:h-[34rem] lg:h-[40rem]">
        <div
          ref={containerRef}
          className="absolute inset-0"
          aria-label="Mapa coroplético de jurisdicciones argentinas"
        />

        {status.kind === "ready" && hoveredProvince && hoveredValue !== null && (
          <div className="pointer-events-none absolute left-3 top-3 max-w-[15rem] rounded-xl border border-white/70 bg-white/95 px-3.5 py-3 shadow-lg shadow-slate-950/10 backdrop-blur-sm sm:left-4 sm:top-4">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              {hoveredProvince.id}
            </span>
            <span className="mt-0.5 block text-sm font-semibold text-slate-950">
              {hoveredProvince.shortName}
            </span>
            <span className="mt-1 block text-2xl font-semibold tabular-nums text-slate-950">
              {formatPercent(hoveredValue)}
            </span>
            <span className="mt-1 block text-xs text-slate-500">Click/tap para fijar</span>
          </div>
        )}

        {status.kind !== "ready" && (
          <div className="absolute inset-0 grid place-items-center bg-slate-50/95 p-6 text-center">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-slate-800">
                {status.kind === "loading"
                  ? "Cargando mapa"
                  : status.kind === "blocked"
                    ? "Transporte geográfico pendiente"
                    : status.kind === "unavailable"
                      ? "Credencial pública pendiente"
                      : "No se pudo inicializar el mapa"}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {status.message}
              </p>
              {status.kind === "blocked" && (
                <a
                  className="mt-4 inline-flex text-sm font-semibold text-slate-900 underline decoration-slate-400 underline-offset-4"
                  href={geometryTransportManifest.upstream_audit.blocker_issue}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ver evidencia de transporte
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      <MapLegend state={state} />

      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-900/10 px-4 py-2.5 text-[11px] text-slate-500 sm:px-5">
        <span>una instancia Mapbox GL JS {MAPBOX_GL_VERSION}</span>
        <span>join: feature-state/geography_id</span>
        <span>transporte: {geometryTransportManifest.status}</span>
        {status.kind === "ready" && (
          <span>geografía: {status.transport.geography_release_id}</span>
        )}
      </div>
    </Card>
  )
}
