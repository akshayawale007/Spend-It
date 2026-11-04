'use client';
import { useEffect } from 'react';
import { store, useStore } from '@/lib/store';
import { useMonthData } from '@/hooks/useMonthData';
import { AppProvider, useApp, type AppUser } from './AppContext';
import { CompactBar, Controls, DeskHeader, Dock, Fab, Sidebar } from './Chrome';
import { ExpenseList } from './ExpenseList';
import { Hero } from './Hero';
import { Insights, SpendByCategory } from './Insights';
import { ProfilePage } from './ProfilePage';
import { SettingsPage } from './SettingsPage';
import { SheetProvider } from './Sheet';
import { SyncNotice, SyncToasts } from './SyncNotice';
import { ToastProvider } from './Toast';
import type { ExpenseWithEntries } from '@/lib/types';

export function AppShell({ user }: { user: AppUser }) {
  useEffect(() => { store.init(user.id, user.mode); }, [user.id, user.mode]);
  return (
    <AppProvider user={user}>
      <ToastProvider>
        <SheetProvider>
          <SyncToasts />
          <Main />
        </SheetProvider>
      </ToastProvider>
    </AppProvider>
  );
}

function Main() {
  const { month, tab } = useApp();
  const loaded = useStore(s => s.loaded);
  const { incomes, expenses, totals, closed } = useMonthData(month);

  return (
    <div className="shell">
      <Sidebar />
      <Controls />
      <CompactBar totals={totals} closed={closed} />
      <main className="app" data-tab={tab}>
        <DeskHeader />
        {tab === 'set' ? (
          <SettingsPage />
        ) : tab === 'me' ? (
          <ProfilePage />
        ) : !loaded ? (
          <div className="loading" role="status">Loading your month…</div>
        ) : tab === 'exp' ? (
          // Phones: one column. Laptops: balance column + list. Wide screens: + category column.
          <section id="view-exp" className="exp-grid">
            <div className="col-side">
              <Hero incomes={incomes} totals={totals} closed={closed} />
              <SyncNotice />
              <CategoryCard expenses={expenses} total={totals.spent} className="desk-only two-col-only" />
            </div>
            <div className="col-main">
              <ExpenseList expenses={expenses} />
            </div>
            <div className="col-extra">
              <CategoryCard expenses={expenses} total={totals.spent} />
            </div>
          </section>
        ) : (
          <Insights expenses={expenses} totals={totals} closed={closed} />
        )}
      </main>
      {tab === 'exp' && <Fab />}
      <Dock />
    </div>
  );
}

function CategoryCard({ expenses, total, className = '' }: { expenses: ExpenseWithEntries[]; total: number; className?: string }) {
  return (
    <div className={`ins-card glass cat-card side-cat ${className}`}>
      {total
        ? <SpendByCategory expenses={expenses} total={total} title="This month by category" />
        : <><div className="ins-title">This month by category</div><p className="side-empty">No spending logged yet.</p></>}
    </div>
  );
}
