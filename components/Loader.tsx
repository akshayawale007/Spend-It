'use client';
import { useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';

const FLICK_MS = 300; // one note every 300ms, matching the CSS (1.2s cycle / 4 notes)
const PER_NOTE = 500;
const MAX = 10_000; // the total climbs to ₹10,000, then starts again from ₹0
const inr = new Intl.NumberFormat('en-IN');

const W = 132; // note width (px), keep in sync with .face in globals.css
const STRIPS = 6; // a turning note is cut into hinged strips so it can bend like paper
const SW = W / STRIPS;

/** One printed side of a Spendit note: engraved paper with the app logo in the middle. */
function Face({ style }: { style?: CSSProperties }) {
  return (
    <b className="face" style={style}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="n-seal" src="/icons/icon-512.png" alt="" width={40} height={40} decoding="async" />
    </b>
  );
}

/**
 * Strip k of a turning note, with the next strip hinged to its right edge. Each strip shows
 * its slice of the front, and on the back the slice that ends up there once the note lands.
 */
function Strip({ k }: { k: number }) {
  return (
    <span className="strip" style={{ left: k ? SW : 0, width: SW }}>
      <span className="slice"><Face style={{ left: -k * SW }} /></span>
      <span className="slice back"><Face style={{ left: -(STRIPS - 1 - k) * SW }} /></span>
      {k < STRIPS - 1 && <Strip k={k + 1} />}
    </span>
  );
}

/** Full-screen loader: Spendit notes turned from one pile to the other, like a cash counter, with a running total. */
export function Loader({ label = 'Loading your month…' }: { label?: string }) {
  // Drawn straight into <body> so no card, dock or header can sit above it.
  const [body, setBody] = useState<HTMLElement | null>(null);
  const [count, setCount] = useState(0);
  useEffect(() => {
    setBody(document.body);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setCount(c => (c + 1) % (MAX / PER_NOTE + 1)), FLICK_MS);
    return () => clearInterval(t);
  }, []);

  const view = (
    <div className="loader" role="status" aria-live="polite" aria-label={label}>
      <div className="cash" aria-hidden="true">
        <i className="note pl p2"><Face /></i><i className="note pl"><Face /></i>
        <i className="note pr p2"><Face /></i><i className="note pr"><Face /></i>
        {[0, 1, 2, 3].map(i => (
          <i key={i} className="note flip" style={{ '--i': i } as CSSProperties}><Strip k={0} /></i>
        ))}
      </div>
      <b className="cash-count" aria-hidden="true">₹{inr.format(count * PER_NOTE)}</b>
      <span>{label}</span>
    </div>
  );
  return body ? createPortal(view, body) : view;
}
