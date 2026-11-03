'use client';

export const reduced = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Red ring + shake on an invalid field, then focus it. */
export function shake(el: HTMLElement | null | undefined) {
  if (!el) return;
  el.classList.remove('bad');
  void el.offsetWidth;
  el.classList.add('bad');
  el.focus();
  setTimeout(() => el.classList.remove('bad'), 1600);
}

/** Smooth expand/collapse: animate real pixel height, then hand back to CSS. */
export function animateOpen(el: HTMLElement & { _t?: ReturnType<typeof setTimeout> }, open: boolean) {
  if (reduced()) {
    el.classList.toggle('open', open);
    el.style.height = '';
    return;
  }
  const from = el.getBoundingClientRect().height;
  el.classList.toggle('open', open);
  const to = open ? el.scrollHeight : 0;
  el.style.transition = 'none';
  el.style.height = from + 'px';
  void el.offsetHeight;
  el.style.transition = '';
  el.style.height = to + 'px';
  clearTimeout(el._t);
  el._t = setTimeout(() => {
    if (el.classList.contains('open') === open) el.style.height = '';
  }, 380);
}

export const scrollTop = (smooth = true) => window.scrollTo({ top: 0, behavior: smooth && !reduced() ? 'smooth' : 'auto' });

export const cssVar = (c: string) => ({ ['--c' as string]: c }) as React.CSSProperties;
