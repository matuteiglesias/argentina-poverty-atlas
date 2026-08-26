import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Selectors } from "@/components/Selectors"
import { TimelinePlaceholder } from "@/components/AtlasViews"
import {
  fixtureEstimate,
  getPeriodLabel,
  labels,
} from "@/data/fixture"
import type { AtlasState } from "@/lib/atlasState"
import { formatPercent } from "@/lib/utils"

interface HomePageProps {
  state: AtlasState
  onChange: (patch: Partial<AtlasState>) => void
  onExplore: () => void
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

  return (
    <div className="grid gap-10">
      <section className="grid min-h-[31rem] items-center gap-8 py-4 lg:grid-cols-[1.25fr_0.75fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-900">
            Atlas territorial · investigación
          </p>
          <h1 className="mt-5 max-w-3xl font-serif text-5xl font-semibold leading-[0.98] tracking-[-0.035em] text-slate-950 sm:text-6xl lg:text-7xl">
            Pobreza e indigencia en Argentina, para explorar con contexto.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            Una superficie pública pensada para leer la magnitud, el cambio
            temporal, las diferencias territoriales y la procedencia de cada
            estimación.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button onClick={onExplore}>Explorar el territorio</Button>
            <span className="self-center text-sm text-slate-500">
              Esta versión usa únicamente datos sintéticos.
            </span>
          </div>
        </div>

        <Card className="p-6 sm:p-8">
          <div className="h-1 w-20 rounded-full atlas-rule" />
          <p className="mt-7 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Argentina · {getPeriodLabel(state.period)}
          </p>
          <p className="mt-3 text-7xl font-semibold tracking-[-0.06em] text-slate-950">
            {formatPercent(headline)}
          </p>
          <p className="mt-3 text-base font-semibold text-slate-800">
            {labels.concepts[state.concept]} · {labels.universes[state.universe]} ·{" "}
            {labels.estimands[state.estimand]}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Modelo de demostración · no oficial
          </p>

          <dl className="mt-8 grid grid-cols-2 gap-5 border-t border-slate-900/10 pt-5">
            <div>
              <dt className="text-sm text-slate-500">Indigencia</dt>
              <dd className="mt-1 text-2xl font-semibold">
                {formatPercent(indigence)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Brecha</dt>
              <dd className="mt-1 text-2xl font-semibold">
                {formatPercent(gap)}
              </dd>
            </div>
          </dl>
        </Card>
      </section>

      <section aria-labelledby="quick-controls-title">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Leer otra vista
            </p>
            <h2 id="quick-controls-title" className="mt-1 font-serif text-3xl font-semibold">
              Controles públicos
            </h2>
          </div>
          <p className="hidden max-w-md text-sm text-slate-500 md:block">
            La URL conserva período, universo, concepto y estimando para que la
            vista sea compartible.
          </p>
        </div>
        <Card className="p-5 sm:p-6">
          <Selectors state={state} onChange={onChange} compact />
        </Card>
      </section>

      <TimelinePlaceholder state={state} />

      <section className="grid gap-4 border-t border-slate-900/10 pt-8 md:grid-cols-3">
        {[
          ["Qué muestra", "Estimaciones territoriales con identidad científica explícita."],
          ["Qué no hace", "El atlas no calcula pobreza, no entrena modelos y no corrige geografía."],
          ["Qué sigue", "La geometría gobernada y el join exacto llegan en W3/W4 sin reescribir esta interfaz."],
        ].map(([title, copy]) => (
          <div key={title} className="pr-4">
            <h3 className="font-semibold text-slate-950">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p>
          </div>
        ))}
      </section>
    </div>
  )
}
