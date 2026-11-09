import type { ReactNode } from 'react';

function Sv({ size = 18, sw = 2, className, children }: { size?: number; sw?: number; className?: string; children: ReactNode }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export const I = {
  chev: () => <Sv className="chev"><path d="m6 9 6 6 6-6" /></Sv>,
  chevSm: () => <Sv className="chev" size={15} sw={2.2}><path d="m6 9 6 6 6-6" /></Sv>,
  left: () => <Sv><path d="m15 18-6-6 6-6" /></Sv>,
  right: () => <Sv><path d="m9 18 6-6-6-6" /></Sv>,
  sliders: () => <Sv size={17}><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></Sv>,
  plus: () => <Sv size={22} sw={2.4}><path d="M12 5v14M5 12h14" /></Sv>,
  plusSm: () => <Sv size={15} sw={2.4}><path d="M12 5v14M5 12h14" /></Sv>,
  pencil: () => <Sv size={15}><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-4-4L4 16v4Z" /></Sv>,
  trash: () => <Sv size={17}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></Sv>,
  inc: () => <Sv size={15} sw={2.4}><path d="M12 19V5M6 11l6-6 6 6" /></Sv>,
  copy: () => <Sv size={15}><rect x="9" y="9" width="11" height="11" rx="2.5" /><path d="M5 15V6a2 2 0 0 1 2-2h8" /></Sv>,
  restore: () => <Sv size={15}><path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" /></Sv>,
  wallet: () => <Sv size={28} sw={1.7}><path d="M19 7V5a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3v-3M3 6v12a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-3" /></Sv>,
  down: () => <Sv size={15}><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></Sv>,
  up: () => <Sv size={15}><path d="M12 20V9M7 14l5-5 5 5M5 4h14" /></Sv>,
  undo: () => <Sv size={14}><path d="M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3" /></Sv>,
  check: () => <Sv size={19} sw={2.6}><path d="m5 12.5 4.5 4.5L19 7.5" /></Sv>,
  cal: () => <Sv size={16}><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M8 3v4M16 3v4M3.5 10h17" /></Sv>,
  list: () => <Sv><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1" /><circle cx="4.5" cy="12" r="1" /><circle cx="4.5" cy="18" r="1" /></Sv>,
  pie: ({ size = 18 }: { size?: number } = {}) => <Sv size={size}><path d="M21 12A9 9 0 1 1 12 3v9h9Z" /><path d="M15 3.5A9 9 0 0 1 20.5 9H15V3.5Z" /></Sv>,
  sort: () => <Sv size={15} sw={2.2}><path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4" /></Sv>,
  x: () => <Sv size={13} sw={2.6}><path d="M18 6 6 18M6 6l12 12" /></Sv>,
  search: () => <Sv size={16} sw={2.2}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></Sv>,
  tick: () => <Sv size={13} sw={3}><path d="m5 12.5 4.5 4.5L19 7.5" /></Sv>,
  logout: () => <Sv size={15}><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4" /></Sv>,
  // Duotone navigation icons: a soft filled layer (.duo) under crisp 1.8px strokes.
  navExpenses: () => (
    <svg className="ni" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path className="duo" d="M6 2.8h12a1.2 1.2 0 0 1 1.2 1.2v16.4l-2.4-1.6-2.4 1.6-2.4-1.6-2.4 1.6-2.4-1.6-2.4 1.6V4A1.2 1.2 0 0 1 6 2.8Z" />
      <path d="M6 2.8h12a1.2 1.2 0 0 1 1.2 1.2v16.4l-2.4-1.6-2.4 1.6-2.4-1.6-2.4 1.6-2.4-1.6-2.4 1.6V4A1.2 1.2 0 0 1 6 2.8Z" />
      <path d="M8.8 8h6.4M8.8 11.6h6.4M8.8 15.2h3.6" />
    </svg>
  ),
  navSpends: () => (
    <svg className="ni" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect className="duo" x="3" y="3.5" width="18" height="17" rx="4" />
      <rect x="3" y="3.5" width="18" height="17" rx="4" />
      <circle cx="7.6" cy="8.6" r="1" fill="currentColor" stroke="none" />
      <circle cx="7.6" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="7.6" cy="15.4" r="1" fill="currentColor" stroke="none" />
      <path d="M10.6 8.6h6M10.6 12h6M10.6 15.4h4" />
    </svg>
  ),
  navInsights: () => (
    <svg className="ni" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect className="duo" x="16.5" y="3" width="4.5" height="18" rx="2.25" />
      <rect x="3" y="12" width="4.5" height="9" rx="2.25" />
      <rect x="9.75" y="7.5" width="4.5" height="13.5" rx="2.25" />
      <rect x="16.5" y="3" width="4.5" height="18" rx="2.25" />
    </svg>
  ),
  navSettings: () => (
    <svg className="ni" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect className="duo" x="2.5" y="3.5" width="19" height="7.5" rx="3.75" />
      <rect className="duo" x="2.5" y="13" width="19" height="7.5" rx="3.75" />
      <rect x="2.5" y="3.5" width="19" height="7.5" rx="3.75" />
      <rect x="2.5" y="13" width="19" height="7.5" rx="3.75" />
      <circle cx="17.75" cy="7.25" r="1.9" fill="currentColor" stroke="none" />
      <circle cx="6.25" cy="16.75" r="1.9" fill="currentColor" stroke="none" />
    </svg>
  ),
  okFull: () => (
    <svg className="ok" viewBox="0 0 24 24" role="img" aria-label="Done">
      <circle cx="12" cy="12" r="11" fill="currentColor" />
      <path d="m7.2 12.4 3.1 3.1 6.4-6.8" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  google: () => (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  ),
};
