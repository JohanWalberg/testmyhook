import { GRID_COLS, GRID_ROWS, LAND_ROWS, LAT_MAX, LAT_MIN, LON_MAX, LON_MIN } from '../lib/worldgrid';

export interface GeoPoint {
  lat: number;
  lon: number;
  n: number;
}

const CELL = 12; // svg units per grid cell
const WIDTH = GRID_COLS * CELL;
const HEIGHT = GRID_ROWS * CELL;

function project(lat: number, lon: number): { x: number; y: number } {
  const x = ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * WIDTH;
  const y = ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * HEIGHT;
  return { x, y };
}

/** Dot-matrix world map: land as faint dots, activity as accent dots sized by volume. */
export function WorldMap({ points }: { points: GeoPoint[] }) {
  const maxCount = Math.max(1, ...points.map(p => p.n));
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      style={{ width: '100%', height: 'auto', display: 'block' }}
      role="img"
      aria-label="World map of where webhooks and visitors come from"
    >
      {LAND_ROWS.map((row, r) => {
        const dots = [];
        for (let c = 0; c < GRID_COLS; c++) {
          if (row[c] === '1') {
            dots.push(<circle key={c} cx={c * CELL + CELL / 2} cy={r * CELL + CELL / 2} r={2.1} fill="var(--dash)" />);
          }
        }
        return <g key={r}>{dots}</g>;
      })}
      {points.map((p, i) => {
        const { x, y } = project(p.lat, p.lon);
        const radius = 3.5 + 4.5 * Math.sqrt(p.n / maxCount);
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={radius + 3} fill="var(--accent)" opacity={0.18} />
            <circle cx={x} cy={y} r={radius} fill="var(--accent)" opacity={0.9}>
              <title>{`${p.n.toLocaleString('en-US')} ${p.n === 1 ? 'event' : 'events'} near ${p.lat}°, ${p.lon}°`}</title>
            </circle>
          </g>
        );
      })}
    </svg>
  );
}
