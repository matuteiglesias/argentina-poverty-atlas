import "mapbox-gl/dist/mapbox-gl.css"

import { useEffect, useRef, useState } from "react"
import { Card } from "@/components/ui/card"
import {
  geometryTransportManifest,
  isPublishedGeometryTransport,
  provinceGeometryIds,
} from "@/map/geometryTransport"

interface ProvinceMapProps {
  onSelect: (geographyId: string) => void
}

type ProofState =
  | { kind: "loading"; message: string }
  | { kind: "verified"; message: string }
  | { kind: "error"; message: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function geographyIdFromFeature(feature: unknown) {
  if (!isRecord(feature)) return ""
  const properties = isRecord(feature.properties) ? feature.properties : null
  const value = properties?.geography_id ?? feature.id
  return typeof value === "string" || typeof value === "number" ? String(value) : ""
}

export function ProvinceMap({ onSelect }: ProvinceMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [proof, setProof] = useState<ProofState>({
    kind: "loading",
    message: "Preparando transporte geográfico…",
  })

  const manifest = geometryTransportManifest
  const publishedManifest = isPublishedGeometryTransport(manifest) ? manifest : null
  const browserToken = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN?.trim()

  useEffect(() => {
    if (!publishedManifest || !browserToken || !containerRef.current) return
    const transport = publishedManifest

    let disposed = false
    let map: import("mapbox-gl").Map | null = null

    async function mountMap() {
      const mapboxgl = (await import("mapbox-gl")).default
      if (disposed || !containerRef.current) return

      mapboxgl.accessToken = browserToken
      map = new mapboxgl.Map({
        container: containerRef.current,
        style: transport.mapbox.style_url,
        center: [-64.2, -38.4],
        zoom: 3.15,
        minZoom: 2.4,
        attributionControl: true,
      })

      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right")

      map.on("load", () => {
        if (!map) return
        map.addSource("province-geometry", {
          type: "vector",
          url: `mapbox://${transport.mapbox.tileset_id}`,
          promoteId: transport.mapbox.feature_id_property,
        })
        map.addLayer({
          id: "province-proof-fill",
          type: "fill",
          source: "province-geometry",
          "source-layer": transport.mapbox.source_layer,
          paint: {
            "fill-color": "#d8cbb6",
            "fill-opacity": 0.52,
          },
        })
        map.addLayer({
          id: "province-proof-border",
          type: "line",
          source: "province-geometry",
          "source-layer": transport.mapbox.source_layer,
          paint: {
            "line-color": "#334155",
            "line-width": 0.9,
          },
        })

        map.on("click", "province-proof-fill", (event) => {
          const geographyId = geographyIdFromFeature(event.features?.[0])
          if (provinceGeometryIds.includes(geographyId)) onSelect(geographyId)
        })
        map.on("mouseenter", "province-proof-fill", () => {
          if (map) map.getCanvas().style.cursor = "pointer"
        })
        map.on("mouseleave", "province-proof-fill", () => {
          if (map) map.getCanvas().style.cursor = ""
        })
      })

      map.once("idle", () => {
        if (!map) return
        const renderedIds = new Set(
          map
            .querySourceFeatures("province-geometry", {
              sourceLayer: transport.mapbox.source_layer,
            })
            .map(geographyIdFromFeature)
            .filter(Boolean),
        )
        const expectedIds = new Set(provinceGeometryIds)
        const exactMatch =
          renderedIds.size === expectedIds.size &&
          [...expectedIds].every((id) => renderedIds.has(id))

        setProof(
          exactMatch
            ? {
                kind: "verified",
                message: "24/24 jurisdicciones verificadas por geography_id en el transporte vectorial.",
              }
            : {
                kind: "error",
                message: `El transporte cargado expuso ${renderedIds.size}/24 geography_id esperados.`,
              },
        )
      })
    }

    setProof({ kind: "loading", message: "Verificando 24 geography_id en Mapbox…" })
    void mountMap()

    return () => {
      disposed = true
      map?.remove()
    }
  }, [browserToken, onSelect, publishedManifest])

  if (!publishedManifest) {
    return (
      <Card className="p-6 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
              W3 · transporte bloqueado correctamente
            </p>
            <h2 className="mt-2 font-serif text-3xl font-semibold tracking-tight">
              Falta una Geography Release provincial gobernada
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              El atlas encontró releases exactas de radios con códigos provinciales compatibles,
              pero no una release independiente de 24 geometrías provinciales. La aplicación no
              disuelve radios ni elige un proveedor para fabricar ese padre silenciosamente.
            </p>
          </div>
          <a
            className="inline-flex min-h-10 items-center justify-center rounded-md border border-slate-900/15 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
            href={manifest.upstream_audit.blocker_issue}
            target="_blank"
            rel="noreferrer"
          >
            Ver prerequisite upstream
          </a>
        </div>
        <dl className="mt-6 grid gap-3 border-t border-slate-900/10 pt-5 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-slate-500">Upstream inspeccionado</dt>
            <dd className="mt-1 font-mono text-xs text-slate-700">{manifest.upstream_audit.commit_sha.slice(0, 12)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Identidad requerida</dt>
            <dd className="mt-1 font-medium text-slate-800">24 × geography_id</dd>
          </div>
          <div>
            <dt className="text-slate-500">Valores de pobreza en geometría</dt>
            <dd className="mt-1 font-medium text-slate-800">Ninguno</dd>
          </div>
        </dl>
      </Card>
    )
  }

  if (!browserToken) {
    return (
      <Card className="p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
          W3 · credencial pública pendiente
        </p>
        <h2 className="mt-2 font-serif text-3xl font-semibold tracking-tight">
          El transporte está publicado, pero el navegador no tiene token dedicado
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Configurá únicamente <code>VITE_MAPBOX_PUBLIC_TOKEN</code> con el token público,
          mínimo y restringido por URL del atlas. Una credencial de publicación nunca llega
          al bundle del navegador.
        </p>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-900/10 px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Geometría real · valores sintéticos separados
          </p>
          <p className="mt-1 text-sm font-medium text-slate-800">
            Mapbox Standard · {publishedManifest.mapbox.source_layer}
          </p>
        </div>
        <p
          className={
            proof.kind === "error"
              ? "text-sm font-medium text-rose-700"
              : proof.kind === "verified"
                ? "text-sm font-medium text-emerald-700"
                : "text-sm text-slate-500"
          }
          role="status"
          aria-live="polite"
        >
          {proof.message}
        </p>
      </div>
      <div ref={containerRef} className="h-[32rem] min-h-[24rem] w-full" aria-label="Mapa de las 24 jurisdicciones argentinas" />
    </Card>
  )
}
