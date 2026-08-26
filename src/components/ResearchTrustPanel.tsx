import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  fixtureRelease,
  getPeriodLabel,
  getProvince,
  labels,
} from "@/data/fixture"
import type { AtlasState } from "@/lib/atlasState"
import { geometryTransportManifest } from "@/map/geometryTransport"

interface ResearchTrustPanelProps {
  state: AtlasState
  compact?: boolean
}

function humanizeKey(value: string) {
  return value.replaceAll("_", " ")
}

export function ResearchTrustPanel({ state, compact = false }: ResearchTrustPanelProps) {
  const [copied, setCopied] = useState<"citation" | "url" | null>(null)
  const selected = getProvince(state.place)
  const releaseId = fixtureRelease.metadata.release_id
  const citation = useMemo(() => {
    const place = selected ? selected.name : "Argentina"
    return [
      "Atlas de pobreza en Argentina",
      `release ${releaseId}`,
      `${place}, ${getPeriodLabel(state.period)}`,
      `${labels.concepts[state.concept]}, ${labels.universes[state.universe]}, ${labels.estimands[state.estimand]}`,
      "datos sintéticos de demostración; no interpretar como estimación real u oficial",
    ].join(". ")
  }, [releaseId, selected, state.concept, state.estimand, state.period, state.universe])

  async function copy(kind: "citation" | "url", value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(kind)
      window.setTimeout(() => setCopied((current) => (current === kind ? null : current)), 1800)
    } catch {
      setCopied(null)
    }
  }

  const content = (
    <div className="grid gap-5">
      <div className={compact ? "grid gap-3" : "grid gap-5 lg:grid-cols-3"}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-950">Estado científico</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            <strong className="font-semibold text-slate-900">Datos sintéticos.</strong> La estructura reproduce el contrato del atlas, pero los valores no deben interpretarse como pobreza observada o estimada.
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-950">Incertidumbre</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            No provista en este release. El atlas no fabrica intervalos, errores estándar ni precisión visual cuando el productor no los entrega.
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-950">Geografía</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            La geometría y los hechos tienen ciclos independientes y se unen por <code className="font-mono text-xs">geography_id</code>. Estado del transporte: <strong>{geometryTransportManifest.status}</strong>.
          </p>
        </div>
      </div>

      <div className="grid gap-3 border-t border-slate-900/10 pt-5 sm:grid-cols-2 lg:grid-cols-4">
        <a
          className="rounded-xl border border-slate-900/10 bg-white/65 px-4 py-3 text-sm font-semibold text-slate-800 hover:border-slate-900/25 hover:bg-white"
          href={`/data/releases/${releaseId}/facts.json`}
          download
        >
          Descargar datos JSON
          <span className="mt-1 block text-xs font-normal text-slate-500">Hechos del release</span>
        </a>
        <a
          className="rounded-xl border border-slate-900/10 bg-white/65 px-4 py-3 text-sm font-semibold text-slate-800 hover:border-slate-900/25 hover:bg-white"
          href={`/data/releases/${releaseId}/metadata.json`}
          target="_blank"
          rel="noreferrer"
        >
          Ver metadata
          <span className="mt-1 block text-xs font-normal text-slate-500">Semántica y padres</span>
        </a>
        <Button
          variant="secondary"
          className="h-auto min-h-14 justify-start px-4 py-3 text-left"
          onClick={() => void copy("citation", citation)}
        >
          <span>
            {copied === "citation" ? "Cita copiada" : "Copiar cita"}
            <span className="mt-1 block text-xs font-normal text-slate-500">Cita la vista y el release</span>
          </span>
        </Button>
        <Button
          variant="secondary"
          className="h-auto min-h-14 justify-start px-4 py-3 text-left"
          onClick={() => void copy("url", window.location.href)}
        >
          <span>
            {copied === "url" ? "Enlace copiado" : "Copiar enlace"}
            <span className="mt-1 block text-xs font-normal text-slate-500">La URL conserva la selección</span>
          </span>
        </Button>
      </div>

      <details className="group border-t border-slate-900/10 pt-5">
        <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900 marker:hidden">
          <span className="inline-flex items-center gap-2">
            <span className="text-lg leading-none transition-transform group-open:rotate-45" aria-hidden="true">+</span>
            Metodología y linaje técnico
          </span>
        </summary>
        <div className="mt-5 grid gap-6 rounded-2xl bg-slate-950/[0.035] p-5 text-sm leading-6 text-slate-600 lg:grid-cols-2">
          <div>
            <h3 className="font-semibold text-slate-900">Release de datos</h3>
            <dl className="mt-3 grid gap-2">
              <div><dt className="inline text-slate-500">ID: </dt><dd className="inline break-all font-mono text-xs text-slate-800">{releaseId}</dd></div>
              <div><dt className="inline text-slate-500">schema: </dt><dd className="inline font-mono text-xs text-slate-800">{fixtureRelease.metadata.schema_version}</dd></div>
              <div><dt className="inline text-slate-500">nivel: </dt><dd className="inline font-mono text-xs text-slate-800">{fixtureRelease.metadata.geography_level}</dd></div>
              <div><dt className="inline text-slate-500">not_for_interpretation: </dt><dd className="inline font-mono text-xs text-slate-800">{String(fixtureRelease.metadata.not_for_interpretation)}</dd></div>
            </dl>
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Padres declarados</h3>
            <dl className="mt-3 grid gap-2">
              {Object.entries(fixtureRelease.metadata.parents).map(([key, value]) => (
                <div key={key}>
                  <dt className="text-xs uppercase tracking-[0.08em] text-slate-500">{humanizeKey(key)}</dt>
                  <dd className="break-all font-mono text-xs text-slate-800">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Comparabilidad</h3>
            <dl className="mt-3 grid gap-2">
              {Object.entries(fixtureRelease.metadata.comparability).map(([key, value]) => (
                <div key={key}>
                  <dt className="inline text-slate-500">{humanizeKey(key)}: </dt>
                  <dd className="inline text-slate-800">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Transporte cartográfico</h3>
            <dl className="mt-3 grid gap-2">
              <div><dt className="inline text-slate-500">transport_id: </dt><dd className="inline font-mono text-xs text-slate-800">{geometryTransportManifest.transport_id}</dd></div>
              <div><dt className="inline text-slate-500">status: </dt><dd className="inline font-mono text-xs text-slate-800">{geometryTransportManifest.status}</dd></div>
              <div><dt className="inline text-slate-500">feature identity: </dt><dd className="inline font-mono text-xs text-slate-800">geography_id</dd></div>
              <div><dt className="inline text-slate-500">poverty in tiles: </dt><dd className="inline font-mono text-xs text-slate-800">false</dd></div>
            </dl>
          </div>
        </div>
      </details>
    </div>
  )

  if (compact) return content

  return (
    <Card className="overflow-hidden p-5 sm:p-7">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-950">Transparencia</p>
        <h2 className="mt-2 font-serif text-3xl font-semibold tracking-[-0.02em] text-slate-950">Qué estás viendo y de dónde viene.</h2>
      </div>
      {content}
    </Card>
  )
}
