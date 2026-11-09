import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';
import type { Database } from '../database.types';
import { isNetworkError, supabaseConfigured } from './config';

const PUBLIC = ['/login', '/auth/'];

export async function updateSession(request: NextRequest) {
  // Supabase not set up yet: the app runs in device-only mode.
  if (!supabaseConfigured) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(toSet) {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // Refreshes the session cookie. Must run before anything else reads auth.
  const { data: { user }, error } = await supabase.auth.getUser();
  // Supabase unreachable: don't lock anyone out. The page falls back to the cookie
  // session (or device-only mode) and changes are kept on the device until it's back.
  if (!user && isNetworkError(error)) return withVerifiedUser(request, response, null);

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC.some(p => path.startsWith(p));
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }
  if (user && path === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }
  return withVerifiedUser(request, response, user);
}

/** Header the page reads instead of asking Supabase about the user a second time. */
export const VERIFIED_USER_HEADER = 'x-spendit-user';

/**
 * Hands the user just verified above to the page. The header is always set or removed
 * here, so a value sent by the browser can never get through.
 */
function withVerifiedUser(request: NextRequest, response: NextResponse, user: User | null) {
  const headers = new Headers(request.headers);
  headers.delete(VERIFIED_USER_HEADER);
  if (user) {
    const m = user.user_metadata ?? {};
    const slim = { id: user.id, email: user.email, user_metadata: { full_name: m.full_name, name: m.name, avatar_url: m.avatar_url, picture: m.picture } };
    headers.set(VERIFIED_USER_HEADER, encodeURIComponent(JSON.stringify(slim)));
  }
  const next = NextResponse.next({ request: { headers } });
  response.cookies.getAll().forEach(c => next.cookies.set(c));
  return next;
}
