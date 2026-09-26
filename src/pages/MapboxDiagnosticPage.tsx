import "mapbox-gl/dist/mapbox-gl.css"

import { useEffect, useMemo, useRef, useState } from "react"
import type { Map as MapboxMap, StyleSpecification } from "mapbox-gl"
import fixturesJson from "@/map/mapboxDiagnosticFixtures.generated.json"
import {
  parseDiagnosticLevel,
  tileCenter,
  vectorTileUrl,
  type DiagnosticFixture,
  type DiagnosticLevel,
} from "@/map/mapboxDiagnostics"

const MINIMAL_STYLE: StyleSpecification = {
  version: 8,
  name: "Mapbox diagnostic blank",
  sources: {},
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#eef2f7" },
    },
  ],
}

interface BrowserFetchResult {
  status: number | null
  contentType: string | null
  bytes: number | null
  sha256: string | null
  matchesServerProof: boolean | null
  error: string | null
}

interface SourceResult {
  loaded: boolean
  featureCount: number | null
  geographyIds: string[]
  errors: string[]
}

const fixtures = fixturesJson.levels as Record<DiagnosticLevel, DiagnosticFixture>

function levelLabel(level: DiagnosticLevel) {
  return level === "province_2010" ? "Provincias" : "Departamentos"
}

