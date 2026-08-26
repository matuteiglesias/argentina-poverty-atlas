import "mapbox-gl/dist/mapbox-gl.css"

import { useEffect, useMemo, useRef, useState } from "react"
import type { AnyLayer, Map as MapboxMap, MapLayerMouseEvent } from "mapbox-gl"
import { Card } from "@/components/ui/card"
import { fixtureRelease, labels } from "@/data/fixture"
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
    <div className="grid gap-3 border-t border-slate-900/10 px-5 py-4 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
        <span>
          {labels.concepts[state.concept]} · {labels.estimands[state.estimand]}
        </span>
        <span>Dominio fijo entre períodos y universos</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs tabular-nums text-slate-500">0%</span>
        <div
          className="h-3 flex-1 rounded-full"
          style={{
            background: `linear-gradient(90deg, ${legend.stops.map((stop) => stop.color).join(", ")})`,
          }}
          aria-hidden="true"
        />
        <span className="text-xs tabular-nums text-slate-500">
          {formatPercent(legend.max)}
        </span>
        <span className="ml-2 inline-flex items-center gap-1.5 text-xs text-slate-500">
          <span
            className="h-3 w-3 rounded-sm border border-slate-300"
            style={{ backgroundColor: NO_DATA_COLOR }}
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
  const [status, setStatus] = useState<RuntimeStatus>(() =>
    runtimeGeometryTransport
      ? { kind: "loading", message: "Preparando transporte cartográfico…" }
      : {
          kind: "blocked",
          message: geometryTransportManifest.upstream_audit.finding,
        },
  )

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

      mapboxgl.accessToken = token
      map = new mapboxgl.Map({
        container,
        style: publishedTransport.style_url,
        center: [-64, -38],
        zoom: 2.8,
        minZoom: 2,
        attributionControl: true,
      })

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
      <div className="flex flex-col gap-2 border-b border-slate-900/10 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Territorio
          </p>
          <h2 className="mt-1 font-serif text-2xl font-semibold">
            Pobreza por jurisdicción
          </h2>
        </div>
        <p className="max-w-md text-sm text-slate-600">
          Una sola instancia de mapa; período, universo, concepto y estimando se
          actualizan mediante estado de features, sin crear estilos nuevos.
        </p>
      </div>

      <div className="relative min-h-[28rem] bg-slate-100 sm:min-h-[34rem]">
        <div
          ref={containerRef}
          className="absolute inset-0"
          aria-label="Mapa coroplético de jurisdicciones argentinas"
        />
        {status.kind !== "ready" && (
          <div className="absolute inset-0 grid place-items-center bg-slate-50/95 p-6 text-center">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-slate-800">
                {status.kind === "loading"
                  ? "Cargando mapa"
                  : status.kind === "blocked"
                    ? "Transporte W3 bloqueado correctamente"
                    : status.kind === "unavailable"
                      ? "Credencial pública pendiente"
                      : "No se pudo inicializar el mapa"}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {status.message}
              </p>
              {status.kind === "blocked" && (
                <a
                  className="mt-4 inline-flex text-sm font-semibold text-sky-900 underline underline-offset-4"
                  href={geometryTransportManifest.upstream_audit.blocker_issue}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ver prerequisite en argentina-geography
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      <MapLegend state={state} />

      <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-900/10 px-5 py-3 text-xs text-slate-500 sm:px-6">
        <span>Mapbox GL JS {MAPBOX_GL_VERSION}</span>
        <span>feature identity: geography_id</span>
        <span>W3: {geometryTransportManifest.status}</span>
        {status.kind === "ready" && (
          <span>geography: {status.transport.geography_release_id}</span>
        )}
      </div>
    </Card>
  )
}
