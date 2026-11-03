'use client';
import { fmt, fullDate } from '@/lib/format';
import type { Totals } from '@/lib/calc';
import type { Income } from '@/lib/types';
import { useApp } from './AppContext';
import { BigNumber } from './BigNumber';
import { Collapse } from './Collapse';
import { I } from './icons';
import { useSheets } from './Sheet';
import { IncomeSheet } from './IncomeSheet';

export function Hero({ incomes, totals: t, closed }: { incomes: Income[]; totals: Totals; closed: boolean }) {
  const { month, heroOpen, setHeroOpen } = useApp();
  const { open } = useSheets();
  const addIncome = (preset?: string) =>
    open(close => <IncomeSheet month={month} preset={preset} close={close} />, { label: 'Add income' });

  return (
    <section id="hero">
      <div className="hero glass">
        <button className="hero-hit" aria-expanded={heroOpen} aria-controls="heroX" onClick={() => setHeroOpen(!heroOpen)}>
          <span className="hero-row"><span className="eyebrow">{closed ? 'Left at month end' : 'Available to spend'}</span></span>
          <BigNumber key={month} value={t.available} />
          {t.available < 0 && <span className="neg-note">{fmt(-t.available)} more planned than you have</span>}
          <span className="hero-foot">
            <span className="fstats">
              <span className="v"><span>Spent</span><b>{fmt(t.spent)}</b></span>
              <span className="v"><span>ABB</span><b className={t.bank < 0 ? 'negv' : undefined}>{fmt(t.bank)}</b></span>
            </span>
            <span className="tap">{incomes.length ? 'Income' : 'Add balance'}<I.chevSm /></span>
          </span>
        </button>
        <Collapse open={heroOpen} id="heroX">
          {incomes.length ? (
            <>
              <div className="inc-h"><span>Income sources</span><b>{fmt(t.funds)}</b></div>
              {incomes.map(i => (
                <button key={i.id} className="inc"
                  onClick={() => open(close => <IncomeSheet month={month} income={i} close={close} />, { label: 'Edit income' })}>
                  <span className="ic"><I.inc /></span>
                  <span className="n">{i.name}{i.date && <small>{fullDate(i.date)}</small>}</span>
                  <span className="a">{fmt(i.amount)}</span>
                </button>
              ))}
            </>
          ) : (
            <button className="cta-balance" onClick={() => addIncome('Opening balance')}><I.plusSm /> Add your account balance</button>
          )}
          <button className="ghost" style={{ marginTop: 2 }} onClick={() => addIncome()}><I.plusSm /> Add income source</button>
        </Collapse>
      </div>
    </section>
  );
}
