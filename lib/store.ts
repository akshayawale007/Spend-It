'use client';
// Local-first data store: optimistic updates, a persisted write queue with retry,
// and a localStorage cache so the app opens instantly and works offline.
//
// Two modes:
//  * cloud — signed in. Writes queue up on the device and flush to Supabase whenever it's
//    reachable. Conflicts are settled on the server: last write wins per row (updated_at),
//    and deleted rows leave tombstones so they can't come back.
//  * local — Supabase isn't set up, or it's unreachable and nobody has signed in yet.
//    Everything stays on the device and moves into the account at the next sign-in.
import { useSyncExternalStore } from 'react';
import { DEFAULT_CATEGORIES } from './categories';
import { hasLocalContent, localToOps } from './merge';
import { applyOps, type Op } from './ops';
import { createClient } from './supabase/client';
import type { Category, Data, TableName } from './types';
import { uuid } from './uuid';

export type SyncState = 'saved' | 'saving' | 'offline' | 'error' | 'local';
export type StoreMode = 'cloud' | 'local';

export type StoreState = {
  data: Data;
  loaded: boolean;
  sync: SyncState;
  pending: number;
  /** One-off message for the UI to toast (then clearNotice). */
  notice: string | null;
};

const EMPTY: Data = { categories: [], incomes: [], expenses: [], entries: [] };
const TABLES: TableName[] = ['categories', 'incomes', 'expenses', 'spend_entries'];
const PAGE = 1000;
const POLL_MS = 60_000;

export const LOCAL_UID = 'local';
const cacheKey = (uid: string) => `spendit:v1:${uid}`;

function isRetryable(status: number, message = '') {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  return status === 0 || status === 401 || status === 408 || status === 429 || status >= 500 || /fetch|network|timeout/i.test(message);
}

function clean(table: TableName, row: Record<string, unknown>) {
  const { user_id: _u, ...rest } = row;
  if ('amount' in rest && rest.amount != null) rest.amount = Number(rest.amount);
  if (table === 'categories') rest.sort_order = Number(rest.sort_order ?? 0);
  return rest;
}

/** Every upsert carries the time of the change; the server keeps the newest version. */
function stampOps(ops: Op[]): Op[] {
  const now = new Date().toISOString();
  return ops.map(op => (op.t === 'upsert' ? { ...op, rows: op.rows.map(r => ({ ...r, updated_at: now })) } : op));
}

const downState = () => (navigator.onLine ? 'error' : 'offline') as SyncState;

class Store {
  private state: StoreState = { data: EMPTY, loaded: false, sync: 'saved', pending: 0, notice: null };
  private listeners = new Set<() => void>();
  private queue: Op[] = [];
  private uid: string | null = null;
  private mode: StoreMode = 'cloud';
  private flushing = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private backoff = 1000;
  private refreshing: Promise<void> | null = null;
  private wired = false;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  get = () => this.state;

  private set(patch: Partial<StoreState>) {
    this.state = { ...this.state, ...patch, pending: this.queue.length };
    this.listeners.forEach(fn => fn());
  }

  clearNotice() { if (this.state.notice) this.set({ notice: null }); }

  private persist() {
    if (!this.uid) return;
    try {
      localStorage.setItem(cacheKey(this.uid), JSON.stringify({ data: this.state.data, queue: this.queue }));
    } catch { /* storage full or blocked */ }
  }

