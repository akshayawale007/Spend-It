'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { addCategory, deleteExpense, newId, saveExpense, stamp } from '@/lib/actions';
import { entriesTotal } from '@/lib/calc';
import { autoPickCategory, fallbackCategory, NEUTRAL } from '@/lib/categories';
import { defaultDate, fmt, fullDate, monthLabel, parseAmt } from '@/lib/format';
import { store, useStore } from '@/lib/store';
import type { Entry, Expense, Kind } from '@/lib/types';
import { useCategories } from '@/hooks/useMonthData';
import { useApp } from './AppContext';
import { DateField } from './DateField';
import { I } from './icons';
import { liveOwner, OwnerPicker, ownerMissing } from './OwnerPicker';
import { useToast } from './Toast';
import { cssVar, shake } from './util';

export function ExpenseSheet({ month, expenseId, toKind, close }: {
  month: string; expenseId?: string; toKind?: Kind; close: () => void;
}) {
  const toast = useToast();
  const { setTab, setExpanded } = useApp();
  const categories = useCategories();
  // Snapshot of the expense when the sheet opened.
  const [exp] = useState<Expense | undefined>(() => (expenseId ? store.get().data.expenses.find(e => e.id === expenseId) : undefined));
  const [entries] = useState<Entry[]>(() => (expenseId ? store.get().data.entries.filter(x => x.expense_id === expenseId) : []));
  const allEntries = useStore(s => s.data.entries);
  const isNew = !exp;
  const origKind = exp?.kind ?? null;
  const entTotal = entriesTotal({ kind: 'expected', amount: 0, entries });
  const entCount = entries.length;

  const [kind, setKind] = useState<Kind>(exp ? toKind ?? exp.kind : 'expected');
  const [name, setName] = useState(exp?.name ?? '');
  const [amount, setAmount] = useState(exp ? String(exp.amount) : '');
  const [cat, setCat] = useState<string | null>(exp?.category_id ?? null);
  const [owner, setOwner] = useState<string | null>(exp?.owner_id ?? null);
  const [manualCat, setManualCat] = useState(!!exp);
  const [date, setDate] = useState(exp?.date ?? defaultDate(month));
  const [note, setNote] = useState(exp?.note ?? '');
  const [logFirst, setLogFirst] = useState(true);
  const [newCatOpen, setNewCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  const nameRef = useRef<HTMLInputElement>(null);
  const amtRef = useRef<HTMLInputElement>(null);
  const newCatRef = useRef<HTMLInputElement>(null);
  const catsRef = useRef<HTMLDivElement>(null);
  const ownRef = useRef<HTMLDivElement>(null);

  const catObj = categories.find(c => c.id === cat) ?? null;

  useEffect(() => {
    if (!isNew) return;
    const t = setTimeout(() => nameRef.current?.focus(), 350);
    return () => clearTimeout(t);
  }, [isNew]);

  // Keep the selected chip in view.
  useEffect(() => {
    const el = catsRef.current, sel = el?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (el && sel) el.scrollTo({ left: sel.offsetLeft - el.clientWidth / 2 + sel.offsetWidth / 2, behavior: 'smooth' });
  }, [cat, categories.length]);

  const changeKind = (k: Kind) => {
    if (k === kind) return;
    setKind(k);
    if (!exp || origKind !== 'expected' || !entCount) return;
    const a = parseAmt(amount);
    if (k === 'spent' && a === exp.amount) setAmount(String(entTotal));
    if (k === 'expected' && a === entTotal && entTotal !== exp.amount) setAmount(String(exp.amount));
  };

  const onName = (v: string) => {
    setName(v);
    if (manualCat) return;
    const c = autoPickCategory(v, categories);
    if (c) setCat(c.id);
  };

  const openBudget = !amount.trim() || parseAmt(amount) === 0;
  const hint = useMemo(() => {
    let h = kind === 'expected'
      ? 'Reserved from your balance now — log each payment under it as the month goes.'
      : 'A one-off payment you’ve already made.';
    if (exp && origKind === 'expected' && kind === 'spent' && entCount)
      h = `Amount set to ${fmt(entTotal)}, the total of ${entCount} logged spend${entCount > 1 ? 's' : ''}. They come back if you switch to expected.`;
    if (exp && origKind === 'spent' && kind === 'expected')
      h = entCount
        ? `Your ${entCount} earlier logged spend${entCount > 1 ? 's' : ''} (${fmt(entTotal)}) come back. Set the monthly budget above.`
        : 'Set the monthly budget above.';
    if (kind === 'expected' && openBudget && !(exp && origKind === 'spent'))
      h = 'No fixed budget — nothing is reserved. Only the spends you log are subtracted.';
    return h;
  }, [kind, exp, origKind, entCount, entTotal, openBudget]);

  const showConvert = !!exp && origKind === 'spent' && kind === 'expected' && !entCount;

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    const n = name.trim();
    if (!n) return shake(nameRef.current);
    // Expected can have no fixed budget: empty or 0.
    const a = kind === 'expected' && !amount.trim() ? 0 : parseAmt(amount);
    if (!(a > 0) && !(kind === 'expected' && a === 0)) return shake(amtRef.current);
    // A one-off spent card is itself a spend, so it needs an owner. On expected cards it's only the default for new spends.
    if (kind === 'spent' && ownerMissing(owner)) { toast('Pick who this spend is for'); return shake(ownRef.current); }
    const catId = categories.some(c => c.id === cat) ? cat : fallbackCategory(categories)?.id ?? null;
    const d = date || defaultDate(month);
    const ownerId = liveOwner(owner);
    if (isNew) {
      saveExpense({
        id: newId(), month_key: month, name: n, category_id: catId, owner_id: ownerId, kind, amount: a,
        date: kind === 'spent' ? d : null, note: note.trim(), created_at: stamp(),
      });
      toast(kind === 'expected' ? `${fmt(a)} reserved for ${n}` : `${fmt(a)} spent on ${n}`);
    } else {
      const first: Entry[] = [];
      // Entries may have been logged since the sheet opened; check the live list.
      const liveCount = allEntries.filter(x => x.expense_id === exp.id).length;
      if (showConvert && logFirst && !liveCount)
        first.push({ id: newId(), expense_id: exp.id, owner_id: exp.owner_id ?? null, amount: exp.amount, date: exp.date || defaultDate(month), note: exp.note, created_at: stamp() });
      saveExpense({ ...exp, name: n, amount: a, category_id: catId, owner_id: ownerId, kind, note: note.trim(), date: kind === 'spent' ? d : exp.date }, first);
      if (origKind !== kind) setExpanded(exp.id, true);
      toast('Saved');
    }
    if (isNew) setTab('exp'); // show a new card; edits stay on the tab they came from
    close();
  };

  const remove = () => {
    if (!exp) return;
    const undo = deleteExpense(exp);
    close();
    toast(`Deleted ${exp.name}`, undo);
  };

  const addCat = () => {
    const v = newCatName.trim();
    if (!v) return shake(newCatRef.current);
    const c = addCategory(v);
    setCat(c.id); setManualCat(true); setNewCatName(''); setNewCatOpen(false);
  };

  return (
    <>
      <div className="sh-head"><h3>{isNew ? 'New expense' : 'Edit expense'}</h3><p className="sub">{monthLabel(month)}</p></div>
      <form noValidate autoComplete="off" onSubmit={submit}>
        <div className="pv" style={cssVar(catObj?.color ?? NEUTRAL)}>
          <div className="seg" role="group" aria-label="Expense type">
            <button type="button" aria-pressed={kind === 'expected'} onClick={() => changeKind('expected')}>Expected</button>
            <button type="button" aria-pressed={kind === 'spent'} onClick={() => changeKind('spent')}>Spent</button>
          </div>
          <input ref={nameRef} className="pv-in pv-name" name="name" placeholder="Expense name, e.g. Petrol" aria-label="Name"
            value={name} onChange={e => onName(e.target.value)} maxLength={80} />
          <div className="pv-amt"><span>₹</span>
            <input ref={amtRef} className="pv-in" name="amount" inputMode="decimal" placeholder="0" aria-label="Amount"
              value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <div className="pv-foot">
            <span>{kind === 'expected' ? (openBudget ? 'No fixed budget' : 'Monthly budget') : 'Amount spent'}</span>
            {catObj && <span className="tag">{catObj.name}</span>}
          </div>
        </div>
        <p className="hint">{hint}</p>

        <div className="field">
          <div className="flabel"><span>Category</span></div>
          <div className="cat-scroll" ref={catsRef}>
            {categories.map(c => (
              <button key={c.id} type="button" className="chip" style={cssVar(c.color)} aria-pressed={c.id === cat}
                onClick={() => { setCat(c.id); setManualCat(true); }}>
                <span className="dot" />{c.name}
              </button>
            ))}
            <button type="button" className="chip add" aria-expanded={newCatOpen}
              onClick={() => { setNewCatOpen(o => !o); setTimeout(() => newCatRef.current?.focus(), 0); }}>
              <I.plusSm /> New
            </button>
          </div>
          {newCatOpen && (
            <div className="newcat">
              <input ref={newCatRef} className="input" placeholder="New category name" maxLength={40} value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCat(); } }} />
              <button type="button" className="btn-ink" onClick={addCat}>Add</button>
            </div>
          )}
        </div>

        <div className="field">
          <div className="flabel"><span>{kind === 'spent' ? 'Owner' : 'Default owner for spends'}</span>{kind === 'expected' && <> <span className="opt">optional</span></>}</div>
          <OwnerPicker value={owner} onChange={setOwner} required={kind === 'spent'} pickRef={ownRef} />
        </div>

        <div className="two" style={kind === 'spent' ? undefined : { gridTemplateColumns: '1fr' }}>
          {kind === 'spent' && (
            <div className="field"><div className="flabel">Date</div><DateField className="input" value={date ?? ''} onChange={setDate} /></div>
          )}
          <div className="field">
            <div className="flabel">Note <span className="opt">optional</span></div>
            <input className="input" name="note" placeholder="Anything to remember" value={note} onChange={e => setNote(e.target.value)} />
          </div>
        </div>

        {showConvert && exp && (
          <label className="check">
            <input type="checkbox" checked={logFirst} onChange={e => setLogFirst(e.target.checked)} />
            <span>Log the {fmt(exp.amount)} already spent{exp.date ? ` on ${fullDate(exp.date)}` : ''} as the first spend</span>
          </label>
        )}

        <button className="btn-primary" type="submit">{isNew ? 'Add expense' : 'Save changes'}</button>
        {!isNew && <button type="button" className="btn-text danger" onClick={remove}>Delete expense</button>}
      </form>
    </>
  );
}
