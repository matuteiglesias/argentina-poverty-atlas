export type DiagnosticLevel = "province_2010" | "department_2010"

export interface KnownNonemptyTile {
  z: number
  x: number
  y: number
  bytes_server_proof: number
  sha256_server_proof: string
  observed_geography_id_count_server: number
}

export interface DiagnosticFixture {
  tileset_id: string
  source_layer: string
  known_nonempty_tile: KnownNonemptyTile | null
  all_lowzoom_nonempty_tiles: KnownNonemptyTile[]
}

export function parseDiagnosticLevel(search: string): DiagnosticLevel {
  const value = new URLSearchParams(search).get("level")
  return value === "department_2010" ? "department_2010" : "province_2010"
}

export function tileCenter(z: number, x: number, y: number): [number, number] {
  const n = 2 ** z
  const lon = ((x + 0.5) / n) * 360 - 180
  const mercatorY = Math.PI * (1 - (2 * (y + 0.5)) / n)
  const lat = (Math.atan(Math.sinh(mercatorY)) * 180) / Math.PI
  return [lon, lat]
}

export function vectorTileUrl(
  tilesetId: string,
  tile: Pick<KnownNonemptyTile, "z" | "x" | "y">,
  token: string,
) {
  return (
    `https://api.mapbox.com/v4/${tilesetId}/${tile.z}/${tile.x}/${tile.y}.mvt` +
    `?access_token=${encodeURIComponent(token)}`
  )
}
