import { useEffect, useMemo, useState } from "react"
import {
  concepts,
  estimands,
  universes,
  type Concept,
  type Estimand,
  type GeographyLevel,
  type PeriodId,
  type Universe,
} from "@/data/release"
import {
  availableGeographyLevels,
  defaultGeographyLevel,
  getGeographiesForLevel,
  getPeriodsForLevel,
} from "@/data/releaseRegistry"

export type AtlasRoute = "/" | "/explorar"

export interface AtlasState {
  level: GeographyLevel
  period: PeriodId
  universe: Universe
  concept: Concept
  estimand: Estimand
  place: string | null
}

function latestPeriod(level: GeographyLevel): PeriodId {
  const periods = getPeriodsForLevel(level)
  const period = periods.at(-1)
  if (!period) throw new Error(`No periods available for ${level}`)
  return period.id
}

export const defaultAtlasState: AtlasState = {
  level: defaultGeographyLevel,
  period: latestPeriod(defaultGeographyLevel),
  universe: "persons",
  concept: "poverty",
  estimand: "fgt0",
  place: null,
}

function oneOf<T extends string>(
  value: string | null,
  allowed: readonly T[],
  fallback: T,
): T {
  return value && allowed.includes(value as T) ? (value as T) : fallback
}

function supportedPeriod(level: GeographyLevel, value: string | null): PeriodId {
  const allowed = getPeriodsForLevel(level).map((period) => period.id)
  return value && allowed.includes(value) ? value : latestPeriod(level)
}

function supportedPlace(level: GeographyLevel, value: string | null): string | null {
  if (!value) return null
  return getGeographiesForLevel(level).some((geography) => geography.id === value)
    ? value
    : null
}

export function normalizeAtlasState(state: AtlasState): AtlasState {
  const level = availableGeographyLevels.includes(state.level)
    ? state.level
    : defaultAtlasState.level
  return {
    level,
    period: supportedPeriod(level, state.period),
    universe: oneOf(state.universe, universes, defaultAtlasState.universe),
    concept: oneOf(state.concept, concepts, defaultAtlasState.concept),
    estimand: oneOf(state.estimand, estimands, defaultAtlasState.estimand),
    place: supportedPlace(level, state.place),
  }
}

export function parseAtlasState(search: string): AtlasState {
  const params = new URLSearchParams(search)
  const level = oneOf(
    params.get("level"),
    availableGeographyLevels,
    defaultAtlasState.level,
  )

  return normalizeAtlasState({
    level,
    period: supportedPeriod(level, params.get("period")),
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
    place: supportedPlace(level, params.get("place")),
  })
}

export function serializeAtlasState(state: AtlasState) {
  const normalized = normalizeAtlasState(state)
  const params = new URLSearchParams()
  params.set("level", normalized.level)
  params.set("period", normalized.period)
  params.set("universe", normalized.universe)
  params.set("concept", normalized.concept)
  params.set("estimand", normalized.estimand)
  if (normalized.place) params.set("place", normalized.place)
  return params.toString()
}

export function normalizeRoute(pathname: string): AtlasRoute {
  return pathname === "/explorar" ? "/explorar" : "/"
}

export function buildAtlasHref(route: AtlasRoute, state: AtlasState) {
  return `${route}?${serializeAtlasState(state)}`
}

export function applyAtlasPatch(
  state: AtlasState,
  patch: Partial<AtlasState>,
): AtlasState {
  const levelChanged = patch.level !== undefined && patch.level !== state.level
  const candidate = {
    ...state,
    ...patch,
    ...(levelChanged ? { place: null } : {}),
  }
  return normalizeAtlasState(candidate)
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
        const normalized = normalizeAtlasState(nextState)
        const href = buildAtlasHref(route, normalized)
        window.history.pushState({}, "", href)
        setLocation({ route, state: normalized })
      },
      updateState(patch: Partial<AtlasState>) {
        const nextState = applyAtlasPatch(location.state, patch)
        const href = buildAtlasHref(location.route, nextState)
        window.history.replaceState({}, "", href)
        setLocation({ ...location, state: nextState })
      },
    }),
    [location],
  )
}
