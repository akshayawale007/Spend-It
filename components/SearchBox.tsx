'use client';
import { useEffect, useRef } from 'react';
import { I } from './icons';

/** Round search button for a list header. */
export function SearchToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="sort-btn search-btn" aria-label={open ? 'Close search' : 'Search'} aria-expanded={open} onClick={onToggle}>
      {open ? <I.x /> : <I.search />}
    </button>
  );
}

/** Search field shown under a list header. Esc clears and closes it. */
export function SearchBox({ value, onChange, onClose, placeholder }: {
  value: string; onChange: (v: string) => void; onClose: () => void; placeholder: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className="search glass">
      <I.search />
      <input ref={ref} type="search" enterKeyHint="search" placeholder={placeholder} aria-label={placeholder}
        value={value} onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Escape') onClose(); }} />
      {value && <button type="button" className="search-x" aria-label="Clear search" onClick={() => { onChange(''); ref.current?.focus(); }}><I.x /></button>}
    </div>
  );
}
