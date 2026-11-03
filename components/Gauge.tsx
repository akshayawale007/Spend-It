'use client';
import { useEffect, useState } from 'react';

// Remembers each gauge's last value so it animates from there, even after a remount.
const prevPct = new Map<string, number>();

/** 50×30 semicircle gauge; animates (1s) from its previous value. */
export function Gauge({ id, pct }: { id: string; pct: number }) {
  const to = Math.min(100, Math.max(0, pct));
  const [shown, setShown] = useState(() => prevPct.get(id) ?? 0);
  const over = pct > 100.0001;

  useEffect(() => {
    prevPct.set(id, to);
    let r2 = 0;
    const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setShown(to)); });
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
  }, [id, to]);

  const gc = over ? 'var(--over)' : 'color-mix(in srgb, var(--c) 78%, #1c1f2a)';
  return (
    <span className="lead" style={{ ['--gc' as string]: gc }}>
      <svg className="g" viewBox="0 0 50 30" aria-hidden="true">
        <path className="g-track" d="M5 26 A20 20 0 0 1 45 26" />
        <path className="g-fill" d="M5 26 A20 20 0 0 1 45 26" pathLength={100}
          style={{ strokeDashoffset: 100 - shown, opacity: shown === 0 && to === 0 ? 0 : undefined }} />
      </svg>
      <span className={over ? 'g-pct over' : 'g-pct'}>{Math.round(pct)}%</span>
    </span>
  );
}
