import { useState } from 'react';
import { GRID_COLS, GRID_ROWS, LAND_ROWS, LAT_MAX, LAT_MIN, LON_MAX, LON_MIN } from '../lib/worldgrid';

export interface GeoPoint {
  lat: number;
  lon: number;
  country: string | null;
  n: number;
}

const CELL = 12; // svg units per grid cell
const WIDTH = GRID_COLS * CELL;
const HEIGHT = GRID_ROWS * CELL;

const regionNames = typeof Intl !== 'undefined' && 'DisplayNames' in Intl
  ? new Intl.DisplayNames(['en'], { type: 'region' })
  : null;

function countryLabel(code: string | null): string {
  if (!code) return 'Unknown region';
  try {
    return regionNames?.of(code) ?? code;
  } catch {
    return code;
  }
}

function project(lat: number, lon: number): { x: number; y: number } {
  const x = ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * WIDTH;
  const y = ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * HEIGHT;
  return { x, y };
}

interface Tooltip {
  x: number;
  y: number;
  title: string;
  detail: string;
}

/** Dot-matrix world map: land as faint dots, activity as accent dots sized by volume, with hover tooltips. */
export function WorldMap({ points }: { points: GeoPoint[] }) {
  const [tip, setTip] = useState<Tooltip | null>(null);
  const maxCount = Math.max(1, ...points.map(p => p.n));

  return (
    <div style={{ position: 'relative' }}>
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
          const active = tip?.x === x && tip?.y === y;
          return (
            <g
              key={i}
              onMouseEnter={() =>
                setTip({
                  x, y,
                  title: countryLabel(p.country),
                  detail: `${p.n.toLocaleString('en-US')} ${p.n === 1 ? 'event' : 'events'}`
                })
              }
              onMouseLeave={() => setTip(null)}
              style={{ cursor: 'default' }}
            >
              <circle cx={x} cy={y} r={Math.max(radius + 6, 12)} fill="transparent" />
              <circle cx={x} cy={y} r={radius + 3} fill="var(--accent)" opacity={active ? 0.32 : 0.18} />
              <circle cx={x} cy={y} r={radius} fill="var(--accent)" opacity={0.9} />
            </g>
          );
        })}
      </svg>
      {tip && (
        <div
          className="mono"
          style={{
            position: 'absolute',
            left: `${(tip.x / WIDTH) * 100}%`,
            top: `${(tip.y / HEIGHT) * 100}%`,
            transform: 'translate(-50%, calc(-100% - 12px))',
            background: 'var(--card)',
            border: '1px solid var(--frame-border)',
            borderRadius: 7,
            boxShadow: 'var(--pop-shadow)',
            padding: '7px 11px',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            zIndex: 10
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{tip.title}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{tip.detail}</div>
        </div>
      )}
    </div>
  );
}
