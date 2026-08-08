import geoip from 'geoip-lite';

/**
 * Resolves an IP to an approximate location, snapped to a 2° grid so only
 * coarse regions are ever stored — never precise positions, never the IP.
 * Returns null for private/unknown addresses (e.g. all of localhost dev).
 */
export function coarseLocation(ip: string | null): { lat: number; lon: number } | null {
  if (!ip) return null;
  const cleaned = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  const hit = geoip.lookup(cleaned);
  if (!hit || !hit.ll) return null;
  const [lat, lon] = hit.ll;
  return {
    lat: Math.round(lat / 2) * 2,
    lon: Math.round(lon / 2) * 2
  };
}
