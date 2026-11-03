'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { addCategory, deleteCategory, updateCategory } from '@/lib/actions';
import { backupToData, dataToBackup, parseBackup } from '@/lib/backup';
import { fallbackCategory, PALETTE } from '@/lib/categories';
import { todayISO } from '@/lib/format';
import { store, useStore, type SyncState } from '@/lib/store';
import { createClient } from '@/lib/supabase/client';
import type { Category } from '@/lib/types';
import { useCategories } from '@/hooks/useMonthData';
import { useApp } from './AppContext';
import { I } from './icons';
import { useSheets } from './Sheet';
import { useToast } from './Toast';
import { cssVar, shake } from './util';

const SYNC_TEXT: Record<SyncState, string> = {
  saved: 'Saved',
  saving: 'Saving…',
  offline: 'Offline — changes are kept on this device and sync when you’re back online',
  error: 'Can’t reach the server — changes are saved on this device and will sync automatically',
  local: 'Saved on this device only',
};

/** Settings: its own page (a tab on desktop, the top-right button on phones). */
export function SettingsPage() {
  const toast = useToast();
  const { confirm } = useSheets();
  const { user } = useApp();
  const categories = useCategories();
  const expenses = useStore(s => s.data.expenses);
  const sync = useStore(s => s.sync);
  const pending = useStore(s => s.pending);
  const [openPal, setOpenPal] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const newRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const usage = useMemo(() => {
    const u: Record<string, number> = {};
    for (const e of expenses) if (e.category_id) u[e.category_id] = (u[e.category_id] ?? 0) + 1;
    return u;
  }, [expenses]);

  const removeCat = async (c: Category) => {
    if (categories.length <= 1) return toast('Keep at least one category');
    const n = usage[c.id] ?? 0;
    const target = fallbackCategory(categories, c.id)!;
    const ok = await confirm({
      title: `Delete “${c.name}”?`,
      text: n
        ? <>{n} expense{n > 1 ? 's use' : ' uses'} {c.name}. {n > 1 ? 'They’ll' : 'It’ll'} move to <b>{target.name}</b>.</>
        : 'This category isn’t used anywhere.',
      ok: 'Delete category',
      danger: true,
    });
    if (ok) deleteCategory(c.id);
  };

  const exportFile = () => {
    try {
      const blob = new Blob([JSON.stringify(dataToBackup(store.get().data), null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `spendit-backup-${todayISO()}.json`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      toast('Backup file downloaded');
    } catch {
      toast('Couldn’t create the backup file');
    }
  };

  const importFile = async (file: File) => {
    let text = '';
    try { text = await file.text(); } catch { /* unreadable */ }
    const parsed = parseBackup(text);
    if (!parsed) return toast('That doesn’t look like a tracker backup');
    const { monthCount: m, expenseCount: n } = parsed;
    const ok = await confirm({
      title: 'Import this backup?',
      text: `It has ${m} month${m === 1 ? '' : 's'} and ${n} expense${n === 1 ? '' : 's'}. It replaces everything currently in the tracker.`,
      ok: 'Import backup',
      danger: true,
    });
    if (!ok) return;
    const res = await store.replaceAll(backupToData(parsed.backup));
    toast(res.ok ? 'Backup imported' : res.reason);
  };

  const signOut = async () => {
    if (store.get().pending) {
      const ok = await confirm({
        title: 'Sign out now?',
        text: `${store.get().pending} change${store.get().pending > 1 ? 's haven’t' : ' hasn’t'} synced yet and will be lost.`,
        ok: 'Sign out anyway',
        danger: true,
      });
      if (!ok) return;
    }
    await store.signOut();
    await createClient().auth.signOut();
    try { for (const k of await caches.keys()) await caches.delete(k); } catch { /* no cache API */ }
    window.location.href = '/login';
  };

  return (
    <section id="view-set">
      <div className="page-h"><h1>Settings</h1></div>
      <div className="set-grid">
        <div className="set-col">
          <div className="set-sec"><h4>Expense categories</h4>
            <div className="set-card">
              {categories.map(c => (
                <CategoryRow key={c.id} c={c} count={usage[c.id] ?? 0} palOpen={openPal === c.id}
                  onTogglePal={() => setOpenPal(openPal === c.id ? null : c.id)} onDelete={() => removeCat(c)} />
              ))}
              <form className="add-cat" onSubmit={e => {
                e.preventDefault();
                if (!newName.trim()) return shake(newRef.current);
                addCategory(newName);
                setNewName('');
                newRef.current?.focus();
              }}>
                <input ref={newRef} className="input" name="name" placeholder="New category, e.g. Pets" maxLength={40}
                  value={newName} onChange={e => setNewName(e.target.value)} aria-label="New category name" />
                <button className="btn-ink" type="submit">Add</button>
              </form>
            </div>
          </div>
        </div>
        <div className="set-col">
          <div className="set-sec"><h4>Your data</h4>
            <div className="set-card">
              <div className={`sync ${sync === 'saved' ? 'synced' : sync === 'saving' ? 'syncing' : sync}`} role="status">
                <i /><span>{SYNC_TEXT[sync]}{pending && sync !== 'saving' ? ` · ${pending} pending` : ''}</span>
              </div>
              <div className="data-btns">
                <button className="ghost" onClick={exportFile}><I.down /> Export backup</button>
                <button className="ghost" onClick={() => fileRef.current?.click()}><I.up /> Import backup</button>
                <input ref={fileRef} type="file" accept=".json,application/json,text/plain" hidden onChange={e => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) void importFile(f);
                }} />
              </div>
            </div>
          </div>

          <div className="set-sec"><h4>Account</h4>
            <div className="set-card">
              {user.mode === 'cloud' ? (
                <div className="acct">
                  {user.avatar
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={user.avatar} alt="" referrerPolicy="no-referrer" />
                    : <span className="av">{(user.name || user.email || '?').slice(0, 1).toUpperCase()}</span>}
                  <span className="who"><b>{user.name || user.email}</b>{user.name && <span>{user.email}</span>}</span>
                  <button className="ghost" onClick={signOut}><I.logout /> Sign out</button>
                </div>
              ) : (
                <div className="acct">
                  <span className="av">?</span>
                  <span className="who">
                    <b>Not signed in</b>
                    <span>{user.canSignIn ? 'Sign in to sync this device’s data' : 'Supabase isn’t connected yet'}</span>
                  </span>
                  {user.canSignIn && <a className="ghost" href="/login">Sign in</a>}
                </div>
              )}
            </div>
          </div>

          <div className="set-sec"><h4>How the numbers work</h4>
            <div className="set-card"><div className="howto">
              <b>Available</b> = income − expected budgets − one-off spends.<br />
              <b>ABB</b> (actual bank balance) = income − everything actually spent so far.<br />
              If an expected budget goes over, the actual amount spent is subtracted instead.<br />
              Unused budget stays <b>reserved until the month ends</b>, then it’s released and only what you actually spent counts.<br />
              A budget gets the green tick automatically once it’s 100% spent.<br />
              Every month starts from zero. <b>Copy budgets</b> brings last month’s expected list (not money) forward.
            </div></div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CategoryRow({ c, count, palOpen, onTogglePal, onDelete }: {
  c: Category; count: number; palOpen: boolean; onTogglePal: () => void; onDelete: () => void;
}) {
  const [name, setName] = useState(c.name);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Follow renames that arrive from elsewhere while not typing.
  useEffect(() => { if (!timer.current) setName(c.name); }, [c.name]);

  const onName = (v: string) => {
    setName(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = undefined;
      const n = v.trim().slice(0, 40);
      const cur = store.get().data.categories.find(x => x.id === c.id);
      if (n && cur && n !== cur.name) updateCategory({ ...cur, name: n });
    }, 400);
  };
  const setColor = (color: string) => {
    const cur = store.get().data.categories.find(x => x.id === c.id);
    if (cur) updateCategory({ ...cur, color: color.toUpperCase() });
  };

  return (
    <>
      <div className="cat-row" style={cssVar(c.color)}>
        <button className="swatch" aria-label={`Change colour of ${c.name}`} aria-expanded={palOpen} onClick={onTogglePal} />
        <input className="cat-name" value={name} maxLength={40} aria-label="Category name"
          onChange={e => onName(e.target.value)} onBlur={() => { if (!name.trim()) setName(c.name); }} />
        <span className="cat-count">{count ? `${count} used` : ''}</span>
        <button className="icon-btn" aria-label={`Delete ${c.name}`} onClick={onDelete}><I.trash /></button>
      </div>
      {palOpen && (
        <div className="palette">
          {PALETTE.map(p => (
            <button key={p} style={cssVar(p)} aria-pressed={p.toUpperCase() === c.color.toUpperCase()} aria-label={`Colour ${p}`}
              onClick={() => setColor(p)} />
          ))}
          <label title="Custom colour">+<input type="color" value={c.color.toLowerCase()} aria-label="Custom colour"
            onChange={e => setColor(e.target.value)} /></label>
        </div>
      )}
    </>
  );
}
