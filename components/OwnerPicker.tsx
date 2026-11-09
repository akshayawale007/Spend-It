'use client';
import type { Ref } from 'react';
import { store } from '@/lib/store';
import { useOwners } from '@/hooks/useMonthData';
import { cssVar } from './util';

/**
 * Owner chips. Optional pickers clear when the selected chip is tapped again;
 * required ones (every spend needs an owner) keep it.
 */
export function OwnerPicker({ value, onChange, small, required, pickRef }: {
  value: string | null; onChange: (id: string | null) => void; small?: boolean; required?: boolean;
  pickRef?: Ref<HTMLDivElement>;
}) {
  const owners = useOwners();
  if (!owners.length) return null;
  return (
    <div ref={pickRef} className={small ? 'cat-scroll own-pick sm' : 'cat-scroll own-pick'} role="radiogroup" aria-label="Owner" aria-required={required}>
      {owners.map(o => (
        <button key={o.id} type="button" className="chip" style={cssVar(o.color)} role="radio" aria-checked={o.id === value} aria-pressed={o.id === value}
          onClick={ev => {
            // Picking an owner clears the "pick an owner" warning straight away.
            ev.currentTarget.parentElement?.classList.remove('bad');
            onChange(o.id === value && !required ? null : o.id);
          }}>
          <span className="dot" />{o.name}
        </button>
      ))}
    </div>
  );
}

/** The owner id if it still exists, else null. */
export const liveOwner = (id: string | null) => (id && store.get().data.owners.some(o => o.id === id) ? id : null);

/** A spend must have an owner, unless no owners exist at all. */
export const ownerMissing = (id: string | null) => !liveOwner(id) && store.get().data.owners.length > 0;
