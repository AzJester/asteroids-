# Global leaderboard (Supabase)

The game works fully on a **local** top-10 board with no setup. To enable the
**global, cross-device** board, point it at a Supabase project — about two
minutes of work.

## One-time setup

1. Create a free project at <https://supabase.com> (or reuse an existing one).
2. Create the `scores` table and its security policies by running
   [`migrations/0001_init.sql`](./migrations/0001_init.sql) — paste it into the
   project's **SQL Editor** and run it, or apply it with the Supabase CLI:
   ```bash
   supabase db push        # if you've linked the project
   ```
3. In the dashboard, open **Project Settings → API** and copy:
   - **Project URL** (e.g. `https://abcdefgh.supabase.co`)
   - the **anon / public** key
4. Paste both into [`src/supabase-config.js`](../src/supabase-config.js):
   ```js
   export const SUPABASE_URL = 'https://abcdefgh.supabase.co';
   export const SUPABASE_ANON_KEY = 'eyJhbGci...';
   ```
5. Commit and push. The next deploy serves the global board automatically.

## Is the anon key safe to commit?

Yes. The anon key is a **public client key** by design. Row-level security
(enabled in the migration) restricts the anon role to **reading** the board and
**inserting** a single score row that passes the `initials`/`score` checks — it
cannot update or delete rows or touch any other table.

> Note: like any purely client-side arcade board, submitted scores are not
> cryptographically verified, so a determined user could forge a score. The RLS
> checks bound the damage (valid shape only). For a hardened board, move
> submission behind an Edge Function that validates a signed game session.

## How the client behaves

- **Configured** → the attract and game-over screens show the GLOBAL board;
  qualifying runs are submitted on initials entry.
- **Unconfigured or offline** → it silently falls back to the LOCAL board.
