'use client';
// Keeps the user aware of where their changes are going.
import { useEffect, useRef } from 'react';
import { store, useStore, type SyncState } from '@/lib/store';
import { useApp } from './AppContext';
import { useToast } from './Toast';

const isDown = (s: SyncState) => s === 'offline' || s === 'error';

/** Persistent banner while changes can't reach Supabase. */
export function SyncNotice({ gap = 'top' }: { gap?: 'top' | 'bottom' }) {
  const { user } = useApp();
  const sync = useStore(s => s.sync);
  const pending = useStore(s => s.pending);

  let text: React.ReactNode = null;
  if (user.mode === 'local') {
    text = user.canSignIn
      ? <>Not signed in. Changes are saved on this device. <a href="/login">Sign in</a> to sync them to your account.</>
      : <>Offline mode: Supabase isn’t connected, so changes are saved on this device. They’ll sync once it’s set up and you sign in.</>;
  } else if (isDown(sync)) {
    text = <>
      {sync === 'offline' ? 'You’re offline.' : 'Can’t reach the server.'} Changes are saved on this device
      {pending ? ` (${pending} waiting)` : ''} and will sync automatically when the connection is back.
    </>;
  }
  if (!text) return null;

  return (
    <div className={`notice glass ${user.mode === 'local' ? 'local' : ''} ${gap}`} role="status">
      <i aria-hidden="true" /><span>{text}</span>
    </div>
  );
}

/** Toasts when the connection drops or comes back, plus one-off store notices. */
export function SyncToasts() {
  const toast = useToast();
  const sync = useStore(s => s.sync);
  const notice = useStore(s => s.notice);
  const wasDown = useRef(false);

  useEffect(() => {
    if (isDown(sync) && !wasDown.current) {
      wasDown.current = true;
      toast('Offline — changes will be saved on this device');
    } else if (sync === 'saved' && wasDown.current) {
      wasDown.current = false;
      toast('Back online — all changes synced');
    }
  }, [sync, toast]);

  useEffect(() => {
    if (!notice) return;
    toast(notice);
    store.clearNotice();
  }, [notice, toast]);

  return null;
}
