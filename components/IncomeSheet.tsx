'use client';
import { useEffect, useRef, useState } from 'react';
import { deleteIncome, newId, saveIncome, stamp } from '@/lib/actions';
import { fmt, monthLabel, parseAmt } from '@/lib/format';
import type { Income } from '@/lib/types';
import { useApp } from './AppContext';
import { DateField } from './DateField';
import { useToast } from './Toast';
import { shake } from './util';

const SUGGESTIONS = ['Opening balance', 'Salary', 'Freelance', 'Interest', 'Refund', 'Gift'];

export function IncomeSheet({ month, income, preset, close }: { month: string; income?: Income; preset?: string; close: () => void }) {
  const toast = useToast();
  const { setHeroOpen } = useApp();
  const isNew = !income;
  const [amount, setAmount] = useState(income ? String(income.amount) : '');
  const [name, setName] = useState(income?.name ?? preset ?? '');
  const [date, setDate] = useState(income?.date ?? '');
  const amtRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isNew) return;
    const t = setTimeout(() => amtRef.current?.focus(), 350);
    return () => clearTimeout(t);
  }, [isNew]);

  return (
    <>
      <div className="sh-head"><h3>{isNew ? 'Add income' : 'Edit income'}</h3><p className="sub">{monthLabel(month)}</p></div>
      <form noValidate autoComplete="off" onSubmit={ev => {
        ev.preventDefault();
        const a = parseAmt(amount);
        if (!(a > 0)) return shake(amtRef.current);
        const n = name.trim() || 'Income';
        saveIncome(income
          ? { ...income, name: n, amount: a, date: date || null }
          : { id: newId(), month_key: month, name: n, amount: a, date: date || null, created_at: stamp() });
        setHeroOpen(true);
        close();
        toast(isNew ? `Added ${fmt(a)} · ${n}` : 'Income updated');
      }}>
        <div className="field">
          <div className="flabel">Amount</div>
          <div className="amount-wrap"><span>₹</span>
            <input ref={amtRef} className="input" name="amount" inputMode="decimal" placeholder="0" aria-label="Amount"
              value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <div className="flabel">Source</div>
          <input className="input" name="name" placeholder="e.g. Salary" aria-label="Source" value={name} onChange={e => setName(e.target.value)} />
          <div className="sugg">
            {SUGGESTIONS.map(s => (
              <button key={s} type="button" className="chip plain" aria-pressed={name === s} onClick={() => setName(s)}>{s}</button>
            ))}
          </div>
        </div>
        <div className="field">
          <div className="flabel">Date <span className="opt">optional</span></div>
          <DateField className="input" value={date} onChange={setDate} placeholder="Optional" />
        </div>
        <button className="btn-primary" type="submit">{isNew ? 'Add income' : 'Save'}</button>
        {income && (
          <button type="button" className="btn-text danger" onClick={() => {
            const undo = deleteIncome(income);
            close();
            toast(`Deleted ${income.name}`, undo);
          }}>Delete income</button>
        )}
      </form>
    </>
  );
}
