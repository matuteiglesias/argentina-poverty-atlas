import { DetailSheet, ProvinceTable } from "@/components/AtlasViews"
import { ProvinceLookup } from "@/components/ProvinceLookup"
import { ResearchTrustPanel } from "@/components/ResearchTrustPanel"
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
import { formatPercent } from "@/lib/utils"
import { geometryTransportManifest } from "@/map/geometryTransport"
import { MapboxChoropleth } from "@/map/MapboxChoropleth"

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
    <div className="mx-auto max-w-[96rem] px-4 py-6 sm:px-8 sm:py-9">
      <header className="mb-7 flex flex-col gap-5 border-b border-slate-900/10 pb-7 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-950">Exploración libre</p>
          <h1 className="mt-2 font-serif text-4xl font-semibold tracking-[-0.025em] text-slate-950 sm:text-5xl">
            Atlas territorial
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
            Cambiá una dimensión, navegá el mapa o elegí una jurisdicción con teclado. Período, medida y territorio quedan codificados en la URL.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 lg:justify-end">
          <span>{fixtureRelease.metadata.scientific_status}</span>
          <span>release {fixtureRelease.metadata.release_id}</span>
          <span>geografía {geometryTransportManifest.status}</span>
        </div>
      </header>

      <section className="grid gap-5 xl:grid-cols-[17rem_minmax(0,1fr)] 2xl:grid-cols-[17rem_minmax(0,1fr)_22rem] 2xl:items-start">
        <aside className="grid gap-4 xl:sticky xl:top-[6.5rem] xl:self-start">
          <Card className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Medida</p>
            <div className="mt-5">
              <Selectors state={state} onChange={onChange} />
            </div>
          </Card>
          <Card className="p-5">
            <ProvinceLookup
              state={state}
              onSelect={(place) => onChange({ place })}
            />
          </Card>
          <div className="hidden rounded-2xl border border-slate-900/10 bg-white/35 p-4 text-xs leading-5 text-slate-500 xl:block">
            <strong className="text-slate-800">Interacción del mapa.</strong> Arrastrá para moverte y usá los controles de zoom. La rueda de la página no queda atrapada por el mapa.
          </div>
        </aside>

        <div className="grid min-w-0 gap-5">
          <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Argentina · {getPeriodLabel(state.period)}
              </p>
              <p className="mt-2 text-5xl font-semibold tracking-[-0.05em] tabular-nums sm:text-6xl">
                {formatPercent(national)}
              </p>
              <p className="mt-2 text-sm font-medium text-slate-700">
                {labels.concepts[state.concept]} · {labels.universes[state.universe]} · {labels.estimands[state.estimand]}
              </p>
            </div>
            <div className="max-w-sm text-sm leading-6 text-slate-500 sm:text-right">
              <p>Dato nacional explícito del release; no se agrega desde provincias en el navegador.</p>
              {selectedProvince && (
                <p className="mt-2 font-semibold text-slate-800">Seleccionado: {selectedProvince.name}</p>
              )}
            </div>
          </Card>

          <MapboxChoropleth
            state={state}
            onSelect={(place) => onChange({ place })}
          />

          <div className="2xl:hidden">
            <DetailSheet state={state} onClose={() => onChange({ place: null })} />
          </div>

          <ProvinceTable
            state={state}
            onSelect={(place) => onChange({ place })}
          />
        </div>

        <aside className="hidden 2xl:sticky 2xl:top-[6.5rem] 2xl:grid 2xl:gap-4">
          <DetailSheet state={state} onClose={() => onChange({ place: null })} />
        </aside>
      </section>

      <section className="mt-7">
        <ResearchTrustPanel state={state} />
      </section>
    </div>
  )
}
