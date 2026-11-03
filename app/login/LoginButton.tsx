'use client';
import { useState } from 'react';
import { I } from '@/components/icons';
import { createClient } from '@/lib/supabase/client';

export function LoginButton() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return (
    <>
      <button className="gbtn" disabled={busy} onClick={async () => {
        const site = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
        setBusy(true);
        setErr('');
        const { error } = await createClient().auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: `${site.replace(/\/$/, '')}/auth/callback` },
        });
        if (error) { setErr(error.message); setBusy(false); }
      }}>
        <I.google /> {busy ? 'Opening Google…' : 'Continue with Google'}
      </button>
      {err && <p className="login-err" role="alert">{err}</p>}
    </>
  );
}
