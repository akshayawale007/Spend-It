'use client';
import { useRef } from 'react';
import { backupToData, dataToBackup, parseBackup } from '@/lib/backup';
import { todayISO } from '@/lib/format';
import { store, useStore, type SyncState } from '@/lib/store';
import { createClient } from '@/lib/supabase/client';
import { useApp, type AppUser } from './AppContext';
import { I } from './icons';
import { useSheets } from './Sheet';
import { useToast } from './Toast';

const SYNC_TEXT: Record<SyncState, string> = {
  saved: 'Saved',
  saving: 'Saving…',
  offline: 'Offline — changes are kept on this device and sync when you’re back online',
  error: 'Can’t reach the server — changes are saved on this device and will sync automatically',
  local: 'Saved on this device only',
};

/** Round avatar: Google photo, else the first letter. */
export function Avatar({ user }: { user: AppUser }) {
  return user.avatar
    // eslint-disable-next-line @next/next/no-img-element
    ? <img className="av" src={user.avatar} alt="" referrerPolicy="no-referrer" />
    : <span className="av">{user.mode === 'local' ? '?' : (user.name || user.email || '?').slice(0, 1).toUpperCase()}</span>;
}

const HOWTO: [string, string][] = [
  ['Available', 'Income minus your expected budgets and one-off spends. This is what you can still plan with.'],
  ['ABB (actual bank balance)', 'Income minus everything you’ve actually spent so far.'],
  ['When a budget goes over', 'The actual amount spent is subtracted instead of the budget.'],
  ['At the end of the month', 'Unused budget stays reserved until the month ends. Then it’s released and only what you actually spent counts.'],
  ['Green tick', 'A budget gets it automatically once it’s 100% spent.'],
  ['A new month', 'Every month starts from zero. Copy budgets brings last month’s expected list forward, not the money.'],
];

/** Profile page: your data, account and how the numbers work. Opened from the avatar (phones) or the sidebar card (laptops). */
export function ProfilePage() {
  const toast = useToast();
  const { confirm } = useSheets();
  const { user } = useApp();
  const sync = useStore(s => s.sync);
  const pending = useStore(s => s.pending);
  const fileRef = useRef<HTMLInputElement>(null);

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
    <section id="view-me" className="profile">
      <div className="page-h"><h1>Profile</h1></div>
      <div className="prof-head glass">
        <Avatar user={user} />
        <b>{user.mode === 'local' ? 'Not signed in' : user.name || user.email}</b>
        <span>{user.mode === 'local' ? 'Data stays on this device' : user.email}</span>
      </div>

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
              <span className="who"><b>Signed in with Google</b><span>Your data syncs across your devices</span></span>
              <button className="ghost" onClick={signOut}><I.logout /> Sign out</button>
            </div>
          ) : (
            <div className="acct">
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
        <dl className="set-card howto">
          {HOWTO.map(([term, text]) => (
            <div key={term}><dt>{term}</dt><dd>{text}</dd></div>
          ))}
        </dl>
      </div>
    </section>
  );
}
