import { useMemo, useState } from "react"
import {
  geographyLevelLabels,
  getGeographiesForLevel,
} from "@/data/releaseRegistry"
import type { AtlasState } from "@/lib/atlasState"

interface GeographyLookupProps {
  state: AtlasState
  onSelect: (place: string | null) => void
  compact?: boolean
}

export function GeographyLookup({
  state,
  onSelect,
  compact = false,
}: GeographyLookupProps) {
  const geographies = getGeographiesForLevel(state.level)
  const [provinceFilter, setProvinceFilter] = useState("")
  const [query, setQuery] = useState("")

  const provinceOptions = useMemo(() => {
    if (state.level !== "department_2010") return []
    const byId = new Map<string, string>()
    for (const geography of geographies) {
      const provinceId = geography.provinceId ?? geography.id.slice(0, 2)
      const provinceName = geography.provinceName ?? provinceId
      byId.set(provinceId, provinceName)
    }
    return [...byId].sort((a, b) => a[0].localeCompare(b[0]))
  }, [geographies, state.level])

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("es")
    return geographies.filter((geography) => {
      const provinceId = geography.provinceId ?? geography.id.slice(0, 2)
      if (
        state.level === "department_2010" &&
        provinceFilter &&
        provinceId !== provinceFilter
      ) {
        return false
      }
      if (!needle) return true
      return (
        geography.id.includes(needle) ||
        geography.name.toLocaleLowerCase("es").includes(needle) ||
        geography.shortName.toLocaleLowerCase("es").includes(needle)
      )
    })
  }, [geographies, provinceFilter, query, state.level])

  const selected = state.place
    ? geographies.find((geography) => geography.id === state.place) ?? null
    : null

  return (
    <div
      className={
        compact
          ? "grid gap-2 text-xs font-medium text-slate-600"
          : "grid gap-3 text-sm font-medium text-slate-700"
      }
    >
      <span>
        Ir a {state.level === "department_2010" ? "un departamento" : "una jurisdicción"}
      </span>

      {state.level === "department_2010" && (
        <label className="grid gap-1.5">
          <span className="text-xs font-normal text-slate-500">Provincia</span>
          <select
            className="min-h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-950"
            value={provinceFilter}
            onChange={(event) => {
              setProvinceFilter(event.target.value)
              setQuery("")
            }}
          >
            <option value="">Todas las provincias</option>
            {provinceOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name} · {id}
              </option>
            ))}
          </select>
        </label>
      )}

      {state.level === "department_2010" && (
        <label className="grid gap-1.5">
          <span className="text-xs font-normal text-slate-500">Buscar</span>
          <input
            className="min-h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-950"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nombre o código"
            type="search"
          />
        </label>
      )}

      <select
        className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-950"
        value={selected?.id ?? ""}
        onChange={(event) => onSelect(event.target.value || null)}
        aria-label={`Seleccionar ${geographyLevelLabels[state.level]}`}
      >
        <option value="">
          Argentina · sin selección {state.level === "department_2010" ? "departamental" : "provincial"}
        </option>
        {visible.map((geography) => (
          <option key={geography.id} value={geography.id}>
            {geography.shortName} · {geography.id}
          </option>
        ))}
      </select>

      {!compact && (
        <span className="text-xs font-normal leading-5 text-slate-500">
          {state.level === "department_2010"
            ? `${visible.length} de ${geographies.length} departamentos visibles. Filtrá por provincia o buscá por nombre/código.`
            : "Alternativa al mapa: funciona con teclado y actualiza la misma selección compartible."}
        </span>
      )}
    </div>
  )
}
