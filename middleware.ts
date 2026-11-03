import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Skip static files, the service worker, manifest and icons.
  matcher: ['/((?!_next/static|_next/image|sw.js|manifest.webmanifest|icons/|favicon.ico|icon.svg|apple-icon.png|.*\\.(?:png|svg|ico|webp|json)$).*)'],
};
