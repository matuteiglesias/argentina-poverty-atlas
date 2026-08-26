import { useEffect, useMemo, useState } from "react"
import {
  concepts,
  estimands,
  periods,
  provinces,
  universes,
  type Concept,
  type Estimand,
  type PeriodId,
  type Universe,
} from "@/data/fixture"

export type AtlasRoute = "/" | "/explorar"

export interface AtlasState {
  period: PeriodId
  universe: Universe
  concept: Concept
  estimand: Estimand
  place: string | null
}

export const defaultAtlasState: AtlasState = {
  period: periods.at(-1)!.id,
  universe: "persons",
  concept: "poverty",
  estimand: "fgt0",
  place: null,
}

const periodIds = new Set(periods.map((period) => period.id))
const provinceIds = new Set(provinces.map((province) => province.id))

function oneOf<T extends string>(
  value: string | null,
  allowed: readonly T[],
  fallback: T,
): T {
  return value && allowed.includes(value as T) ? (value as T) : fallback
}

export function parseAtlasState(search: string): AtlasState {
  const params = new URLSearchParams(search)

  return {
    period: periodIds.has(params.get("period") as PeriodId)
      ? (params.get("period") as PeriodId)
      : defaultAtlasState.period,
    universe: oneOf(
      params.get("universe"),
      universes,
      defaultAtlasState.universe,
    ),
    concept: oneOf(params.get("concept"), concepts, defaultAtlasState.concept),
    estimand: oneOf(
      params.get("estimand"),
      estimands,
      defaultAtlasState.estimand,
    ),
    place: provinceIds.has(params.get("place") ?? "")
      ? params.get("place")
      : null,
  }
}

export function serializeAtlasState(state: AtlasState) {
  const params = new URLSearchParams()
  params.set("period", state.period)
  params.set("universe", state.universe)
  params.set("concept", state.concept)
  params.set("estimand", state.estimand)
  if (state.place) params.set("place", state.place)
  return params.toString()
}

export function normalizeRoute(pathname: string): AtlasRoute {
  return pathname === "/explorar" ? "/explorar" : "/"
}

export function buildAtlasHref(route: AtlasRoute, state: AtlasState) {
  return `${route}?${serializeAtlasState(state)}`
}

export function useAtlasNavigation() {
  const readLocation = () => ({
    route: normalizeRoute(window.location.pathname),
    state: parseAtlasState(window.location.search),
  })

  const [location, setLocation] = useState(readLocation)

  useEffect(() => {
    const onPopState = () => setLocation(readLocation())
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  return useMemo(
    () => ({
      ...location,
      navigate(route: AtlasRoute, nextState = location.state) {
        const href = buildAtlasHref(route, nextState)
        window.history.pushState({}, "", href)
        setLocation({ route, state: nextState })
      },
      updateState(patch: Partial<AtlasState>) {
        const nextState = { ...location.state, ...patch }
        const href = buildAtlasHref(location.route, nextState)
        window.history.replaceState({}, "", href)
        setLocation({ ...location, state: nextState })
      },
    }),
    [location],
  )
}
