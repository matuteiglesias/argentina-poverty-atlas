import { useEffect, useMemo, useRef, useState } from "react"
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
  defaultGeographyLevel,
  loadReleaseData,
  releaseRegistry,
  type ReleaseRegistry,
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

function releaseFor(registry: ReleaseRegistry, level: GeographyLevel) {
  const release = registry.releases.get(level)
  if (!release) throw new Error(`No release available for ${level}`)
  return release
}

function latestPeriod(
  level: GeographyLevel,
  registry: ReleaseRegistry = releaseRegistry,
): PeriodId {
  const period = releaseFor(registry, level).metadata.periods.at(-1)
  if (!period) throw new Error(`No periods available for ${level}`)
  return period.id
}

export const defaultAtlasState: AtlasState = {
  level: defaultGeographyLevel,
  period: latestPeriod(defaultGeographyLevel, releaseRegistry),
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

function supportedPeriod(
  registry: ReleaseRegistry,
  level: GeographyLevel,
  value: string | null,
): PeriodId {
  const allowed = releaseFor(registry, level).metadata.periods.map((period) => period.id)
  return value && allowed.includes(value) ? value : latestPeriod(level, registry)
}

function supportedPlace(
  registry: ReleaseRegistry,
  level: GeographyLevel,
  value: string | null,
): string | null {
  if (!value) return null
  return releaseFor(registry, level).geographies.some((geography) => geography.id === value)
    ? value
    : null
}

export function normalizeAtlasStateWithRegistry(
  state: AtlasState,
  registry: ReleaseRegistry,
): AtlasState {
  const level = registry.availableLevels.includes(state.level)
    ? state.level
    : registry.defaultLevel
  return {
    level,
    period: supportedPeriod(registry, level, state.period),
    universe: oneOf(state.universe, universes, defaultAtlasState.universe),
    concept: oneOf(state.concept, concepts, defaultAtlasState.concept),
    estimand: oneOf(state.estimand, estimands, defaultAtlasState.estimand),
    place: supportedPlace(registry, level, state.place),
  }
}

export function normalizeAtlasState(state: AtlasState): AtlasState {
  return normalizeAtlasStateWithRegistry(state, releaseRegistry)
}

export function parseAtlasState(search: string): AtlasState {
  const params = new URLSearchParams(search)
  const level = oneOf(
    params.get("level"),
    releaseRegistry.availableLevels,
    defaultAtlasState.level,
  )

  return normalizeAtlasState({
    level,
    period: supportedPeriod(releaseRegistry, level, params.get("period")),
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
    place: supportedPlace(releaseRegistry, level, params.get("place")),
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

export function applyAtlasPatchWithRegistry(
  state: AtlasState,
  patch: Partial<AtlasState>,
  registry: ReleaseRegistry,
): AtlasState {
  const levelChanged = patch.level !== undefined && patch.level !== state.level
  const candidate = {
    ...state,
    ...patch,
    ...(levelChanged ? { place: null } : {}),
  }
  return normalizeAtlasStateWithRegistry(candidate, registry)
}

export function applyAtlasPatch(
  state: AtlasState,
  patch: Partial<AtlasState>,
): AtlasState {
  return applyAtlasPatchWithRegistry(state, patch, releaseRegistry)
}

function readLocation() {
  return {
    route: normalizeRoute(window.location.pathname),
    state: parseAtlasState(window.location.search),
  }
}

export function useAtlasNavigation() {
  const [location, setLocation] = useState(readLocation)
  const [dataReady, setDataReady] = useState(false)
  const [dataPending, setDataPending] = useState(true)
  const [dataError, setDataError] = useState<string | null>(null)
  const transitionId = useRef(0)

  useEffect(() => {
    let cancelled = false
    const initial = readLocation()
    setDataPending(true)
    void loadReleaseData(initial.state.level, initial.state.period)
      .then(() => {
        if (cancelled) return
        setLocation(initial)
        setDataReady(true)
        setDataPending(false)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setDataError(error instanceof Error ? error.message : "No se pudieron cargar los datos")
        setDataPending(false)
      })

    const onPopState = () => {
      const target = readLocation()
      const ticket = ++transitionId.current
      setDataPending(true)
      setDataError(null)
      void loadReleaseData(target.state.level, target.state.period)
        .then(() => {
          if (ticket !== transitionId.current) return
          setLocation(target)
          setDataReady(true)
          setDataPending(false)
        })
        .catch((error: unknown) => {
          if (ticket !== transitionId.current) return
          setDataError(error instanceof Error ? error.message : "No se pudieron cargar los datos")
          setDataPending(false)
        })
    }
    window.addEventListener("popstate", onPopState)
    return () => {
      cancelled = true
      window.removeEventListener("popstate", onPopState)
    }
  }, [])

  return useMemo(() => {
    const transition = (
      route: AtlasRoute,
      nextState: AtlasState,
      mode: "push" | "replace",
    ) => {
      const normalized = normalizeAtlasState(nextState)
      const href = buildAtlasHref(route, normalized)
      const ticket = ++transitionId.current
      setDataPending(true)
      setDataError(null)
      void loadReleaseData(normalized.level, normalized.period)
        .then(() => {
          if (ticket !== transitionId.current) return
          if (mode === "push") window.history.pushState({}, "", href)
          else window.history.replaceState({}, "", href)
          setLocation({ route, state: normalized })
          setDataReady(true)
          setDataPending(false)
        })
        .catch((error: unknown) => {
          if (ticket !== transitionId.current) return
          setDataError(error instanceof Error ? error.message : "No se pudieron cargar los datos")
          setDataPending(false)
        })
    }

    return {
      ...location,
      dataReady,
      dataPending,
      dataError,
      navigate(route: AtlasRoute, nextState = location.state) {
        transition(route, nextState, "push")
      },
      updateState(patch: Partial<AtlasState>) {
        transition(
          location.route,
          applyAtlasPatch(location.state, patch),
          "replace",
        )
      },
    }
  }, [dataError, dataPending, dataReady, location])
}
