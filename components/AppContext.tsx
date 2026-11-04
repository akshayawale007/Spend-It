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
export type Tab = 'exp' | 'ins' | 'set' | 'me';

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

  useEffect(() => {
    try { if (JSON.parse(localStorage.getItem(UI_KEY) || '{}').tab === 'ins') setTabState('ins'); } catch { /* ignore */ }
  }, []);

  const setTab = useCallback((t: Tab) => {
    setTabState(t);
    // Only the two main views are remembered; Settings and Profile aren't where you want to land on reload.
    if (t === 'exp' || t === 'ins') try { localStorage.setItem(UI_KEY, JSON.stringify({ tab: t })); } catch { /* ignore */ }
  }, []);

  const goMonth = useCallback((k: string) => {
    setMonth(k);
    scrollTop();
  }, []);

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
    isExpanded: id => expanded.has(id), setExpanded,
  }), [user, month, goMonth, tab, setTab, catFilter, heroOpen, expanded, setExpanded]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
