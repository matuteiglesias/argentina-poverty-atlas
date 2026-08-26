import { NationalTimeline } from "@/components/NationalTimeline"
import { ResearchTrustPanel } from "@/components/ResearchTrustPanel"
import { Selectors } from "@/components/Selectors"
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
import { EditorialTerritoryStory } from "@/map/EditorialTerritoryStory"

interface HomePageProps {
  state: AtlasState
  onChange: (patch: Partial<AtlasState>) => void
  onExplore: () => void
}

function formatPointDifference(value: number) {
  const points = value * 100
  return `${points >= 0 ? "+" : ""}${points.toFixed(1)} pp`
}

export function HomePage({ state, onChange, onExplore }: HomePageProps) {
  const headline = fixtureEstimate(
    "ARG",
    state.period,
    state.universe,
    state.concept,
    state.estimand,
  )
  const indigence = fixtureEstimate(
    "ARG",
    state.period,
    state.universe,
    "indigence",
    "fgt0",
  )
  const gap = fixtureEstimate(
    "ARG",
    state.period,
    state.universe,
    "poverty",
    "fgt1",
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

  return (
    <div className="overflow-clip">
      <section className="mx-auto grid min-h-[calc(100svh-8rem)] max-w-7xl items-center gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[1.12fr_0.88fr] lg:py-24">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-950">
            Atlas territorial · investigación
          </p>
          <h1 className="mt-5 max-w-4xl font-serif text-5xl font-semibold leading-[0.95] tracking-[-0.045em] text-slate-950 sm:text-6xl lg:text-[5.6rem]">
            Pobreza en Argentina, para leerla en el tiempo y en el territorio.
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-600">
            Una publicación interactiva para pasar de la cifra nacional a las diferencias provinciales sin perder de vista qué se mide, de dónde viene cada dato y cuáles son sus límites.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Button onClick={onExplore}>Abrir el explorador</Button>
            <a className="text-sm font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-800" href="#serie-nacional">
              Ver la evolución ↓
            </a>
          </div>
        </div>

        <div className="relative lg:pl-8">
          <div className="absolute -inset-10 -z-10 rounded-full bg-white/55 blur-3xl" aria-hidden="true" />
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Argentina · {getPeriodLabel(state.period)}
          </p>
          <p className="mt-3 text-[6rem] font-semibold leading-none tracking-[-0.075em] text-slate-950 sm:text-[8rem] lg:text-[9rem]">
            {formatPercent(headline)}
          </p>
          <p className="mt-4 max-w-md text-base font-semibold leading-6 text-slate-800">
            {labels.concepts[state.concept]} · {labels.universes[state.universe]} · {labels.estimands[state.estimand]}
          </p>
          <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
            Valor nacional explícito del release. No se calcula agregando provincias en el navegador.
          </p>

          <dl className="mt-8 grid max-w-md grid-cols-2 gap-6 border-t border-slate-900/10 pt-5">
            <div>
              <dt className="text-xs uppercase tracking-[0.12em] text-slate-500">Indigencia</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums">{formatPercent(indigence)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.12em] text-slate-500">Brecha de pobreza</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums">{formatPercent(gap)}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="border-y border-slate-900/10 bg-white/35">
        <div className="mx-auto grid max-w-7xl gap-5 px-5 py-7 sm:px-8 lg:grid-cols-[15rem_1fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Definición de la lectura</p>
            <p className="mt-1 text-sm leading-5 text-slate-600">Cambiá una dimensión; la serie y el territorio responden a la misma vista.</p>
          </div>
          <Selectors state={state} onChange={onChange} compact />
        </div>
      </section>

      <div id="serie-nacional" className="scroll-mt-28">
        <NationalTimeline state={state} onChange={onChange} />
      </div>

      <div className="mx-auto max-w-7xl px-5 pb-10 pt-4 sm:px-8 lg:pb-16">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-950">Distribución territorial</p>
          <h2 className="mt-3 font-serif text-4xl font-semibold leading-tight tracking-[-0.03em] text-slate-950 sm:text-5xl">
            Después de la tendencia nacional, el país se abre provincia por provincia.
          </h2>
          <p className="mt-5 text-base leading-7 text-slate-600">
            La siguiente sección usa scroll como narrativa de cámara. No cambia el dato y no captura la rueda del mouse: desplazar la página sigue siendo desplazar la página.
          </p>
        </div>
      </div>

      <EditorialTerritoryStory state={state} onChange={onChange} onExplore={onExplore} />

      <section className="mx-auto grid max-w-7xl gap-8 px-5 py-16 sm:px-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-center lg:py-24">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-950">Una provincia en contexto</p>
          <h2 className="mt-3 font-serif text-4xl font-semibold leading-tight tracking-[-0.025em] text-slate-950">
            Seleccionar no termina en un tooltip.
          </h2>
          <p className="mt-4 max-w-lg leading-7 text-slate-600">
            En el explorador, cada jurisdicción conserva su comparación con Argentina, su trayectoria temporal, el perfil FGT y sus señales de calidad.
          </p>
          <Button className="mt-6" variant="secondary" onClick={onExplore}>Ver detalle provincial →</Button>
        </div>

        <div className="rounded-[2rem] border border-slate-900/10 bg-white/55 p-6 sm:p-8">
          {selectedProvince && selectedValue !== null ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Selección actual · {selectedProvince.id}</p>
              <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h3 className="font-serif text-3xl font-semibold">{selectedProvince.name}</h3>
                  <p className="mt-2 text-6xl font-semibold tracking-[-0.055em] tabular-nums">{formatPercent(selectedValue)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">Diferencia con Argentina</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">{formatPointDifference(selectedValue - headline)}</p>
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Sin selección provincial</p>
              <h3 className="mt-3 font-serif text-3xl font-semibold">El mapa y la tabla comparten una sola selección.</h3>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
                Elegí una provincia en el mapa editorial o entrá al explorador. El identificador queda en la URL para que la vista pueda compartirse y recuperarse.
              </p>
            </>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-4 sm:px-8">
        <ResearchTrustPanel state={state} />
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-5 py-16 text-sm leading-6 text-slate-600 sm:px-8 md:grid-cols-3">
        <div>
          <h3 className="font-semibold text-slate-950">Qué muestra</h3>
          <p className="mt-2">Un release de estimaciones con semántica explícita de período, universo, concepto, estimando y geografía.</p>
        </div>
        <div>
          <h3 className="font-semibold text-slate-950">Qué no hace</h3>
          <p className="mt-2">El sitio no entrena modelos, no calcula líneas de pobreza, no corrige geografía y no inventa incertidumbre.</p>
        </div>
        <div>
          <h3 className="font-semibold text-slate-950">Estado de esta versión</h3>
          <p className="mt-2">{fixtureRelease.metadata.scientific_status}; <span className="font-mono text-xs">not_for_interpretation={String(fixtureRelease.metadata.not_for_interpretation)}</span>.</p>
        </div>
      </section>
    </div>
  )
}
