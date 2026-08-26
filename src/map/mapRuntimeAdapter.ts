import type { AnyLayer, Map as MapboxMap, MapLayerMouseEvent } from "mapbox-gl"
import type {
  MapLayerEvent,
  MapLayerEventHandler,
  MapRuntime,
  RuntimeMapEventName,
} from "@/map/runtimeJoin"

type RuntimeFeature = NonNullable<MapLayerEvent["features"]>[number]

export function createMapRuntimeAdapter(map: MapboxMap): MapRuntime {
  const handlers = new Map<
    MapLayerEventHandler,
    (event: MapLayerMouseEvent) => void
  >()
  const setPaintProperty = map.setPaintProperty.bind(map) as (
    layerId: string,
    property: string,
    value: unknown,
  ) => void

  function eventHandler(handler: MapLayerEventHandler) {
    const existing = handlers.get(handler)
    if (existing) return existing
    const adapted = (event: MapLayerMouseEvent) =>
      handler({
        features: event.features as unknown as RuntimeFeature[] | undefined,
      })
    handlers.set(handler, adapted)
    return adapted
  }

  return {
    getLayer(id) {
      return map.getLayer(id)
    },
    addLayer(layer) {
      map.addLayer(layer as AnyLayer)
    },
    setPaintProperty(layerId, property, value) {
      setPaintProperty(layerId, property, value)
    },
    setFeatureState(target, state) {
      map.setFeatureState(target, state)
    },
    on(type: RuntimeMapEventName, layerId, handler) {
      map.on(type, layerId, eventHandler(handler))
    },
    off(type: RuntimeMapEventName, layerId, handler) {
      const adapted = handlers.get(handler)
      if (!adapted) return
      map.off(type, layerId, adapted)
      handlers.delete(handler)
    },
    setCursor(cursor) {
      map.getCanvas().style.cursor = cursor
    },
  }
}
