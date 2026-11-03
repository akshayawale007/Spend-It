'use client';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { I } from './icons';

type ToastFn = (msg: string, undo?: () => void) => void;
const Ctx = createContext<ToastFn>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [t, setT] = useState<{ msg: string; undo?: () => void; show: boolean }>({ msg: '', show: false });
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const toast = useCallback<ToastFn>((msg, undo) => {
    setT({ msg, undo, show: true });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setT(s => ({ ...s, show: false })), undo ? 5000 : 2600);
  }, []);

  return (
    <Ctx.Provider value={toast}>
      {children}
      <div className={t.show ? 'toast show' : 'toast'} role="status" aria-live="polite">
        <span className="msg">{t.msg}</span>
        {t.undo && (
          <button type="button" tabIndex={t.show ? 0 : -1} onClick={() => { t.undo?.(); setT(s => ({ ...s, show: false, undo: undefined })); }}>
            <I.undo /> Undo
          </button>
        )}
      </div>
    </Ctx.Provider>
  );
}
