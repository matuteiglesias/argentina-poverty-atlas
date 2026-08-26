import { Card } from "@/components/ui/card"
import {
  fixtureEstimate,
  getFact,
  getPeriodLabel,
  getProvince,
  labels,
  periods,
  provinces,
} from "@/data/fixture"
import type { AtlasState } from "@/lib/atlasState"
import { formatPercent } from "@/lib/utils"

interface StateProps {
  state: AtlasState
}

interface ProvinceTableProps extends StateProps {
  onSelect: (id: string) => void
}

export function ProvinceTable({ state, onSelect }: ProvinceTableProps) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-900/10 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-950">
            Consulta sin mapa
          </p>
          <h2 className="mt-1 font-serif text-2xl font-semibold">
            Las 24 jurisdicciones
          </h2>
        </div>
        <p className="max-w-md text-sm leading-6 text-slate-600">
          Misma medida, mismo período y misma selección que el mapa. La tabla no depende del color ni de un dispositivo apuntador.
        </p>
      </div>
      <div className="max-h-[34rem] overflow-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-[#fcfaf5] text-xs uppercase tracking-[0.1em] text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold sm:px-5">Jurisdicción</th>
              <th className="px-4 py-3 text-right font-semibold sm:px-5">Valor</th>
              <th className="hidden px-5 py-3 text-right font-semibold md:table-cell">Calidad</th>
            </tr>
          </thead>
          <tbody>
            {provinces.map((province) => {
              const fact = getFact(
                province.id,
                state.period,
                state.universe,
                state.concept,
                state.estimand,
              )
              const selected = state.place === province.id
              const warnings = fact?.warning_codes ?? []
              return (
                <tr
                  key={province.id}
                  className={
                    selected
                      ? "border-t border-slate-900/10 bg-orange-50/80"
                      : "border-t border-slate-900/10 hover:bg-white/55"
                  }
                >
                  <td className="px-4 py-3 sm:px-5">
                    <button
                      className="text-left font-medium text-slate-950 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-800"
                      onClick={() => onSelect(province.id)}
                      aria-pressed={selected}
                    >
                      {province.name}
                    </button>
                    <span className="ml-2 font-mono text-[10px] text-slate-400">{province.id}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums sm:px-5">
                    {fact ? formatPercent(fact.estimate) : "Sin dato"}
                  </td>
                  <td className="hidden px-5 py-3 text-right text-xs md:table-cell">
                    {warnings.length > 0 ? (
                      <span className="rounded-full bg-amber-100 px-2 py-1 font-medium text-amber-900">Advertencia</span>
                    ) : fact ? (
                      <span className="text-slate-500">{fact.quality_status}</span>
                    ) : (
                      <span className="text-slate-400">sin dato</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

interface DetailSheetProps extends StateProps {
  onClose: () => void
}

function formatPointDifference(value: number) {
  const points = value * 100
  return `${points >= 0 ? "+" : ""}${points.toFixed(1)} pp`
}

function ProvinceComparisonChart({ state, provinceId }: { state: AtlasState; provinceId: string }) {
  const provinceSeries = periods.map((period) =>
    fixtureEstimate(
      provinceId,
      period.id,
      state.universe,
      state.concept,
      state.estimand,
    ),
  )
  const nationalSeries = periods.map((period) =>
    fixtureEstimate(
      "ARG",
      period.id,
      state.universe,
      state.concept,
      state.estimand,
    ),
  )
  const all = [...provinceSeries, ...nationalSeries]
  const rawMin = Math.min(...all)
  const rawMax = Math.max(...all)
  const span = Math.max(rawMax - rawMin, 0.02)
  const min = Math.max(0, rawMin - span * 0.25)
  const max = rawMax + span * 0.25
  const width = 320
  const height = 112
  const pad = 8
  const x = (index: number) => pad + (index / Math.max(periods.length - 1, 1)) * (width - pad * 2)
  const y = (value: number) => pad + ((max - value) / Math.max(max - min, 0.001)) * (height - pad * 2)
  const path = (series: number[]) =>
    series.map((value, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(" ")

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Provincia vs. Argentina</p>
        <div className="flex gap-3 text-[10px] text-slate-500">
          <span className="inline-flex items-center gap-1"><span className="h-0.5 w-3 bg-orange-700" /> Provincia</span>
          <span className="inline-flex items-center gap-1"><span className="h-0.5 w-3 bg-sky-950" /> Argentina</span>
        </div>
      </div>
      <svg className="mt-3 h-auto w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Comparación temporal entre provincia y Argentina">
        <line x1={pad} x2={width - pad} y1={height - pad} y2={height - pad} stroke="currentColor" className="text-slate-900/10" />
        <path d={path(nationalSeries)} fill="none" stroke="#153b4a" strokeWidth="2.5" strokeLinecap="round" />
        <path d={path(provinceSeries)} fill="none" stroke="#c2410c" strokeWidth="3" strokeLinecap="round" />
        {provinceSeries.map((value, index) => (
          <circle key={periods[index]?.id} cx={x(index)} cy={y(value)} r={periods[index]?.id === state.period ? 4.5 : 2.5} fill="#c2410c" />
        ))}
      </svg>
    </div>
  )
}

export function DetailSheet({ state, onClose }: DetailSheetProps) {
  const province = getProvince(state.place)

  if (!province) {
    return (
      <Card className="grid min-h-56 place-items-center p-6 text-center 2xl:min-h-[30rem]">
        <div className="max-w-xs">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-950">
            Lectura provincial
          </p>
          <h2 className="mt-2 font-serif text-2xl font-semibold text-slate-900">
            Elegí una jurisdicción
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Podés usar el mapa, el selector de jurisdicciones o la tabla. Las tres superficies actualizan exactamente el mismo estado de la URL.
          </p>
        </div>
      </Card>
    )
  }

  const currentFact = getFact(
    province.id,
    state.period,
    state.universe,
    state.concept,
    state.estimand,
  )

  if (!currentFact) {
    return (
      <Card className="p-5 sm:p-6" aria-label={`Sin dato para ${province.name}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{province.name}</p>
            <h2 className="mt-2 font-serif text-3xl font-semibold">Sin dato</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              El release no contiene una estimación compatible para esta combinación. El atlas no reemplaza ausencia por cero ni imputa en el navegador.
            </p>
          </div>
          <button className="text-sm font-semibold text-slate-600" onClick={onClose}>Cerrar</button>
        </div>
      </Card>
    )
  }

  const incidence = fixtureEstimate(province.id, state.period, state.universe, state.concept, "fgt0")
  const gap = fixtureEstimate(province.id, state.period, state.universe, state.concept, "fgt1")
  const severity = fixtureEstimate(province.id, state.period, state.universe, state.concept, "fgt2")
  const national = fixtureEstimate("ARG", state.period, state.universe, state.concept, state.estimand)
  const difference = currentFact.estimate - national
  const warnings = currentFact.warning_codes ?? []

  return (
    <Card className="overflow-hidden" aria-label={`Detalle de ${province.name}`}>
      <div className="p-5 sm:p-6" aria-live="polite">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-950">
              Jurisdicción · {province.id}
            </span>
            <h2 className="mt-1 font-serif text-3xl font-semibold tracking-[-0.02em]">
              {province.shortName}
            </h2>
          </div>
          <button
            className="min-h-10 rounded-full border border-slate-200 px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            onClick={onClose}
            aria-label="Cerrar detalle"
          >
            Cerrar
          </button>
        </div>

        <div className="mt-7">
          <p className="text-5xl font-semibold tracking-[-0.04em] tabular-nums">
            {formatPercent(currentFact.estimate)}
          </p>
          <p className="mt-2 text-sm font-medium text-slate-700">
            {labels.concepts[state.concept]} · {labels.universes[state.universe]} · {labels.estimands[state.estimand]}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {getPeriodLabel(state.period)} · datos sintéticos
          </p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 border-y border-slate-900/10 py-5 text-sm">
          <div>
            <span className="block text-slate-500">Argentina</span>
            <strong className="mt-1 block text-lg tabular-nums">{formatPercent(national)}</strong>
          </div>
          <div>
            <span className="block text-slate-500">Diferencia</span>
            <strong className="mt-1 block text-lg tabular-nums">{formatPointDifference(difference)}</strong>
          </div>
        </div>

        {warnings.length > 0 && (
          <div className="mt-5 rounded-xl border border-amber-800/15 bg-amber-50 p-4 text-sm text-amber-950">
            <strong>Advertencia de calidad.</strong> {warnings.join(", ")}
          </div>
        )}

        <div className="mt-6">
          <ProvinceComparisonChart state={state} provinceId={province.id} />
        </div>

        <div className="mt-6 border-t border-slate-900/10 pt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Perfil FGT
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              ["Incidencia", incidence],
              ["Brecha", gap],
              ["Severidad", severity],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl bg-slate-950/[0.035] p-3">
                <span className="block text-[11px] text-slate-500">{label}</span>
                <strong className="mt-1 block text-base tabular-nums text-slate-900">
                  {formatPercent(Number(value))}
                </strong>
              </div>
            ))}
          </div>
        </div>

        <dl className="mt-5 grid gap-3 border-t border-slate-900/10 pt-5 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Calidad</dt>
            <dd className="font-medium">{currentFact.quality_status}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Incertidumbre</dt>
            <dd className="font-medium">{currentFact.uncertainty_status === "not_supplied" ? "no provista" : currentFact.uncertainty_status}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Join de hechos</dt>
            <dd className="font-mono text-xs">geography_id={province.id}</dd>
          </div>
        </dl>
      </div>
    </Card>
  )
}
