import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
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
  if (!user && isNetworkError(error)) return response;

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
  return response;
}
