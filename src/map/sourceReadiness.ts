export interface GeographySourceFeature {
  properties?: Record<string, unknown>
}

export function loadedGeographyIds(
  features: readonly GeographySourceFeature[],
  featureIdProperty: string,
): string[] {
  return [
    ...new Set(
      features
        .map((feature) => feature.properties?.[featureIdProperty])
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    ),
  ].sort()
}
