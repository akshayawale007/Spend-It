'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { addCategory, addOwner, deleteCategory, deleteOwner, updateCategory, updateOwner } from '@/lib/actions';
import { fallbackCategory, PALETTE } from '@/lib/categories';
import { store, useStore } from '@/lib/store';
import type { Category, Owner } from '@/lib/types';
import { useCategories, useOwners } from '@/hooks/useMonthData';
import { useApp } from './AppContext';
import { I } from './icons';
import { useSheets } from './Sheet';
import { useToast } from './Toast';
import { cssVar, shake } from './util';

/** Settings: categories and owners. Data, account and help live in the profile sheet. */
export function SettingsPage() {
  const toast = useToast();
  const { confirm } = useSheets();
  const { setTab } = useApp();
  const categories = useCategories();
  const expenses = useStore(s => s.data.expenses);
  const [openPal, setOpenPal] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const newRef = useRef<HTMLInputElement>(null);

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

  return (
    <section id="view-set">
      <div className="page-h">
        <button className="icon-btn back-btn" aria-label="Back to profile" onClick={() => setTab('me')}><I.left /></button>
        <h1>Settings</h1>
      </div>
      <div className="set-sec"><h4>Expense categories</h4>
        <div className="set-card">
          {categories.map(c => (
            <NamedRow key={c.id} c={c} kind="category" count={usage[c.id] ?? 0} palOpen={openPal === c.id}
              onTogglePal={() => setOpenPal(openPal === c.id ? null : c.id)} onDelete={() => removeCat(c)}
              onSave={patch => {
                const cur = store.get().data.categories.find(x => x.id === c.id);
                if (cur) updateCategory({ ...cur, ...patch });
              }} />
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
      <OwnersSection openPal={openPal} setOpenPal={setOpenPal} />
    </section>
  );
}

/** Owners: who a spend was for. Deleting one leaves its spends unassigned. */
function OwnersSection({ openPal, setOpenPal }: { openPal: string | null; setOpenPal: (id: string | null) => void }) {
  const { confirm } = useSheets();
  const owners = useOwners();
  const expenses = useStore(s => s.data.expenses);
  const entries = useStore(s => s.data.entries);
  const [newName, setNewName] = useState('');
  const newRef = useRef<HTMLInputElement>(null);

  const usage = useMemo(() => {
    const u: Record<string, number> = {};
    for (const e of expenses) if (e.kind === 'spent' && e.owner_id) u[e.owner_id] = (u[e.owner_id] ?? 0) + 1;
    for (const x of entries) if (x.owner_id) u[x.owner_id] = (u[x.owner_id] ?? 0) + 1;
    return u;
  }, [expenses, entries]);

  const remove = async (o: Owner) => {
    const n = usage[o.id] ?? 0;
    const ok = await confirm({
      title: `Delete “${o.name}”?`,
      text: n
        ? <>{n} spend{n > 1 ? 's belong' : ' belongs'} to {o.name}. {n > 1 ? 'They’ll' : 'It’ll'} become <b>unassigned</b>.</>
        : 'No spends belong to this owner.',
      ok: 'Delete owner',
      danger: true,
    });
    if (ok) deleteOwner(o.id);
  };

  return (
    <div className="set-sec"><h4>Owners</h4>
      <div className="set-card">
        {owners.map(o => (
          <NamedRow key={o.id} c={o} kind="owner" count={usage[o.id] ?? 0} palOpen={openPal === o.id}
            onTogglePal={() => setOpenPal(openPal === o.id ? null : o.id)} onDelete={() => remove(o)}
            onSave={patch => {
              const cur = store.get().data.owners.find(x => x.id === o.id);
              if (cur) updateOwner({ ...cur, ...patch });
            }} />
        ))}
        <form className="add-cat" onSubmit={e => {
          e.preventDefault();
          if (!newName.trim()) return shake(newRef.current);
          addOwner(newName);
          setNewName('');
          newRef.current?.focus();
        }}>
          <input ref={newRef} className="input" name="owner" placeholder="New owner, e.g. Office" maxLength={40}
            value={newName} onChange={e => setNewName(e.target.value)} aria-label="New owner name" />
          <button className="btn-ink" type="submit">Add</button>
        </form>
      </div>
    </div>
  );
}

function NamedRow({ c, kind, count, palOpen, onTogglePal, onDelete, onSave }: {
  c: Category | Owner; kind: 'category' | 'owner'; count: number; palOpen: boolean;
  onTogglePal: () => void; onDelete: () => void; onSave: (patch: { name?: string; color?: string }) => void;
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
      if (n && n !== c.name) onSave({ name: n });
    }, 400);
  };
  const setColor = (color: string) => onSave({ color: color.toUpperCase() });

  return (
    <>
      <div className="cat-row" style={cssVar(c.color)}>
        <button className="swatch" aria-label={`Change colour of ${c.name}`} aria-expanded={palOpen} onClick={onTogglePal} />
        <input className="cat-name" value={name} maxLength={40} aria-label={kind === 'owner' ? 'Owner name' : 'Category name'}
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
