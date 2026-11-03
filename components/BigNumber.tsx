'use client';
import { useLayoutEffect, useRef } from 'react';
import { numStr } from '@/lib/format';
import { reduced } from './util';

function html(v: number, decimals: boolean) {
  const a = Math.abs(v);
  return `${v < 0 ? '−' : ''}<span class="cur">₹</span>${decimals ? numStr(a) : Math.round(a).toLocaleString('en-IN')}`;
}

/** The hero number with a 650ms ease-out-cubic count-up. Remount (key) to reset the start. */
export function BigNumber({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current!;
    const from = shown.current ?? value;
    shown.current = value;
    const dec = Math.round(value) !== value;
    if (from === value || reduced()) { el.innerHTML = html(value, dec); return; }
    const t0 = performance.now(), d = 650;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / d), e = 1 - Math.pow(1 - p, 3);
      el.innerHTML = p < 1 ? html(from + (value - from) * e, false) : html(value, dec);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); el.innerHTML = html(value, dec); };
  }, [value]);

  return <span className={value < 0 ? 'big neg' : 'big'} ref={ref} aria-live="polite" />;
}
