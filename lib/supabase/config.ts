/** True when the Supabase env vars are set. Without them the app runs in device-only mode. */
export const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/** Supabase couldn't be reached (as opposed to "not signed in"). */
export function isNetworkError(error: { name?: string; status?: number; message?: string } | null | undefined) {
  if (!error) return false;
  return error.name === 'AuthRetryableFetchError'
    || error.status === 0
    || (error.status ?? 0) >= 500
    || /fetch|network|timeout|ECONNREFUSED|ENOTFOUND/i.test(error.message ?? '');
}
