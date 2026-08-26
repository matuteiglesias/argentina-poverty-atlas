import {
  fixtureEstimate,
  labels,
  periods,
  type PeriodId,
} from "@/data/fixture"
import type { AtlasState } from "@/lib/atlasState"
import { formatPercent } from "@/lib/utils"

interface NationalTimelineProps {
  state: AtlasState
  onChange: (patch: Partial<AtlasState>) => void
}

const WIDTH = 760
const HEIGHT = 270
const PAD_X = 28
const PAD_Y = 34

export function NationalTimeline({ state, onChange }: NationalTimelineProps) {
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
  const rawMin = Math.min(...values.map((item) => item.value))
  const rawMax = Math.max(...values.map((item) => item.value))
  const span = Math.max(rawMax - rawMin, 0.02)
  const min = Math.max(0, rawMin - span * 0.35)
  const max = rawMax + span * 0.35
  const x = (index: number) =>
    PAD_X + (index / Math.max(values.length - 1, 1)) * (WIDTH - PAD_X * 2)
  const y = (value: number) =>
    PAD_Y + ((max - value) / Math.max(max - min, 0.001)) * (HEIGHT - PAD_Y * 2)
  const points = values.map((item, index) => ({ ...item, x: x(index), y: y(item.value) }))
  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(" ")

  return (
    <section
      className="mx-auto grid max-w-7xl gap-8 px-5 py-16 sm:px-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-center lg:py-24"
      aria-labelledby="national-series-title"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-900">
          Evolución nacional
        </p>
        <h2
          id="national-series-title"
          className="mt-3 max-w-xl font-serif text-4xl font-semibold leading-tight tracking-[-0.025em] text-slate-950 sm:text-5xl"
        >
          Una cifra necesita historia para tener contexto.
        </h2>
        <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">
          La serie conserva la misma definición de la vista actual. Elegí un período para llevar esa lectura al territorio sin cambiar de página.
        </p>
        <p className="mt-5 text-sm font-medium text-slate-800">
          {labels.concepts[state.concept]} · {labels.universes[state.universe]} · {labels.estimands[state.estimand]}
        </p>
      </div>

      <div className="min-w-0 rounded-[2rem] border border-slate-900/10 bg-white/55 p-4 shadow-sm shadow-slate-900/5 sm:p-7">
        <svg
          className="h-auto w-full overflow-visible"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label="Serie nacional por período"
        >
          {[0, 0.5, 1].map((fraction) => {
            const value = max - (max - min) * fraction
            const lineY = PAD_Y + (HEIGHT - PAD_Y * 2) * fraction
            return (
              <g key={fraction}>
                <line
                  x1={PAD_X}
                  x2={WIDTH - PAD_X}
                  y1={lineY}
                  y2={lineY}
                  stroke="currentColor"
                  className="text-slate-900/10"
                  strokeWidth="1"
                />
                <text
                  x={WIDTH - PAD_X}
                  y={lineY - 7}
                  textAnchor="end"
                  className="fill-slate-400 text-[11px]"
                >
                  {formatPercent(value)}
                </text>
              </g>
            )
          })}

          <path
            d={linePath}
            fill="none"
            stroke="currentColor"
            className="text-sky-950"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {points.map((point) => {
            const selected = point.period.id === state.period
            return (
              <g key={point.period.id}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={selected ? 9 : 5.5}
                  fill="currentColor"
                  className={selected ? "text-orange-700" : "text-sky-950"}
                  stroke="#f7f3ea"
                  strokeWidth={selected ? 5 : 3}
                />
                {selected && (
                  <text
                    x={point.x}
                    y={point.y - 18}
                    textAnchor="middle"
                    className="fill-slate-950 text-[12px] font-semibold"
                  >
                    {formatPercent(point.value)}
                  </text>
                )}
              </g>
            )
          })}
        </svg>

        <div className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-6" aria-label="Elegir período">
          {values.map(({ period, value }) => {
            const selected = period.id === state.period
            return (
              <button
                key={period.id}
                type="button"
                aria-pressed={selected}
                className={
                  selected
                    ? "rounded-xl bg-slate-950 px-2 py-2.5 text-left text-xs text-white"
                    : "rounded-xl px-2 py-2.5 text-left text-xs text-slate-600 hover:bg-white/80 hover:text-slate-950"
                }
                onClick={() => onChange({ period: period.id as PeriodId })}
              >
                <span className="block truncate font-semibold">{period.label.replace("Demo ", "")}</span>
                <span className={selected ? "mt-0.5 block text-white/65" : "mt-0.5 block text-slate-400"}>
                  {formatPercent(value)}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
