import { describe, expect, it } from 'vitest';
import { defaultDate, fmt, fullDate, parseAmt, shiftKey } from '@/lib/format';
import { autoPickCategory, matchCategoryName, nextColor, PALETTE } from '@/lib/categories';

describe('fullDate', () => {
  it('formats DD Mon YYYY without locale quirks', () => {
    expect(fullDate('2026-09-03')).toBe('03 Sep 2026');
    expect(fullDate('2026-11-30')).toBe('30 Nov 2026');
    expect(fullDate('')).toBe('');
    expect(fullDate(null)).toBe('');
  });
});

describe('money', () => {
  it('uses en-IN grouping', () => {
    expect(fmt(100000)).toBe('₹1,00,000');
    expect(fmt(12345678.5)).toBe('₹1,23,45,678.5');
    expect(fmt(2000)).toBe('₹2,000');
    expect(fmt(-500)).toBe('−₹500');
    expect(fmt(0)).toBe('₹0');
  });

  it('parses amounts, max 2 decimals', () => {
    expect(parseAmt('1,200.50')).toBe(1200.5);
    expect(parseAmt('₹ 300')).toBe(300);
    expect(parseAmt('1.234')).toBeNaN();
    expect(parseAmt('abc')).toBeNaN();
    expect(parseAmt('')).toBeNaN();
    expect(parseAmt('-5')).toBeNaN();
  });
});

describe('months', () => {
  it('shifts across years', () => {
    expect(shiftKey('2026-01', -1)).toBe('2025-12');
    expect(shiftKey('2026-12', 1)).toBe('2027-01');
  });
  it('default spend date', () => {
    const now = new Date(2026, 10, 3);
    expect(defaultDate('2026-11', now)).toBe('2026-11-03');
    expect(defaultDate('2026-10', now)).toBe('2026-10-01');
  });
});

describe('categories', () => {
  it('auto-picks by keyword', () => {
    expect(matchCategoryName('Petrol')).toBe('Fuel');
    expect(matchCategoryName('Zomato order')).toBe('Food & Dining');
    expect(matchCategoryName('Netflix')).toBe('Subscriptions');
    expect(matchCategoryName('Credit card bill')).toBe('Bills & Utilities');
    expect(matchCategoryName('Car EMI')).toBe('EMI & Loans');
    expect(matchCategoryName('Premium plan')).toBeNull();
    expect(matchCategoryName('Something')).toBeNull();
  });
  it('maps to the user category by name', () => {
    const cats = [{ id: 'a', name: 'fuel', color: '#000000', sort_order: 0, created_at: '' }];
    expect(autoPickCategory('diesel', cats)?.id).toBe('a');
    expect(autoPickCategory('milk', cats)).toBeNull();
  });
  it('next colour skips used ones', () => {
    expect(nextColor([{ color: PALETTE[0].toLowerCase() }])).toBe(PALETTE[1]);
  });
});
