import {
  DetailSheet,
  ProvinceTable,
} from "@/components/AtlasViews"
import { Selectors } from "@/components/Selectors"
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
import { MapboxChoropleth } from "@/map/MapboxChoropleth"
import { formatPercent } from "@/lib/utils"
import { geometryTransportManifest } from "@/map/geometryTransport"
import { ProvinceMap } from "@/map/ProvinceMap"

interface ExplorerPageProps {
  state: AtlasState
  onChange: (patch: Partial<AtlasState>) => void
}

export function ExplorerPage({ state, onChange }: ExplorerPageProps) {
  const national = fixtureEstimate(
    "ARG",
    state.period,
    state.universe,
    state.concept,
    state.estimand,
  )
  const selectedProvince = getProvince(state.place)

  return (
    <div className="grid gap-6">
      <section className="grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-5 lg:self-start">
          <Card className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Explorar
            </p>
            <h1 className="mt-1 font-serif text-3xl font-semibold">
              Atlas territorial
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Cambiá período o medida sin reconstruir el mapa. La selección territorial queda en la URL.
            </p>
            <div className="mt-6">
              <Selectors state={state} onChange={onChange} />
            </div>
          </Card>
        </aside>

        <div className="grid min-w-0 gap-5">
          <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Argentina · {getPeriodLabel(state.period)}
              </p>
              <p className="mt-2 text-5xl font-semibold tracking-[-0.05em]">
                {formatPercent(national)}
              </p>
              <p className="mt-1 text-sm font-medium text-slate-700">
                {labels.concepts[state.concept]} · {labels.universes[state.universe]} · {labels.estimands[state.estimand]}
              </p>
            </div>
            <div className="max-w-sm text-sm leading-6 text-slate-500 sm:text-right">
              <p>
                Dato nacional explícito del fixture; no se agrega desde provincias en el navegador.
              </p>
              {selectedProvince && (
                <p className="mt-2 font-medium text-slate-700">
                  Seleccionado: {selectedProvince.shortName}
                </p>
              )}
            </div>
          </Card>

          <div className="grid min-w-0 gap-5 2xl:grid-cols-[minmax(0,1fr)_22rem] 2xl:items-start">
            <MapboxChoropleth
              state={state}
              onSelect={(place) => onChange({ place })}
            />
            <div className="2xl:sticky 2xl:top-5">
              <DetailSheet state={state} onClose={() => onChange({ place: null })} />
            </div>
          </div>

          <ProvinceTable
            state={state}
            onSelect={(place) => onChange({ place })}
          />
        </div>
      </section>

      <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-900/10 pt-5 text-xs text-slate-500">
        <span>release: {fixtureRelease.metadata.release_id}</span>
        <span>scientific_status: {fixtureRelease.metadata.scientific_status}</span>
        <span>not_for_interpretation: {String(fixtureRelease.metadata.not_for_interpretation)}</span>
        <span>uncertainty: not_supplied</span>
        <span>geometry: {geometryTransportManifest.transport_id}/{geometryTransportManifest.status}</span>
      </div>
    </div>
  )
}
