import type { CSSProperties } from "react"
import { Card } from "@/components/ui/card"
import {
  fixtureEstimate,
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

export function TimelinePlaceholder({ state }: StateProps) {
  const values = periods.map((period) => ({
    period,
    value: fixtureEstimate(
      "ARG",
      period.id,
      state.universe,
      state.concept,
      state.estimand,
    ),
  }))
  const max = Math.max(...values.map((item) => item.value))

  return (
    <Card className="overflow-hidden p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Serie nacional
          </p>
          <h2 className="mt-1 font-serif text-2xl font-semibold">
            Evolución sintética
          </h2>
        </div>
        <span className="text-xs text-slate-500">W1 · vista estructural</span>
      </div>

      <div
        className="mt-7 flex h-36 items-end gap-2 sm:gap-3"
        aria-label="Serie temporal nacional sintética"
      >
        {values.map(({ period, value }) => (
          <div
            className="group flex min-w-0 flex-1 flex-col items-center gap-2"
            key={period.id}
          >
            <span className="text-[11px] font-medium text-slate-500 opacity-0 transition-opacity group-hover:opacity-100">
              {formatPercent(value)}
            </span>
            <div
              className="w-full rounded-t-lg bg-sky-900/75"
              style={{ height: `${Math.max(18, (value / max) * 100)}%` }}
              title={`${period.label}: ${formatPercent(value)}`}
            />
            <span className="hidden text-[10px] text-slate-500 sm:block">
              {period.label.replace("Demo ", "")}
            </span>
          </div>
        ))}
      </div>
    </Card>
  )
}

interface TerritoryProps extends StateProps {
  onSelect: (id: string) => void
}

export function TerritoryPlaceholder({ state, onSelect }: TerritoryProps) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-col gap-2 border-b border-slate-900/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Territorio
          </p>
          <h2 className="mt-1 font-serif text-2xl font-semibold">
            Vista provincial provisional
          </h2>
        </div>
        <p className="max-w-md text-sm text-slate-600">
          Sin geometría ni Mapbox en W1. Cada celda conserva el ID provincial que
          usará el join exacto en las ondas posteriores.
        </p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {provinces.map((province) => {
          const value = fixtureEstimate(
            province.id,
            state.period,
            state.universe,
            state.concept,
            state.estimand,
          )
          const selected = state.place === province.id
          return (
            <button
              key={province.id}
              className="atlas-territory-cell min-h-24 rounded-2xl border border-slate-900/10 p-3 text-left transition hover:-translate-y-0.5 hover:border-slate-900/30"
              style={
                {
                  "--atlas-value": value,
                } as CSSProperties
              }
              aria-pressed={selected}
              onClick={() => onSelect(province.id)}
            >
              <span className="block text-xs font-semibold text-slate-500">
                {province.id}
              </span>
              <span className="mt-2 block text-sm font-semibold text-slate-950">
                {province.shortName}
              </span>
              <span className="mt-1 block text-lg font-semibold text-sky-950">
                {formatPercent(value)}
              </span>
            </button>
          )
        })}
      </div>
    </Card>
  )
}

interface ProvinceTableProps extends StateProps {
  onSelect: (id: string) => void
}

export function ProvinceTable({ state, onSelect }: ProvinceTableProps) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-slate-900/10 p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          Alternativa accesible
        </p>
        <h2 className="mt-1 font-serif text-2xl font-semibold">
          Valores por jurisdicción
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          La misma selección territorial debe poder recorrerse sin depender de un
          mapa o del color.
        </p>
      </div>
      <div className="max-h-[32rem] overflow-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="sticky top-0 bg-[#fcfaf5] text-xs uppercase tracking-[0.1em] text-slate-500">
            <tr>
              <th className="px-5 py-3 font-semibold">ID</th>
              <th className="px-5 py-3 font-semibold">Jurisdicción</th>
              <th className="px-5 py-3 text-right font-semibold">Valor</th>
            </tr>
          </thead>
          <tbody>
            {provinces.map((province) => {
              const value = fixtureEstimate(
                province.id,
                state.period,
                state.universe,
                state.concept,
                state.estimand,
              )
              return (
                <tr
                  key={province.id}
                  className="border-t border-slate-900/10 hover:bg-slate-50"
                >
                  <td className="px-5 py-3 font-mono text-xs text-slate-500">
                    {province.id}
                  </td>
                  <td className="px-5 py-3">
                    <button
                      className="font-medium text-slate-950 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-800"
                      onClick={() => onSelect(province.id)}
                    >
                      {province.name}
                    </button>
                  </td>
                  <td className="px-5 py-3 text-right font-semibold">
                    {formatPercent(value)}
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

export function DetailSheet({ state, onClose }: DetailSheetProps) {
  const province = getProvince(state.place)
  if (!province) return null

  const incidence = fixtureEstimate(
    province.id,
    state.period,
    state.universe,
    state.concept,
    "fgt0",
  )
  const gap = fixtureEstimate(
    province.id,
    state.period,
    state.universe,
    state.concept,
    "fgt1",
  )
  const severity = fixtureEstimate(
    province.id,
    state.period,
    state.universe,
    state.concept,
    "fgt2",
  )
  const current = fixtureEstimate(
    province.id,
    state.period,
    state.universe,
    state.concept,
    state.estimand,
  )
  const national = fixtureEstimate(
    "ARG",
    state.period,
    state.universe,
    state.concept,
    state.estimand,
  )

  return (
    <aside
      className="fixed inset-x-3 bottom-3 z-30 max-h-[78vh] overflow-auto rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-2xl shadow-slate-950/15 sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[25rem] sm:p-6"
      aria-label={`Detalle de ${province.name}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Provincia · {province.id}
          </span>
          <h2 className="mt-1 font-serif text-3xl font-semibold">
            {province.shortName}
          </h2>
        </div>
        <button
          className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          onClick={onClose}
          aria-label="Cerrar detalle"
        >
          Cerrar
        </button>
      </div>

      <div className="mt-7">
        <p className="text-5xl font-semibold tracking-[-0.04em]">
          {formatPercent(current)}
        </p>
        <p className="mt-2 text-sm font-medium text-slate-700">
          {labels.concepts[state.concept]} · {labels.universes[state.universe]} ·{" "}
          {labels.estimands[state.estimand]}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          {getPeriodLabel(state.period)} · dato sintético
        </p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 border-y border-slate-900/10 py-5 text-sm">
        <div>
          <span className="block text-slate-500">Argentina</span>
          <strong className="mt-1 block text-lg">{formatPercent(national)}</strong>
        </div>
        <div>
          <span className="block text-slate-500">Incidencia</span>
          <strong className="mt-1 block text-lg">{formatPercent(incidence)}</strong>
        </div>
        <div>
          <span className="block text-slate-500">Brecha</span>
          <strong className="mt-1 block text-lg">{formatPercent(gap)}</strong>
        </div>
        <div>
          <span className="block text-slate-500">Severidad</span>
          <strong className="mt-1 block text-lg">{formatPercent(severity)}</strong>
        </div>
      </div>

      <dl className="mt-5 grid gap-3 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">Calidad</dt>
          <dd className="font-medium">fixture</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">Incertidumbre</dt>
          <dd className="font-medium">no provista</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">Geografía</dt>
          <dd className="font-mono text-xs">province_2010/{province.id}</dd>
        </div>
      </dl>
    </aside>
  )
}
