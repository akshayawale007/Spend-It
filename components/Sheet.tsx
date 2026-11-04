'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

type SheetOpts = { tall?: boolean; label?: string; onClose?: () => void };
type Item = { id: number; render: (close: () => void) => ReactNode; opts: SheetOpts; closing: boolean };
type ConfirmOpts = { title: string; text: ReactNode; ok?: string; danger?: boolean };

type Api = {
  open: (render: (close: () => void) => ReactNode, opts?: SheetOpts) => () => void;
  confirm: (o: ConfirmOpts) => Promise<boolean>;
};

const Ctx = createContext<Api>({ open: () => () => {}, confirm: async () => false });
export const useSheets = () => useContext(Ctx);

let seq = 0;

export function SheetProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<Item[]>([]);
  const stackRef = useRef(stack);
  stackRef.current = stack;

  // Each open sheet adds a history entry, so the phone's back button closes the top sheet
  // instead of leaving the page. Closing from the UI pops that entry again.
  const ownPops = useRef(0);

  const requestClose = useCallback((id: number, fromBack = false) => {
    const item = stackRef.current.find(s => s.id === id);
    if (!item || item.closing) return;
    item.opts.onClose?.();
    setStack(s => s.map(x => (x.id === id ? { ...x, closing: true } : x)));
    if (!fromBack && history.state?.spenditSheet === id) {
      ownPops.current++;
      history.back();
    }
  }, []);

  const open = useCallback<Api['open']>((render, opts = {}) => {
    const id = ++seq;
    setStack(s => [...s, { id, render, opts, closing: false }]);
    history.pushState({ ...history.state, spenditSheet: id }, '');
    return () => requestClose(id);
  }, [requestClose]);

  useEffect(() => {
    const onPop = () => {
      if (ownPops.current) { ownPops.current--; return; }
      const live = stackRef.current.filter(s => !s.closing);
      if (live.length) requestClose(live[live.length - 1].id, true);
    };
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, [requestClose]);

  const confirm = useCallback<Api['confirm']>(o => new Promise<boolean>(resolve => {
    let answered = false;
    open(close => (
      <>
        <div className="sh-head">
          <h3>{o.title}</h3>
          <p className="sub" style={{ marginTop: 6, fontSize: 14, color: 'var(--ink-2)' }}>{o.text}</p>
        </div>
        <button className="btn-primary" style={o.danger ? { background: 'var(--over)' } : undefined}
          onClick={() => { answered = true; resolve(true); close(); }}>{o.ok ?? 'Confirm'}</button>
        <button className="btn-text" onClick={close}>Cancel</button>
      </>
    ), { label: o.title, onClose: () => { if (!answered) resolve(false); } });
  }), [open]);

  useEffect(() => {
    document.body.classList.toggle('locked', stack.length > 0);
  }, [stack.length]);

  const live = stack.filter(s => !s.closing);
  const topId = live.length ? live[live.length - 1].id : null;

  return (
    <Ctx.Provider value={{ open, confirm }}>
      {children}
      {stack.map(item => (
        <Sheet key={item.id} item={item} top={item.id === topId}
          onRequestClose={() => requestClose(item.id)}
          onRemoved={() => setStack(s => s.filter(x => x.id !== item.id))} />
      ))}
    </Ctx.Provider>
  );
}

function Sheet({ item, top, onRequestClose, onRemoved }: {
  item: Item; top: boolean; onRequestClose: () => void; onRemoved: () => void;
}) {
  const [shown, setShown] = useState(false);
  const sheet = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y0: number; dy: number } | null>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    opener.current = document.activeElement;
    sheet.current?.focus({ preventScroll: true });
    let r2 = 0;
    const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setShown(true)); });
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
  }, []);

  useEffect(() => {
    if (!item.closing) return;
    setShown(false);
    if (sheet.current) sheet.current.style.transform = '';
    const t = setTimeout(() => {
      onRemoved();
      if (opener.current instanceof HTMLElement && document.contains(opener.current)) opener.current.focus({ preventScroll: true });
    }, 320);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.closing]);

  useEffect(() => {
    if (!top) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onRequestClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [top, onRequestClose]);

  // Swipe down to close (phones): from anywhere on the sheet while it's scrolled to the top.
  // Native touch listeners so the drag can take over from scrolling (needs passive: false).
  const closeRef = useRef(onRequestClose);
  closeRef.current = onRequestClose;
  useEffect(() => {
    const el = sheet.current;
    if (!el) return;
    let start: { x: number; y: number; t: number } | null = null;
    const onStart = (e: TouchEvent) => {
      if (window.innerWidth >= 640 || e.touches.length > 1) return;
      const t = e.target as HTMLElement;
      // Leave sliders and text areas alone; sideways swipes (chip rows) are ignored below.
      if (t.closest('input[type="range"], textarea')) return;
      start = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
    };
    const onMove = (e: TouchEvent) => {
      if (!start) return;
      const dy = e.touches[0].clientY - start.y, dx = e.touches[0].clientX - start.x;
      if (!drag.current) {
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 6) { start = null; return; }
        if (dy < 6) { if (dy < -6) start = null; return; }
        if (el.scrollTop > 0) { start = null; return; }
        drag.current = { y0: start.y, dy: 0 };
        el.style.transition = 'none';
      }
      e.preventDefault();
      drag.current.dy = Math.max(0, dy);
      el.style.transform = `translateY(${drag.current.dy}px)`;
    };
    const onEnd = () => {
      const d = drag.current, s0 = start;
      start = null;
      if (!d) return;
      drag.current = null;
      el.style.transition = '';
      const fast = s0 && d.dy > 40 && d.dy / (Date.now() - s0.t) > 0.6;
      if (d.dy > 110 || fast) closeRef.current();
      else el.style.transform = '';
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  return (
    <div className={shown ? 'sheet-wrap in' : 'sheet-wrap'}>
      <div className="scrim" onClick={onRequestClose} />
      <div ref={sheet} className={item.opts.tall ? 'sheet tall' : 'sheet'} role="dialog" aria-modal="true"
        aria-label={item.opts.label} tabIndex={-1}>
        <div className="grab"><i /></div>
        {item.render(onRequestClose)}
      </div>
    </div>
  );
}
