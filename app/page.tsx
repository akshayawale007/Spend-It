import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { VERIFIED_USER_HEADER } from '@/lib/supabase/middleware';
import type { User } from '@supabase/supabase-js';
import { AppShell } from '@/components/AppShell';
import type { AppUser } from '@/components/AppContext';
import { isNetworkError, supabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

const localUser: AppUser = { id: 'local', email: '', name: '', avatar: null, mode: 'local', canSignIn: supabaseConfigured };

function toAppUser(user: User): AppUser {
  const meta = user.user_metadata ?? {};
  return {
    id: user.id,
    email: user.email ?? '',
    name: (meta.full_name || meta.name || '') as string,
    avatar: (meta.avatar_url || meta.picture || null) as string | null,
    mode: 'cloud',
    canSignIn: true,
  };
}

export default async function Home() {
  // No Supabase configured: everything is saved on this device.
  if (!supabaseConfigured) return <AppShell user={localUser} />;

  // Middleware has just verified the user with Supabase; reuse that instead of a second round trip.
  const verified = (await headers()).get(VERIFIED_USER_HEADER);
  if (verified) {
    try { return <AppShell user={toAppUser(JSON.parse(decodeURIComponent(verified)) as User)} />; } catch { /* fall through */ }
  }

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (user) return <AppShell user={toAppUser(user)} />;

  if (isNetworkError(error)) {
    // Supabase is unreachable. Use the session in the cookie if there is one (writes
    // queue on the device); otherwise run device-only until the user can sign in.
    const { data: { session } } = await supabase.auth.getSession();
    return <AppShell user={session?.user ? toAppUser(session.user) : localUser} />;
  }
  redirect('/login');
}
