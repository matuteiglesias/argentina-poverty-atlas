import "mapbox-gl/dist/mapbox-gl.css"

import { useEffect, useRef, useState } from "react"
import type { Map as MapboxMap } from "mapbox-gl"
import { Button } from "@/components/ui/button"
import {
  fixtureEstimate,
  fixtureRelease,
  getPeriodLabel,
  getProvince,
  labels,
} from "@/data/fixture"
import type { AtlasState } from "@/lib/atlasState"
import { formatPercent } from "@/lib/utils"
import { geometryTransportManifest } from "@/map/geometryTransport"
import { createMapRuntimeAdapter } from "@/map/mapRuntimeAdapter"
import {
  createRuntimeJoin,
  MAP_SOURCE_ID,
  type RuntimeJoin,
} from "@/map/runtimeJoin"
import {
  runtimeGeometryTransport,
  type RuntimeGeometryTransport,
} from "@/map/runtimeTransport"

interface EditorialTerritoryStoryProps {
  state: AtlasState
  onChange: (patch: Partial<AtlasState>) => void
  onExplore: () => void
}

type StoryStatus =
  | { kind: "loading"; message: string }
  | { kind: "ready"; transport: RuntimeGeometryTransport }
  | { kind: "blocked"; message: string }
  | { kind: "unavailable"; message: string }
  | { kind: "error"; message: string }

const START_CAMERA = { longitude: -63.2, latitude: -27.3, zoom: 4.05 }
const END_CAMERA = { longitude: -64.3, latitude: -38.5, zoom: 2.72 }

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function lerp(start: number, end: number, progress: number) {
  return start + (end - start) * progress
}

function storyCopy(progress: number) {
  if (progress < 0.34) {
    return {
      eyebrow: "Una entrada cercana",
      title: "El territorio aparece primero como lugar.",
      copy: "La lectura comienza cerca del norte y centro del país. Al seguir bajando, la cámara se abre sin secuestrar el scroll de la página.",
    }
  }
  if (progress < 0.72) {
    return {
      eyebrow: "Abrir la escala",
      title: "Una provincia cobra sentido junto a las demás.",
      copy: "El color conserva la misma medida y el mismo período. La cámara cambia; los datos no se recalculan ni se incrustan en la geometría.",
    }
  }
  return {
    eyebrow: "Argentina completa",
    title: "Veinticuatro jurisdicciones, una misma regla de lectura.",
    copy: "Desde acá podés fijar una provincia o pasar al explorador para navegar libremente, cambiar medidas y comparar con el valor nacional.",
  }
}