  init(uid: string, mode: StoreMode) {
    if (this.uid === uid) return;
    this.uid = uid;
    this.mode = mode;
    this.queue = [];
    let data = EMPTY;
    try {
      const raw = localStorage.getItem(cacheKey(uid));
      if (raw) {
        const c = JSON.parse(raw) as { data: Data; queue: Op[] };
        data = { ...EMPTY, ...c.data };
        if (mode === 'cloud' && Array.isArray(c.queue)) this.queue = c.queue;
      }
    } catch { /* ignore a corrupt cache */ }

    if (mode === 'local') {
      this.set({ data, loaded: true, sync: 'local' });
      if (!data.categories.length) this.seedCategories();
      this.persist();
      return;
    }

    this.set({ data, loaded: data !== EMPTY });
    if (!this.wired) {
      this.wired = true;
      window.addEventListener('online', () => this.refresh());
      window.addEventListener('offline', () => { if (this.mode === 'cloud') this.set({ sync: 'offline' }); });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') this.refresh();
      });
      // Pick up changes made on other devices.
      setInterval(() => { if (document.visibilityState === 'visible') this.refresh(); }, POLL_MS);
    }
    this.refresh();
  }

  /** Pushes pending writes, then reloads everything from Supabase. */
  refresh(): Promise<void> {
    if (this.mode !== 'cloud' || !this.uid) return Promise.resolve();
    return (this.refreshing ??= this.doRefresh().finally(() => { this.refreshing = null; }));
  }

  private async doRefresh() {
    if (!navigator.onLine) { this.set({ sync: 'offline', loaded: true }); return; }
    await this.flush();
    if (this.queue.length) { this.set({ loaded: true }); return; } // still can't reach the server
    try {
      const sb = createClient();
      const fetched = {} as Record<TableName, Record<string, unknown>[]>;
      await Promise.all(TABLES.map(async t => {
        const rows: Record<string, unknown>[] = [];
        for (let from = 0; ; from += PAGE) {
          const { data, error } = await sb.from(t).select('*').order('created_at').order('id').range(from, from + PAGE - 1);
          if (error) throw error;
          rows.push(...(data as Record<string, unknown>[]).map(r => clean(t, r)));
          if (data.length < PAGE) break;
        }
        fetched[t] = rows;
      }));
      let data = {
        categories: fetched.categories,
        incomes: fetched.incomes,
        expenses: fetched.expenses,
        entries: fetched.spend_entries,
      } as unknown as Data;
      // Writes made while we were fetching are replayed on top.
      data = applyOps(data, this.queue);
      this.backoff = 1000;
      this.set({ data, loaded: true, sync: this.queue.length ? 'saving' : 'saved' });
      this.persist();
      this.adoptLocalData();
      if (!this.state.data.categories.length) this.seedCategories();
    } catch (e) {
      console.warn('[spendit] refresh failed', e);
      this.set({ loaded: true, sync: downState() });
      this.scheduleRetry();
    }
  }

  /** Moves anything saved in device-only mode into this account (once). */
  private adoptLocalData() {
    let local: Data | null = null;
    try {
      const raw = localStorage.getItem(cacheKey(LOCAL_UID));
      if (raw) local = { ...EMPTY, ...(JSON.parse(raw) as { data: Data }).data };
    } catch { /* ignore */ }
    if (!local) return;
    if (hasLocalContent(local)) {
      this.apply(localToOps(local, this.state.data.categories));
      const n = local.incomes.length + local.expenses.length;
      this.set({ notice: `Synced ${n} item${n === 1 ? '' : 's'} saved on this device to your account` });
    }
    try { localStorage.removeItem(cacheKey(LOCAL_UID)); } catch { /* ignore */ }
  }

  private seedCategories() {
    const now = Date.now();
    const rows: Category[] = DEFAULT_CATEGORIES.map((c, i) => ({
      id: uuid(), name: c.name, color: c.color, sort_order: i, created_at: new Date(now + i).toISOString(),
    }));
    this.apply([{ t: 'upsert', table: 'categories', rows }]);
  }

  /** Applies ops locally right away and (in cloud mode) queues them for the server. */
  apply(ops: Op[]) {
    const stamped = stampOps(ops);
    const data = applyOps(this.state.data, stamped);
    if (this.mode === 'local') {
      this.set({ data });
      this.persist();
      return;
    }
    this.queue.push(...stamped);
    this.set({ data, sync: this.state.sync === 'offline' || this.state.sync === 'error' ? this.state.sync : 'saving' });
    this.persist();
    void this.flush();
  }

  private scheduleRetry() {
    if (this.retryTimer) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.refresh();
    }, this.backoff);
    this.backoff = Math.min(this.backoff * 2, 30000);
  }

  private async flush() {
    if (this.mode !== 'cloud' || this.flushing || !this.queue.length) return;
    if (!navigator.onLine) { this.set({ sync: 'offline' }); return; }
    this.flushing = true;
    const sb = createClient();
    let dropped = false;
    try {
      while (this.queue.length) {
        const op = this.queue[0];
        const res = op.t === 'upsert'
          ? await sb.from(op.table).upsert(op.rows.map(r => clean(op.table, r)) as never)
          : await sb.from(op.table).delete().in('id', op.ids);
        if (res.error) {
          if (isRetryable(res.status, res.error.message)) {
            this.set({ sync: downState() });
            this.scheduleRetry();
            return;
          }
          // A permanent failure (constraint, RLS…). Drop it and resync from the server.
          console.error('[spendit] write rejected', op, res.error);
          dropped = true;
        }
        this.queue.shift();
        this.persist();
        this.backoff = 1000;
      }
      this.set({ sync: 'saved' });
    } catch (e) {
      console.warn('[spendit] flush failed', e);
      this.set({ sync: downState() });
      this.scheduleRetry();
    } finally {
      this.flushing = false;
    }
    if (dropped) void this.refresh();
  }

  /** Replaces all of the user's data (backup import). In cloud mode this needs a connection. */
  async replaceAll(data: Data): Promise<{ ok: true } | { ok: false; reason: string }> {
    if (this.mode === 'local') {
      this.set({ data });
      this.persist();
      return { ok: true };
    }
    if (!navigator.onLine) return { ok: false, reason: 'You’re offline — connect and try again' };
    await this.flush();
    if (this.queue.length) return { ok: false, reason: 'Couldn’t sync pending changes — try again' };
    const sb = createClient();
    this.set({ sync: 'saving' });
    const { error } = await sb.rpc('replace_all_data', {
      p_categories: data.categories,
      p_incomes: data.incomes,
      p_expenses: data.expenses.map(e => clean('expenses', e as never)),
      p_entries: data.entries,
    } as never);
    if (error) {
      console.error('[spendit] replace failed', error);
      this.set({ sync: downState() });
      return { ok: false, reason: 'Couldn’t replace your data — nothing was changed' };
    }
    this.set({ data, sync: 'saved' });
    this.persist();
    return { ok: true };
  }

  /** Tries to push pending writes, then forgets this device's cache. */
  async signOut() {
    await this.flush().catch(() => {});
    if (this.uid) try { localStorage.removeItem(cacheKey(this.uid)); } catch { /* ignore */ }
    this.queue = [];
    this.uid = null;
    this.state = { data: EMPTY, loaded: false, sync: 'saved', pending: 0, notice: null };
  }
}

export const store = new Store();

export function useStore<T>(select: (s: StoreState) => T): T {
  return useSyncExternalStore(store.subscribe, () => select(store.get()), () => select(store.get()));
}
