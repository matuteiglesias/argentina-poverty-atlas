import { describe, expect, it } from "vitest"
import { fixtureRelease, getFact } from "@/data/fixture"
import { parseAtlasState } from "@/lib/atlasState"
import {
  geometryTransportManifest,
  validateGeometryTransportManifest,
} from "@/map/geometryTransport"
import {
  createRuntimeJoin,
  getLegendModel,
  MAP_LAYERS,
  type MapLayerEvent,
  type MapLayerEventHandler,
  type MapRuntime,
} from "@/map/runtimeJoin"
import {
  runtimeTransportFromManifest,
  type RuntimeGeometryTransport,
} from "@/map/runtimeTransport"

const transport: RuntimeGeometryTransport = {
  geography_level: "province_2010",
  geography_release_id: "geography-fixture-for-runtime-test@v1",
  feature_id_property: "geography_id",
  mapbox_source: "mapbox://fixture.provinces",
  source_layer: "province_2010",
  style_url: "mapbox://styles/mapbox/standard",
  expected_geography_ids: fixtureRelease.geographies.map((item) => item.id),
}

class MockMap implements MapRuntime {
  layers = new Map<string, Record<string, unknown>>()
  paintUpdates: { layer: string; property: string; value: unknown }[] = []
  stateUpdates: {
    target: { source: string; sourceLayer: string; id: string }
    state: Record<string, string | number | boolean>
  }[] = []
  listeners = new Map<string, MapLayerEventHandler[]>()
  cursor: "pointer" | "" = ""

  getLayer(id: string) {
    return this.layers.get(id)
  }

  addLayer(layer: Record<string, unknown>) {
    this.layers.set(String(layer.id), layer)
  }

  setPaintProperty(layer: string, property: string, value: unknown) {
    this.paintUpdates.push({ layer, property, value })
  }

  setFeatureState(
    target: { source: string; sourceLayer: string; id: string },
    state: Record<string, string | number | boolean>,
  ) {
    this.stateUpdates.push({ target, state })
  }

  on(type: string, layer: string, handler: MapLayerEventHandler) {
    const key = `${type}|${layer}`
    this.listeners.set(key, [...(this.listeners.get(key) ?? []), handler])
  }

  off(type: string, layer: string, handler: MapLayerEventHandler) {
    const key = `${type}|${layer}`
    this.listeners.set(
      key,
      (this.listeners.get(key) ?? []).filter((item) => item !== handler),
    )
  }

  setCursor(cursor: "pointer" | "") {
    this.cursor = cursor
  }

  emit(type: string, layer: string, event: MapLayerEvent) {
    for (const handler of this.listeners.get(`${type}|${layer}`) ?? []) {
      handler(event)
    }
  }
}

describe("W4 runtime choropleth join", () => {
  it("installs exactly one stable layer set and writes selected fixture facts by exact ID", () => {
    const map = new MockMap()
    const selected: string[] = []
    const runtime = createRuntimeJoin(map, transport, fixtureRelease, (id) =>
      selected.push(id),
    )
    const state = parseAtlasState(
      "?period=demo-2026-S1&universe=persons&concept=poverty&estimand=fgt0&place=06",
    )

    runtime.applyState(state)

    expect([...map.layers.keys()]).toEqual([
      MAP_LAYERS.fill,
      MAP_LAYERS.boundary,
      MAP_LAYERS.hover,
      MAP_LAYERS.selected,
    ])
    expect(map.stateUpdates).toHaveLength(24)
    const buenosAires = map.stateUpdates.find((update) => update.target.id === "06")
    const sourceFact = getFact("06", state.period, state.universe, state.concept, state.estimand)
    expect(buenosAires?.state.estimate).toBe(sourceFact?.estimate)
    expect(buenosAires?.state.selected).toBe(true)

    map.emit("click", MAP_LAYERS.fill, {
      features: [{ id: "06", properties: { geography_id: "06" } }],
    })
    expect(selected).toEqual(["06"])
  })

  it("recolors the same layers for period, concept and universe changes", () => {
    const map = new MockMap()
    const runtime = createRuntimeJoin(map, transport, fixtureRelease, () => undefined)
    const layerCount = map.layers.size

    runtime.applyState(
      parseAtlasState(
        "?period=demo-2023-S2&universe=persons&concept=poverty&estimand=fgt0",
      ),
    )
    runtime.applyState(
      parseAtlasState(
        "?period=demo-2026-S1&universe=households&concept=indigence&estimand=fgt2",
      ),
    )

    expect(map.layers.size).toBe(layerCount)
    expect(map.stateUpdates).toHaveLength(48)
    expect(map.paintUpdates).toHaveLength(2)
  })

  it("keeps hover transient and selection durable", () => {
    const map = new MockMap()
    const hovered: Array<string | null> = []
    createRuntimeJoin(
      map,
      transport,
      fixtureRelease,
      () => undefined,
      (id) => hovered.push(id),
    )

    map.emit("mousemove", MAP_LAYERS.fill, {
      features: [{ id: "14", properties: { geography_id: "14" } }],
    })
    expect(map.cursor).toBe("pointer")
    expect(hovered).toEqual(["14"])
    expect(map.stateUpdates.at(-1)).toMatchObject({
      target: { id: "14" },
      state: { hovered: true },
    })

    map.emit("mouseleave", MAP_LAYERS.fill, {})
    expect(map.cursor).toBe("")
    expect(hovered).toEqual(["14", null])
    expect(map.stateUpdates.at(-1)).toMatchObject({
      target: { id: "14" },
      state: { hovered: false },
    })
  })

  it("uses a release-wide legend domain independent of period and universe", () => {
    const poverty = getLegendModel(fixtureRelease, "poverty", "fgt0")
    expect(poverty.min).toBe(0)
    expect(poverty.max).toBeGreaterThan(0)
    expect(poverty.stops).toHaveLength(6)
    expect(getLegendModel(fixtureRelease, "poverty", "fgt0")).toEqual(poverty)
  })

  it("inherits W3's exact 24-ID compatibility gate", () => {
    expect(() =>
      validateGeometryTransportManifest(
        {
          ...geometryTransportManifest,
          fixture_geography_ids: geometryTransportManifest.fixture_geography_ids.slice(1),
        },
        fixtureRelease.geographies.map((item) => item.id),
      ),
    ).toThrow(/exactly 24 geography IDs|exactly match/)
  })

  it("does not create runtime transport from an unpublished W3 manifest", () => {
    const blockedManifest = validateGeometryTransportManifest(
      {
        ...geometryTransportManifest,
        status: "blocked_upstream",
        parent_release: null,
        mapbox: {
          ...geometryTransportManifest.mapbox,
          tileset_id: null,
          source_layer: null,
          published_feature_count: null,
          publication_time: null,
          publication_job_id: null,
        },
      },
      fixtureRelease.geographies.map((item) => item.id),
    )
    expect(runtimeTransportFromManifest(blockedManifest)).toBeNull()
  })
})
