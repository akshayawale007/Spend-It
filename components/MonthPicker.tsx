'use client';
import { useState } from 'react';
import { curKey, MONTHS, pad } from '@/lib/format';
import { useMonthsWithData } from '@/hooks/useMonthData';
import { useApp } from './AppContext';
import { I } from './icons';

export function MonthPicker({ close }: { close: () => void }) {
  const { month, goMonth } = useApp();
  const withData = useMonthsWithData();
  const [y, setY] = useState(Number(month.slice(0, 4)));
  const now = curKey();
  const pick = (k: string) => { goMonth(k); close(); };

  return (
    <>
      <div className="mp-head">
        <button className="icon-btn" aria-label="Previous year" onClick={() => setY(y - 1)}><I.left /></button>
        <b aria-live="polite">{y}</b>
        <button className="icon-btn" aria-label="Next year" onClick={() => setY(y + 1)}><I.right /></button>
      </div>
      <div className="mp-grid">
        {MONTHS.map((n, i) => {
          const k = `${y}-${pad(i + 1)}`;
          const cls = ['mp-m', k === month && 'sel', k === now && 'now'].filter(Boolean).join(' ');
          return (
            <button key={k} className={cls} aria-pressed={k === month} aria-label={`${n} ${y}${withData.has(k) ? ', has data' : ''}`} onClick={() => pick(k)}>
              {n.slice(0, 3)}{withData.has(k) && <i />}
            </button>
          );
        })}
      </div>
      <button className="btn-text" onClick={() => pick(now)}>Jump to this month</button>
    </>
  );
}