export function MapboxDiagnosticPage() {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const level = useMemo(() => parseDiagnosticLevel(window.location.search), [])
  const fixture = fixtures[level]
  const tile = fixture.known_nonempty_tile
  const [fetchResult, setFetchResult] = useState<BrowserFetchResult>({
    status: null,
    contentType: null,
    bytes: null,
    sha256: null,
    matchesServerProof: null,
    error: null,
  })
  const [sourceResult, setSourceResult] = useState<SourceResult>({
    loaded: false,
    featureCount: null,
    geographyIds: [],
    errors: [],
  })

  useEffect(() => {
    const token = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN?.trim()
    if (!token || !tile) {
      setFetchResult((current) => ({
        ...current,
        error: !token
          ? "Falta VITE_MAPBOX_PUBLIC_TOKEN."
          : "La evidencia server-side todavía no seleccionó un tile no vacío.",
      }))
      return
    }
    const diagnosticTile = tile

    let disposed = false
    let map: MapboxMap | null = null

    void fetch(vectorTileUrl(fixture.tileset_id, diagnosticTile, token), {
      headers: { Accept: "application/vnd.mapbox-vector-tile" },
    })
      .then(async (response) => {
        const payload = await response.arrayBuffer()
        const bytes = payload.byteLength
        const digest = await crypto.subtle.digest("SHA-256", payload)
        const sha256 = [...new Uint8Array(digest)]
          .map((value) => value.toString(16).padStart(2, "0"))
          .join("")
        if (disposed) return
        setFetchResult({
          status: response.status,
          contentType: response.headers.get("content-type"),
          bytes,
          sha256,
          matchesServerProof:
            response.ok &&
            bytes === diagnosticTile.bytes_server_proof &&
            sha256 === diagnosticTile.sha256_server_proof,
          error: response.ok ? null : `HTTP ${response.status}`,
        })
      })
      .catch((error: unknown) => {
        if (disposed) return
        setFetchResult({
          status: null,
          contentType: null,
          bytes: null,
          sha256: null,
          matchesServerProof: null,
          error: error instanceof Error ? error.message : "Fetch desconocido",
        })
      })

    async function mount() {
      const mapboxgl = (await import("mapbox-gl")).default
      if (disposed || !mapContainerRef.current) return
      mapboxgl.accessToken = token
      map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: MINIMAL_STYLE,
        center: tileCenter(diagnosticTile.z, diagnosticTile.x, diagnosticTile.y),
        zoom: diagnosticTile.z,
        minZoom: Math.max(0, diagnosticTile.z - 1),
        maxZoom: diagnosticTile.z + 2,
        attributionControl: false,
        renderWorldCopies: false,
      })

      const recordError = (message: string) => {
        if (disposed) return
        setSourceResult((current) => ({
          ...current,
          errors: [...current.errors, message].slice(-8),
        }))
      }

      map.on("error", (event) => {
        recordError(
          event.error instanceof Error ? event.error.message : "Mapbox error desconocido",
        )
      })

      map.once("load", () => {
        if (disposed || !map) return
        map.addSource("diagnostic-source", {
          type: "vector",
          url: `mapbox://${fixture.tileset_id}`,
          promoteId: "geography_id",
        })
        map.addLayer({
          id: "diagnostic-fill",
          type: "fill",
          source: "diagnostic-source",
          "source-layer": fixture.source_layer,
          paint: {
            "fill-color": "#ff00a8",
            "fill-opacity": 0.78,
            "fill-outline-color": "#111827",
          },
        })

        const inspect = () => {
          if (disposed || !map) return
          const loaded = map.isSourceLoaded("diagnostic-source")
          const features = map.querySourceFeatures("diagnostic-source", {
            sourceLayer: fixture.source_layer,
          })
          const ids = [
            ...new Set(
              features
                .map((feature) => {
                  const properties = (feature as unknown as {
                    properties?: Record<string, unknown>
                  }).properties
                  return properties?.geography_id
                })
                .filter((value): value is string => typeof value === "string"),
            ),
          ].sort()
          setSourceResult((current) => ({
            ...current,
            loaded,
            featureCount: features.length,
            geographyIds: ids,
          }))
        }

        map.on("sourcedata", (event) => {
          if (event.sourceId === "diagnostic-source") inspect()
        })
        map.on("idle", inspect)
      })
    }

    void mount().catch((error: unknown) => {
      if (disposed) return
      setSourceResult((current) => ({
        ...current,
        errors: [
          ...current.errors,
          error instanceof Error ? error.message : "Mount desconocido",
        ],
      }))
    })

    return () => {
      disposed = true
      map?.remove()
    }
  }, [fixture, tile])

  const switchLevel = (next: DiagnosticLevel) => {
    const url = new URL(window.location.href)
    url.searchParams.set("level", next)
    window.location.href = url.toString()
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-950 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-300 pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Commissioning · Mapbox
            </p>
            <h1 className="mt-1 font-serif text-3xl font-semibold">
              Browser transport diagnostic
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Esta superficie prueba un tile server-side conocido, una fuente vectorial
              mínima y un único fill sólido. No carga pobreza, feature-state, selectores
              ni el renderer productivo del Atlas.
            </p>
          </div>
          <div className="flex gap-2">
            {(["province_2010", "department_2010"] as const).map((candidate) => (
              <button
                key={candidate}
                type="button"
                className={
                  candidate === level
                    ? "rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white"
                    : "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold"
                }
                onClick={() => switchLevel(candidate)}
              >
                {levelLabel(candidate)}
              </button>
            ))}
          </div>
        </header>

        <section className="mt-5 grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <div className="grid content-start gap-4">
            <DiagnosticCard title="Contrato">
              <DiagnosticRow label="nivel" value={level} />
              <DiagnosticRow label="tileset" value={fixture.tileset_id} />
              <DiagnosticRow label="source-layer" value={fixture.source_layer} />
              <DiagnosticRow
                label="tile probado"
                value={tile ? `z${tile.z}/${tile.x}/${tile.y}` : "pendiente"}
              />
              <DiagnosticRow
                label="bytes server proof"
                value={tile ? String(tile.bytes_server_proof) : "—"}
              />
            </DiagnosticCard>

            <DiagnosticCard title="Fetch directo · token público">
              <DiagnosticRow
                label="HTTP"
                value={fetchResult.status === null ? "pendiente" : String(fetchResult.status)}
              />
              <DiagnosticRow label="content-type" value={fetchResult.contentType ?? "—"} />
              <DiagnosticRow
                label="bytes browser"
                value={fetchResult.bytes === null ? "—" : String(fetchResult.bytes)}
              />
              <DiagnosticRow label="sha256 browser" value={fetchResult.sha256 ?? "—"} />
              <DiagnosticRow
                label="match server proof"
                value={
                  fetchResult.matchesServerProof === null
                    ? "pendiente"
                    : String(fetchResult.matchesServerProof)
                }
              />
              <DiagnosticRow label="error" value={fetchResult.error ?? "ninguno"} />
            </DiagnosticCard>

            <DiagnosticCard title="Mapbox GL mínimo">
              <DiagnosticRow label="source loaded" value={String(sourceResult.loaded)} />
              <DiagnosticRow
                label="features"
                value={sourceResult.featureCount === null ? "pendiente" : String(sourceResult.featureCount)}
              />
              <DiagnosticRow
                label="geography_ids"
                value={
                  sourceResult.geographyIds.length
                    ? sourceResult.geographyIds.slice(0, 24).join(", ")
                    : "—"
                }
              />
              <DiagnosticRow
                label="errors"
                value={sourceResult.errors.length ? sourceResult.errors.join(" | ") : "ninguno"}
              />
            </DiagnosticCard>
          </div>

          <div>
            <div
              ref={mapContainerRef}
              className="h-[42rem] overflow-hidden rounded-2xl border border-slate-300 bg-slate-200"
              aria-label="Mapa mínimo de diagnóstico Mapbox"
            />
            <p className="mt-2 text-xs text-slate-500">
              Resultado visual esperado: polígonos fucsia con borde oscuro. Cualquier
              basemap, pobreza o interacción adicional está deliberadamente ausente.
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}

function DiagnosticCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold">{title}</h2>
      <dl className="mt-3 grid gap-2 text-xs">{children}</dl>
    </section>
  )
}

function DiagnosticRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <dt className="font-semibold text-slate-500">{label}</dt>
      <dd className="break-all font-mono text-slate-900">{value}</dd>
    </div>
  )
}
