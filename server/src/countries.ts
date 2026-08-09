import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

type Ring = [number, number][];
type Polygon = Ring[];

interface Feature {
  name: string;
  bbox: [number, number, number, number]; // lonMin, lonMax, latMin, latMax
  polygons: Polygon[];
}

let features: Feature[] | null = null;

function load(): Feature[] {
  if (features) return features;
  const raw = JSON.parse(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'data/countries.geo.json'), 'utf8')
  ) as { features: { properties: { name: string }; geometry: { type: string; coordinates: unknown } }[] };
  features = raw.features.map(f => {
    const polygons: Polygon[] =
      f.geometry.type === 'Polygon'
        ? [f.geometry.coordinates as Polygon]
        : (f.geometry.coordinates as Polygon[]);
    let lonMin = Infinity, lonMax = -Infinity, latMin = Infinity, latMax = -Infinity;
    for (const poly of polygons) {
      for (const [lon, lat] of poly[0]) {
        if (lon < lonMin) lonMin = lon;
        if (lon > lonMax) lonMax = lon;
        if (lat < latMin) latMin = lat;
        if (lat > latMax) latMax = lat;
      }
    }
    return { name: f.properties.name, bbox: [lonMin, lonMax, latMin, latMax], polygons };
  });
  return features;
}

function inRing(lon: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inPolygon(lon: number, lat: number, polygon: Polygon): boolean {
  if (!inRing(lon, lat, polygon[0])) return false;
  for (let i = 1; i < polygon.length; i++) {
    if (inRing(lon, lat, polygon[i])) return false;
  }
  return true;
}

/**
 * Offline reverse lookup: which country contains this coordinate?
 * Returns the country's display name, or null for open water. Nearby-cell
 * nudges cover grid centers that land just offshore.
 */
export function countryAt(lat: number, lon: number): string | null {
  const all = load();
  const candidates: [number, number][] = [
    [lat, lon], [lat + 1, lon], [lat - 1, lon], [lat, lon + 1], [lat, lon - 1]
  ];
  for (const [la, lo] of candidates) {
    for (const f of all) {
      const [lonMin, lonMax, latMin, latMax] = f.bbox;
      if (lo < lonMin || lo > lonMax || la < latMin || la > latMax) continue;
      if (f.polygons.some(p => inPolygon(lo, la, p))) return f.name;
    }
  }
  return null;
}
