import type { ReactNode } from "react"
import {
  geographyLevelLabels,
  getPeriodsForLevel,
  releaseRegistry,
} from "@/data/releaseRegistry"
import type { AtlasState } from "@/lib/atlasState"

interface SelectorProps {
  state: AtlasState
  onChange: (patch: Partial<AtlasState>) => void
  compact?: boolean
}

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-slate-700">
      <span>{label}</span>
      {children}
    </label>
  )
}

const selectClass =
  "min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-950"

export function Selectors({ state, onChange, compact = false }: SelectorProps) {
  const periods = getPeriodsForLevel(state.level)

  return (
    <div
      className={
        compact
          ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
          : "grid gap-4"
      }
      aria-label="Controles del atlas"
    >
      <Field label="Nivel">
        <select
          className={selectClass}
          value={state.level}
          onChange={(event) =>
            onChange({
              level: event.target.value as AtlasState["level"],
            })
          }
        >
          {releaseRegistry.availableLevels.map((level) => (
            <option key={level} value={level}>
              {geographyLevelLabels[level]}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Período">
        <select
          className={selectClass}
          value={state.period}
          onChange={(event) => onChange({ period: event.target.value })}
        >
          {periods.map((period) => (
            <option key={period.id} value={period.id}>
              {period.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Universo">
        <select
          className={selectClass}
          value={state.universe}
          onChange={(event) =>
            onChange({
              universe: event.target.value as AtlasState["universe"],
            })
          }
        >
          <option value="persons">Personas</option>
          <option value="households">Hogares</option>
        </select>
      </Field>

      <Field label="Concepto">
        <select
          className={selectClass}
          value={state.concept}
          onChange={(event) =>
            onChange({ concept: event.target.value as AtlasState["concept"] })
          }
        >
          <option value="poverty">Pobreza</option>
          <option value="indigence">Indigencia</option>
        </select>
      </Field>

      <Field label="Estimando">
        <select
          className={selectClass}
          value={state.estimand}
          onChange={(event) =>
            onChange({ estimand: event.target.value as AtlasState["estimand"] })
          }
        >
          <option value="fgt0">Incidencia</option>
          <option value="fgt1">Brecha</option>
          <option value="fgt2">Severidad</option>
        </select>
      </Field>
    </div>
  )
}
