'use client';
// Persistent chrome.
//  Phones (<1024px): top-right month pill + profile avatar, compact balance bar, bottom dock.
//  Laptops (≥1024px): sidebar, a sticky page header with the month switcher.
//  Both: a floating "New expense" button on the Expenses tab (see globals.css for which shows where).
import { useEffect, useState } from 'react';
import { curKey, fmt, monthLabel, monthShort, shiftKey } from '@/lib/format';
import { useStore, type SyncState } from '@/lib/store';
import type { Totals } from '@/lib/calc';
import { useApp, type Tab } from './AppContext';
import { ExpenseSheet } from './ExpenseSheet';
import { I } from './icons';
import { MonthPicker } from './MonthPicker';
import { Avatar } from './ProfilePage';
import { useSheets } from './Sheet';
import { scrollTop } from './util';

/** Switching tabs: tapping the active one scrolls to the top. */
function useGoTab() {
  const { tab, setTab } = useApp();
  return (t: Tab) => {
    if (tab === t) return scrollTop();
    setTab(t);
    window.scrollTo({ top: 0 });
  };
}

function useNewExpense() {
  const { month } = useApp();
  const { open } = useSheets();
  return () => open(close => <ExpenseSheet month={month} close={close} />, { label: 'New expense' });
}

function useMonthPicker() {
  const { open } = useSheets();
  return () => open(close => <MonthPicker close={close} />, { label: 'Choose month' });
}

export function Controls() {
  const { month, tab, user } = useApp();
  const go = useGoTab();
  const pickMonth = useMonthPicker();
  return (
    <div className="ctl">
      {(tab === 'exp' || tab === 'ins') && (
        <button className="mpill glass" aria-label={`${monthLabel(month)}, change month`} onClick={pickMonth}>
          {monthShort(month)} {month.slice(0, 4)}
        </button>
      )}
      <button className={tab === 'me' ? 'me-btn glass on' : 'me-btn glass'} aria-label="Profile, data and account"
        aria-pressed={tab === 'me'} onClick={() => go('me')}>
        <Avatar user={user} />
      </button>
    </div>
  );
}

export function CompactBar({ totals: t, closed }: { totals: Totals; closed: boolean }) {
  const { tab } = useApp();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (tab !== 'exp') { setShow(false); return; }
    let ticking = false;
    const check = () => {
      const hero = document.getElementById('hero');
      setShow(!!hero && hero.getBoundingClientRect().bottom < 76);
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { ticking = false; check(); });
    };
    check();
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll, { passive: true });
    return () => { removeEventListener('scroll', onScroll); removeEventListener('resize', onScroll); };
  }, [tab]);

  return (
    <>
      <div className={show ? 'topfade show' : 'topfade'} aria-hidden="true" />
      <button className={show ? 'mini show' : 'mini'} aria-label="Back to top" tabIndex={show ? 0 : -1} aria-hidden={!show}
        onClick={() => scrollTop()}>
        <span><small>{closed ? 'Left' : 'Available'}</small><b className={t.available < 0 ? 'neg' : undefined}>{fmt(t.available)}</b></span>
        <span className="sep" />
        <span className="sp"><small>ABB</small><b>{fmt(t.bank)}</b></span>
      </button>
    </>
  );
}

export function Dock() {
  const { tab } = useApp();
  const go = useGoTab();
  return (
    <nav className="dock glass" aria-label="Sections">
      <button className="tab" aria-selected={tab === 'exp'} onClick={() => go('exp')}><I.navExpenses /> Expenses</button>
      <button className="tab" aria-selected={tab === 'ins'} onClick={() => go('ins')}><I.navInsights /> Insights</button>
      <button className="tab" aria-selected={tab === 'set'} onClick={() => go('set')}><I.navSettings /> Settings</button>
    </nav>
  );
}

const SYNC_LABEL: Record<SyncState, string> = {
  saved: 'All changes saved',
  saving: 'Saving…',
  offline: 'Offline · saved on device',
  error: 'Can’t reach server · saved on device',
  local: 'Saved on this device',
};

/** Desktop navigation rail. Hidden on phones. */
export function Sidebar() {
  const { tab, user } = useApp();
  const go = useGoTab();
  const sync = useStore(s => s.sync);
  const pending = useStore(s => s.pending);
  const newExpense = useNewExpense();

  // "N" opens a new expense when nothing else has focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'n' || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable]') || document.body.classList.contains('locked')) return;
      if (window.innerWidth < 1024) return;
      e.preventDefault();
      newExpense();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });

  return (
    <aside className="side" aria-label="Sidebar">
      <div className="brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" width={48} height={48} />
        <b>Spendit</b>
      </div>

      <nav className="side-nav" aria-label="Sections">
        <button aria-current={tab === 'exp' ? 'page' : undefined} onClick={() => go('exp')}><I.navExpenses /> Expenses</button>
        <button aria-current={tab === 'ins' ? 'page' : undefined} onClick={() => go('ins')}><I.navInsights /> Insights</button>
        <button aria-current={tab === 'set' ? 'page' : undefined} onClick={() => go('set')}><I.navSettings /> Settings</button>
      </nav>

      <div className="side-foot">
        <div className={`side-sync ${sync}`} role="status">
          <i aria-hidden="true" />{SYNC_LABEL[sync]}{pending && sync !== 'saving' ? ` · ${pending} waiting` : ''}
        </div>
        <button className="side-me" aria-current={tab === 'me' ? 'page' : undefined} onClick={() => go('me')} aria-label="Profile, data and account">
          <Avatar user={user} />
          <span className="who">
            <b>{user.mode === 'local' ? 'Not signed in' : user.name || user.email}</b>
            <small>{user.mode === 'local' ? 'Data stays on this device' : user.email}</small>
          </span>
        </button>
      </div>
    </aside>
  );
}

const TITLES: Record<Tab, string> = { exp: 'Expenses', ins: 'Insights', set: 'Settings', me: 'Profile' };

/** Desktop page header: title on the left, month switcher sticky at the top right. */
export function DeskHeader() {
  const { tab, month, goMonth } = useApp();
  const pickMonth = useMonthPicker();
  return (
    <header className="desk-head">
      <h1>{TITLES[tab]}</h1>
      {(tab === 'exp' || tab === 'ins') && (
        <div className="month-sw glass">
          {month !== curKey() && <button className="month-now" onClick={() => goMonth(curKey())}>This month</button>}
          <button className="icon-btn" aria-label="Previous month" onClick={() => goMonth(shiftKey(month, -1))}><I.left /></button>
          <button className="month-label" aria-label={`${monthLabel(month)}, change month`} onClick={pickMonth}>
            {monthShort(month)} {month.slice(0, 4)}
          </button>
          <button className="icon-btn" aria-label="Next month" onClick={() => goMonth(shiftKey(month, 1))}><I.right /></button>
        </div>
      )}
    </header>
  );
}

/** Floating "New expense" button (Expenses tab): above the dock on phones, bottom right on laptops. */
export function Fab() {
  const newExpense = useNewExpense();
  return (
    <button className="fab" onClick={newExpense} aria-label="New expense" title="New expense (N)" aria-keyshortcuts="N">
      <I.plus />
    </button>
  );
}
