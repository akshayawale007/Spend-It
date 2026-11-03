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

  const requestClose = useCallback((id: number) => {
    const item = stackRef.current.find(s => s.id === id);
    if (!item || item.closing) return;
    item.opts.onClose?.();
    setStack(s => s.map(x => (x.id === id ? { ...x, closing: true } : x)));
  }, []);

  const open = useCallback<Api['open']>((render, opts = {}) => {
    const id = ++seq;
    setStack(s => [...s, { id, render, opts, closing: false }]);
    return () => requestClose(id);
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

  const onDown = (e: React.PointerEvent) => {
    if (window.innerWidth >= 640 || !sheet.current) return;
    drag.current = { y0: e.clientY, dy: 0 };
    sheet.current.style.transition = 'none';
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current || !sheet.current) return;
    drag.current.dy = Math.max(0, e.clientY - drag.current.y0);
    sheet.current.style.transform = `translateY(${drag.current.dy}px)`;
  };
  const onUp = () => {
    if (!drag.current || !sheet.current) return;
    const { dy } = drag.current;
    drag.current = null;
    sheet.current.style.transition = '';
    if (dy > 90) onRequestClose();
    else sheet.current.style.transform = '';
  };

  return (
    <div className={shown ? 'sheet-wrap in' : 'sheet-wrap'}>
      <div className="scrim" onClick={onRequestClose} />
      <div ref={sheet} className={item.opts.tall ? 'sheet tall' : 'sheet'} role="dialog" aria-modal="true"
        aria-label={item.opts.label} tabIndex={-1}>
        <div className="grab" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}><i /></div>
        {item.render(onRequestClose)}
      </div>
    </div>
  );
}
