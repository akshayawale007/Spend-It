'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { curKey } from '@/lib/format';
import { scrollTop } from './util';

export type AppUser = {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  /** cloud = signed in and syncing; local = saved on this device only */
  mode: 'cloud' | 'local';
  /** Supabase is configured, so a local user can sign in to sync. */
  canSignIn: boolean;
};
export type Tab = 'exp' | 'spn' | 'ins' | 'set' | 'me';

type Ctx = {
  user: AppUser;
  month: string;
  goMonth: (k: string) => void;
  tab: Tab;
  setTab: (t: Tab) => void;
  /** Category the expense list is filtered to ('' = uncategorised), or null for all. */
  catFilter: string | null;
  setCatFilter: (id: string | null) => void;
  heroOpen: boolean;
  setHeroOpen: (v: boolean) => void;
  isExpanded: (id: string) => boolean;
  setExpanded: (id: string, open: boolean) => void;
  /** Insights what-if: card and spend ids left out of the numbers. Cleared when the month changes. */
  unticked: ReadonlySet<string>;
  toggleTick: (id: string) => void;
  tickAll: () => void;
};

const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => useContext(AppCtx)!;

const UI_KEY = 'spendit:ui';

export function AppProvider({ user, children }: { user: AppUser; children: ReactNode }) {
  const [month, setMonth] = useState(() => curKey());
  const [tab, setTabState] = useState<Tab>('exp');
  const [heroOpen, setHeroOpen] = useState(false);
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [expanded, setExpandedSet] = useState<Set<string>>(() => new Set());
  const [unticked, setUnticked] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    try { const t = JSON.parse(localStorage.getItem(UI_KEY) || '{}').tab; if (t === 'ins' || t === 'spn') setTabState(t); } catch { /* ignore */ }
  }, []);

  const setTab = useCallback((t: Tab) => {
    setTabState(t);
    // Only the main views are remembered; Settings and Profile aren't where you want to land on reload.
    if (t === 'exp' || t === 'ins' || t === 'spn') try { localStorage.setItem(UI_KEY, JSON.stringify({ tab: t })); } catch { /* ignore */ }
  }, []);

  const goMonth = useCallback((k: string) => {
    setMonth(k);
    setUnticked(new Set());
    scrollTop();
  }, []);

  const toggleTick = useCallback((id: string) => {
    setUnticked(s => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }, []);
  const tickAll = useCallback(() => setUnticked(new Set()), []);

  const setExpanded = useCallback((id: string, open: boolean) => {
    setExpandedSet(s => {
      if (s.has(id) === open) return s;
      const n = new Set(s);
      if (open) n.add(id); else n.delete(id);
      return n;
    });
  }, []);

  const value = useMemo<Ctx>(() => ({
    user, month, goMonth, tab, setTab, catFilter, setCatFilter, heroOpen, setHeroOpen,
    isExpanded: id => expanded.has(id), setExpanded, unticked, toggleTick, tickAll,
  }), [user, month, goMonth, tab, setTab, catFilter, heroOpen, expanded, setExpanded, unticked, toggleTick, tickAll]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
