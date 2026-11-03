'use client';
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { animateOpen } from './util';

/**
 * Height-animated collapsible. The `open` class is managed imperatively after the
 * first render so the JS can measure the starting height before switching it.
 */
export function Collapse({ open, id, children }: { open: boolean; id?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const initial = useRef(open).current;
  const last = useRef(open);

  useLayoutEffect(() => {
    if (last.current === open || !ref.current) return;
    last.current = open;
    animateOpen(ref.current, open);
  }, [open]);

  return (
    <div className={initial ? 'cx open' : 'cx'} id={id} ref={ref}>
      <div className="ci">{children}</div>
    </div>
  );
}
