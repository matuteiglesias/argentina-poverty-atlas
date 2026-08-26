import { useEffect, useMemo, useRef, useState } from "react"
import { Card } from "@/components/ui/card"
import { fixtureRelease, labels } from "@/data/fixture"
import type { AtlasState } from "@/lib/atlasState"
import {
  GEOMETRY_TRANSPORT_URL,
  loadGeometryTransport,
  type GeometryTransport,
} from "@/map/geometryTransport"
import {
  createRuntimeJoin,
  getLegendModel,
  MAP_SOURCE_ID,
  NO_DATA_COLOR,
  type MapLayerEventHandler,
  type MapRuntime,
  type RuntimeJoin,
} from "@/map/runtimeJoin"
import { formatPercent } from "@/lib/utils"

const MAPBOX_GL_VERSION = "3.29.0"
const MAPBOX_SCRIPT = `https://api.mapbox.com/mapbox-gl-js/v${MAPBOX_GL_VERSION}/mapbox-gl.js`
const MAPBOX_CSS = `https://api.mapbox.com/mapbox-gl-js/v${MAPBOX_GL_VERSION}/mapbox-gl.css`

interface BrowserMap extends MapRuntime {
  getSource(id: string): unknown
  addSource(id: string, source: Record<string, unknown>): void
  on(type: string, layerId: string, handler: MapLayerEventHandler): void
  on(type: "load", handler: () => void): void
  remove(): void
}

interface MapboxGlobal {
  accessToken: string
  Map: new (options: Record<string, unknown>) => BrowserMap
}

type MapboxWindow = Window & { mapboxgl?: MapboxGlobal }

let mapboxPromise: Promise<MapboxGlobal> | null = null

function loadMapboxGl() {
  const mapboxWindow = window as MapboxWindow
  if (mapboxWindow.mapboxgl) return Promise.resolve(mapboxWindow.mapboxgl)
  if (mapboxPromise) return mapboxPromise

  mapboxPromise = new Promise<MapboxGlobal>((resolve, reject) => {
    if (!document.querySelector(`link[href="${MAPBOX_CSS}"]`)) {
      const link = document.createElement("link")
      link.rel = "stylesheet"
      link.href = MAPBOX_CSS
      document.head.append(link)
    }

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${MAPBOX_SCRIPT}"]`,
    )
    const script = existing ?? document.createElement("script")
    const onLoad = () => {
      const loaded = (window as MapboxWindow).mapboxgl
      if (loaded) resolve(loaded)
      else reject(new Error("Mapbox GL loaded without exposing mapboxgl"))
    }
    const onError = () => reject(new Error("Unable to load Mapbox GL JS"))
    script.addEventListener("load", onLoad, { once: true })
    script.addEventListener("error", onError, { once: true })
    if (!existing) {
      script.src = MAPBOX_SCRIPT
      script.async = true
      document.head.append(script)
    }
  })
  return mapboxPromise
}

interface MapboxChoroplethProps {
  state: AtlasState
  onSelect: (geographyId: string) => void
}

type RuntimeStatus =
  | { kind: "loading"; message: string }
  | { kind: "ready"; message: string; transport: GeometryTransport }
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
  const [status, setStatus] = useState<RuntimeStatus>({
    kind: "loading",
    message: "Preparando transporte cartográfico…",
  })

  useEffect(() => {
    stateRef.current = state
    runtimeRef.current?.applyState(state)
  }, [state])

  useEffect(() => {
    selectRef.current = onSelect
  }, [onSelect])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const token = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN
    if (!token) {
      setStatus({
        kind: "unavailable",
        message:
          "Mapa no configurado: falta el token público VITE_MAPBOX_PUBLIC_TOKEN. La tabla territorial sigue disponible.",
      })
      return
    }

    let cancelled = false
    let map: BrowserMap | null = null
    let runtime: RuntimeJoin | null = null

    Promise.all([loadMapboxGl(), loadGeometryTransport()])
      .then(([mapboxgl, transport]) => {
        if (cancelled) return
        mapboxgl.accessToken = token
        map = new mapboxgl.Map({
          container,
          style: "mapbox://styles/mapbox/standard",
          center: [-64, -38],
          zoom: 2.8,
          minZoom: 2,
          attributionControl: true,
        })

        map.on("load", () => {
          if (cancelled || !map) return
          if (!map.getSource(MAP_SOURCE_ID)) {
            map.addSource(MAP_SOURCE_ID, {
              type: "vector",
              url: transport.mapbox_source,
              promoteId: transport.feature_id_property,
            })
          }
          runtime = createRuntimeJoin(
            map,
            transport,
            fixtureRelease,
            (geographyId) => selectRef.current(geographyId),
          )
          runtimeRef.current = runtime
          runtime.applyState(stateRef.current)
          setStatus({
            kind: "ready",
            message: "Mapa listo",
            transport,
          })
        })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        const message = error instanceof Error ? error.message : "Error desconocido"
        setStatus({
          kind: message.includes("transport unavailable")
            ? "unavailable"
            : "error",
          message: `${message}. La tabla territorial sigue disponible.`,
        })
      })

    return () => {
      cancelled = true
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
          <div className="absolute inset-0 grid place-items-center bg-slate-50/90 p-6 text-center">
            <div className="max-w-lg">
              <p className="text-sm font-semibold text-slate-800">
                {status.kind === "loading"
                  ? "Cargando mapa"
                  : status.kind === "unavailable"
                    ? "Transporte cartográfico pendiente"
                    : "No se pudo inicializar el mapa"}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {status.message}
              </p>
              {status.kind === "unavailable" && (
                <p className="mt-2 font-mono text-xs text-slate-500">
                  {GEOMETRY_TRANSPORT_URL}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <MapLegend state={state} />

      <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-900/10 px-5 py-3 text-xs text-slate-500 sm:px-6">
        <span>Mapbox GL JS {MAPBOX_GL_VERSION}</span>
        <span>feature identity: geography_id</span>
        {status.kind === "ready" && (
          <span>geography: {status.transport.geography_release_id}</span>
        )}
      </div>
    </Card>
  )
}
