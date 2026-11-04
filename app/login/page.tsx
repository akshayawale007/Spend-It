import Image from 'next/image';
import { redirect } from 'next/navigation';
import { supabaseConfigured } from '@/lib/supabase/config';
import { LoginButton } from './LoginButton';

export const metadata = { title: 'Sign in · Spendit' };
export const viewport = { themeColor: '#0d5530' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  // Nothing to sign in to yet: the app runs device-only.
  if (!supabaseConfigured) redirect('/');
  const { error } = await searchParams;
  return (
    <main className="login">
      <div className="login-rings" aria-hidden="true" />
      {/* Desktop only: a few sample entries floating around the edges. */}
      <div className="login-float" aria-hidden="true">
        <div className="lf glass"><i style={{ background: '#ffb79a' }} /><span>Groceries</span><b>−₹1,240</b></div>
        <div className="lf glass"><i style={{ background: '#7fd8b4' }} /><span>Salary</span><b className="pos">+₹62,000</b></div>
        <div className="lf glass lf-gauge"><small>Left this month</small><b>₹18,450</b><span className="bar"><span /></span></div>
        <div className="lf glass"><i style={{ background: '#a99bff' }} /><span>Coffee</span><b>−₹180</b></div>
      </div>
      <section className="login-brand">
        <Image className="login-logo" src="/icons/icon-512.png" alt="" width={140} height={140} priority />
        <h1>Spendit</h1>
        <p>Plan your month.<br />Track every rupee.</p>
      </section>
      <div className="login-act">
        <LoginButton />
        {error && <p className="login-err" role="alert">Sign-in didn’t complete. Please try again.</p>}
        <small className="login-fine">Only you can see your data.</small>
      </div>
    </main>
  );
}
