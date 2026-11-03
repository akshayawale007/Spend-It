import type { Category } from './types';

export const PALETTE = [
  '#F7A68C', '#F8C78A', '#EED97A', '#8FD9A8', '#A9C9A4', '#7FD1D9', '#8DB8F2',
  '#A3A8F0', '#C3A6EE', '#F2A7C9', '#EE9A9A', '#D9C2A3', '#A8B4C4', '#D6B4E8',
];

export const DEFAULT_CATEGORIES: { name: string; color: string }[] = [
  { name: 'Fuel', color: '#F8C78A' },
  { name: 'Groceries', color: '#8FD9A8' },
  { name: 'Rent & Housing', color: '#A3A8F0' },
  { name: 'Bills & Utilities', color: '#7FD1D9' },
  { name: 'Food & Dining', color: '#F7A68C' },
  { name: 'Transport', color: '#8DB8F2' },
  { name: 'Shopping', color: '#F2A7C9' },
  { name: 'Health', color: '#EE9A9A' },
  { name: 'Entertainment', color: '#C3A6EE' },
  { name: 'EMI & Loans', color: '#A8B4C4' },
  { name: 'Subscriptions', color: '#D6B4E8' },
  { name: 'Other', color: '#D9C2A3' },
];

export const NEUTRAL = '#D9C2A3';
export const UNCATEGORISED: Pick<Category, 'name' | 'color'> = { name: 'Uncategorised', color: '#C9CCD5' };

/** Keyword map for auto-picking a category from the expense name (spec §6.3), in priority order. */
export const KEYWORDS: [string, string[]][] = [
  ['Fuel', ['petrol', 'diesel', 'fuel', 'cng']],
  ['Groceries', ['grocery', 'groceries', 'vegetables', 'milk', 'fruit', 'kirana', 'bigbasket', 'blinkit', 'zepto', 'instamart', 'dmart']],
  ['Rent & Housing', ['rent', 'maintenance', 'society']],
  ['Bills & Utilities', ['electricity', 'bill', 'water', 'wifi', 'internet', 'broadband', 'recharge', 'lpg', 'cylinder', 'dth']],
  ['Food & Dining', ['food', 'zomato', 'swiggy', 'restaurant', 'cafe', 'coffee', 'lunch', 'dinner', 'breakfast', 'snack']],
  ['Transport', ['uber', 'ola', 'rapido', 'metro', 'bus', 'auto', 'cab', 'taxi', 'train', 'toll', 'parking', 'flight', 'travel']],
  ['Shopping', ['amazon', 'flipkart', 'myntra', 'meesho', 'shop', 'clothes', 'shoes']],
  ['Health', ['doctor', 'medicine', 'pharmacy', 'hospital', 'clinic', 'gym', 'health', 'insurance']],
  ['Entertainment', ['movie', 'outing', 'party', 'game', 'concert']],
  ['EMI & Loans', ['emi', 'loan', 'credit card']],
  ['Subscriptions', ['netflix', 'prime', 'spotify', 'hotstar', 'youtube', 'subscription', 'icloud']],
];

const KEYWORD_RES = KEYWORDS.map(([name, words]) => [name, new RegExp(`\\b(${words.join('|')})`, 'i')] as const);

/** Name of the default category that matches the text, if any. */
export function matchCategoryName(text: string): string | null {
  for (const [name, re] of KEYWORD_RES) if (re.test(text)) return name;
  return null;
}

export function autoPickCategory(text: string, categories: Category[]): Category | null {
  const name = matchCategoryName(text);
  if (!name) return null;
  return categories.find(c => c.name.trim().toLowerCase() === name.toLowerCase()) ?? null;
}

export function nextColor(categories: { color: string }[]) {
  const used = new Set(categories.map(c => c.color.toUpperCase()));
  return PALETTE.find(p => !used.has(p)) ?? PALETTE[categories.length % PALETTE.length];
}

/** Where expenses go when their category is deleted: "Other", else the first remaining one. */
export function fallbackCategory(categories: Category[], excludeId?: string) {
  const rest = categories.filter(c => c.id !== excludeId);
  return rest.find(c => c.name.trim().toLowerCase() === 'other') ?? rest[0] ?? null;
}

export const sortCategories = (cs: Category[]) =>
  [...cs].sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
