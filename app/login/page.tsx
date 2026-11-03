import { redirect } from 'next/navigation';
import { supabaseConfigured } from '@/lib/supabase/config';
import { LoginButton } from './LoginButton';

export const metadata = { title: 'Sign in · Spendit' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  // Nothing to sign in to yet: the app runs device-only.
  if (!supabaseConfigured) redirect('/');
  const { error } = await searchParams;
  return (
    <main className="login">
      <div className="login-card glass">
        <div className="login-logo" aria-hidden="true">
          <svg width="30" height="30" viewBox="0 0 50 34" fill="none" strokeLinecap="round" strokeWidth="6">
            <path d="M5 29 A20 20 0 0 1 45 29" stroke="rgba(28,31,42,.12)" />
            <path d="M5 29 A20 20 0 0 1 34 11" stroke="#1c1f2a" />
          </svg>
        </div>
        <h1>Spendit</h1>
        <p>Plan your month. Track every rupee.</p>
        <LoginButton />
        {error && <p className="login-err" role="alert">Sign-in didn’t complete. Please try again.</p>}
      </div>
    </main>
  );
}
