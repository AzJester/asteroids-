// Global online leaderboard configuration.
//
// Leave these blank to run with the local-only top-10 board. Fill them in to
// enable the cross-device global board (see supabase/README.md for the one-time
// setup). The anon key is a PUBLIC client key — it is safe to commit, because
// the `scores` table's row-level-security policies (in supabase/migrations)
// restrict the anon role to reading and inserting validated score rows only.

export const SUPABASE_URL = '';
export const SUPABASE_ANON_KEY = '';
