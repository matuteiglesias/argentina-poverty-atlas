import { provinces } from "@/data/fixture"
import type { AtlasState } from "@/lib/atlasState"

interface ProvinceLookupProps {
  state: AtlasState
  onSelect: (place: string | null) => void
  compact?: boolean
}

export function ProvinceLookup({ state, onSelect, compact = false }: ProvinceLookupProps) {
  return (
    <label className={compact ? "grid gap-1.5 text-xs font-medium text-slate-600" : "grid gap-2 text-sm font-medium text-slate-700"}>
      <span>Ir a una jurisdicción</span>
      <select
        className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-950"
        value={state.place ?? ""}
        onChange={(event) => onSelect(event.target.value || null)}
      >
        <option value="">Argentina · sin selección provincial</option>
        {provinces.map((province) => (
          <option key={province.id} value={province.id}>
            {province.shortName} · {province.id}
          </option>
        ))}
      </select>
      {!compact && (
        <span className="text-xs font-normal leading-5 text-slate-500">
          Alternativa al mapa: funciona con teclado y actualiza la misma selección compartible.
        </span>
      )}
    </label>
  )
}