export function EditorialTerritoryStory({
  state,
  onChange,
  onExplore,
}: EditorialTerritoryStoryProps) {
  const sectionRef = useRef<HTMLElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapboxMap | null>(null)
  const runtimeRef = useRef<RuntimeJoin | null>(null)
  const stateRef = useRef(state)
  const selectRef = useRef<(id: string) => void>((id) => onChange({ place: id }))
  const [progress, setProgress] = useState(0)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [status, setStatus] = useState<StoryStatus>(() =>
    runtimeGeometryTransport
      ? { kind: "loading", message: "Preparando el territorio…" }
      : {
          kind: "blocked",
          message: "El contrato cartográfico está preparado, pero el transporte Mapbox todavía no está publicado.",
        },
  )

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
  const national = fixtureEstimate(
    "ARG",
    state.period,
    state.universe,
    state.concept,
    state.estimand,
  )
  const copy = storyCopy(progress)

  useEffect(() => {
    stateRef.current = state
    runtimeRef.current?.applyState(state)
  }, [state])

  useEffect(() => {
    selectRef.current = (id) => onChange({ place: id })
  }, [onChange])

  useEffect(() => {
    const container = containerRef.current
    const transport = runtimeGeometryTransport
    if (!container || !transport) return

    const token = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN?.trim()
    if (!token) {
      setStatus({
        kind: "unavailable",
        message: "El mapa necesita el token público restringido de Mapbox. El resto de la lectura y la consulta tabular siguen disponibles.",
      })
      return
    }

    let disposed = false
    let runtime: RuntimeJoin | null = null
    let map: MapboxMap | null = null

    async function mountMap() {
      const mapboxgl = (await import("mapbox-gl")).default
      if (disposed || !container) return

      mapboxgl.accessToken = token
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      const coarsePointer = window.matchMedia("(pointer: coarse)").matches
      const narrow = window.matchMedia("(max-width: 767px)").matches
      const start = reducedMotion || narrow ? END_CAMERA : START_CAMERA

      map = new mapboxgl.Map({
        container,
        style: transport.style_url,
        center: [start.longitude, start.latitude],
        zoom: start.zoom,
        minZoom: 2,
        attributionControl: true,
        cooperativeGestures: coarsePointer,
      })
      mapRef.current = map

      map.scrollZoom.disable()
      map.dragRotate.disable()
      map.touchZoomRotate.disableRotation()
      map.doubleClickZoom.disable()
      map.dragPan.disable()
      map.keyboard.disable()

      map.on("load", () => {
        if (disposed || !map) return
        if (!map.getSource(MAP_SOURCE_ID)) {
          map.addSource(MAP_SOURCE_ID, {
            type: "vector",
            url: transport.mapbox_source,
            promoteId: transport.feature_id_property,
          })
        }
        runtime = createRuntimeJoin(
          createMapRuntimeAdapter(map),
          transport,
          fixtureRelease,
          (geographyId) => selectRef.current(geographyId),
          (geographyId) => {
            if (!disposed) setHoveredId(geographyId)
          },
        )
        runtimeRef.current = runtime
        runtime.applyState(stateRef.current)
        setStatus({ kind: "ready", transport })
      })
    }

    void mountMap().catch((error: unknown) => {
      if (disposed) return
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "No se pudo inicializar el mapa.",
      })
    })

    return () => {
      disposed = true
      runtime?.destroy()
      runtimeRef.current = null
      mapRef.current = null
      map?.remove()
    }
  }, [])

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const narrow = window.matchMedia("(max-width: 767px)").matches
    if (reducedMotion || narrow) {
      setProgress(1)
      return
    }

    let frame = 0
    const update = () => {
      frame = 0
      const rect = section.getBoundingClientRect()
      const travel = Math.max(section.offsetHeight - window.innerHeight, 1)
      const next = clamp(-rect.top / travel, 0, 1)
      setProgress(next)
      const map = mapRef.current
      if (map) {
        map.jumpTo({
          center: [
            lerp(START_CAMERA.longitude, END_CAMERA.longitude, next),
            lerp(START_CAMERA.latitude, END_CAMERA.latitude, next),
          ],
          zoom: lerp(START_CAMERA.zoom, END_CAMERA.zoom, next),
          bearing: 0,
          pitch: 0,
        })
      }
    }
    const requestUpdate = () => {
      if (frame) return
      frame = window.requestAnimationFrame(update)
    }

    update()
    window.addEventListener("scroll", requestUpdate, { passive: true })
    window.addEventListener("resize", requestUpdate)
    return () => {
      window.removeEventListener("scroll", requestUpdate)
      window.removeEventListener("resize", requestUpdate)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [status.kind])

  return (
    <section
      ref={sectionRef}
      className="relative border-y border-slate-900/10 bg-[#e9eee9] md:min-h-[225vh]"
      aria-labelledby="territory-story-title"
    >
      <h2 id="territory-story-title" className="sr-only">
        Lectura territorial de las provincias argentinas
      </h2>

      <div className="mx-auto grid max-w-7xl gap-5 px-5 pb-8 pt-14 sm:px-8 md:hidden">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-950">Territorio</p>
        <h3 className="font-serif text-4xl font-semibold leading-tight tracking-[-0.025em]">
          De la cifra nacional a las provincias.
        </h3>
        <p className="max-w-2xl leading-7 text-slate-600">
          Tocá una jurisdicción para fijarla. En pantallas pequeñas mostramos el país completo y preservamos el scroll natural de la página.
        </p>
      </div>

      <div className="md:sticky md:top-[5.4rem] md:h-[calc(100svh-5.4rem)]">
        <div className="relative h-[62svh] min-h-[28rem] overflow-hidden bg-slate-200 md:h-full md:min-h-0">
          <div
            ref={containerRef}
            className="absolute inset-0"
            aria-label="Mapa provincial de Argentina"
          />

          <div className="pointer-events-none absolute inset-x-0 top-0 hidden h-28 bg-gradient-to-b from-slate-950/25 to-transparent md:block" />

          <div className="absolute left-4 top-4 z-10 max-w-[19rem] rounded-2xl border border-white/55 bg-[#f7f3ea]/94 p-4 shadow-xl shadow-slate-950/10 backdrop-blur md:left-8 md:top-8 md:max-w-sm md:p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-950">
              {copy.eyebrow}
            </p>
            <h3 className="mt-2 font-serif text-2xl font-semibold leading-tight tracking-[-0.02em] text-slate-950 md:text-4xl">
              {copy.title}
            </h3>
            <p className="mt-3 hidden text-sm leading-6 text-slate-600 md:block">{copy.copy}</p>
            <div className="mt-4 hidden md:block">
              <div className="h-1 overflow-hidden rounded-full bg-slate-900/10">
                <div
                  className="h-full bg-sky-950 transition-[width] duration-150"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
              <p className="mt-2 text-[11px] text-slate-500">Seguí desplazándote para abrir la escala.</p>
            </div>
          </div>

          {status.kind === "ready" && hoveredProvince && hoveredValue !== null && (
            <div className="pointer-events-none absolute right-4 top-4 z-10 hidden rounded-xl border border-white/70 bg-white/94 px-3 py-2 text-sm shadow-lg backdrop-blur md:block">
              <span className="font-semibold">{hoveredProvince.shortName}</span>
              <span className="ml-2 tabular-nums">{formatPercent(hoveredValue)}</span>
            </div>
          )}

          {selectedProvince && selectedValue !== null && (
            <div className="absolute bottom-4 left-4 right-4 z-10 flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-white/65 bg-[#f7f3ea]/95 p-4 shadow-xl shadow-slate-950/10 backdrop-blur md:bottom-8 md:left-8 md:right-auto md:w-[22rem] md:p-5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Provincia seleccionada
                </p>
                <p className="mt-1 font-serif text-2xl font-semibold">{selectedProvince.shortName}</p>
                <p className="mt-1 text-3xl font-semibold tabular-nums">{formatPercent(selectedValue)}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Argentina {formatPercent(national)} · {(selectedValue - national) * 100 >= 0 ? "+" : ""}{((selectedValue - national) * 100).toFixed(1)} pp
                </p>
              </div>
              <button
                type="button"
                className="text-xs font-semibold text-slate-600 underline decoration-slate-300 underline-offset-4"
                onClick={() => onChange({ place: null })}
              >
                Quitar
              </button>
            </div>
          )}

          {status.kind !== "ready" && (
            <div className="absolute inset-0 grid place-items-center bg-[#e8ece8] p-8 text-center">
              <div className="max-w-xl rounded-[2rem] border border-slate-900/10 bg-[#f7f3ea]/90 p-7 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-950">
                  {status.kind === "loading" ? "Preparando mapa" : "Lectura territorial"}
                </p>
                <h3 className="mt-3 font-serif text-3xl font-semibold">El diseño no depende de ocultar sus límites.</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{status.message}</p>
                <p className="mt-4 text-xs text-slate-500">
                  transporte: {geometryTransportManifest.transport_id}/{geometryTransportManifest.status}
                </p>
              </div>
            </div>
          )}

          <div className="absolute bottom-4 right-4 z-10 hidden md:block">
            <Button onClick={onExplore}>Explorar libremente →</Button>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-4 px-5 py-8 sm:px-8 md:hidden">
        <p className="text-sm font-medium text-slate-800">
          {getPeriodLabel(state.period)} · {labels.concepts[state.concept]} · {labels.universes[state.universe]} · {labels.estimands[state.estimand]}
        </p>
        <Button className="w-fit" onClick={onExplore}>Abrir el explorador →</Button>
      </div>
    </section>
  )
}
