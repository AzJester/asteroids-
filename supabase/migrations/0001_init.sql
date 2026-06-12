-- Global leaderboard table for the Asteroids game.
-- Apply with the Supabase MCP/CLI or paste into the SQL editor.
-- Row-level security limits the public (anon) client to reading the board and
-- inserting a single validated score row — it cannot update or delete.

create table if not exists public.scores (
  id         bigint generated always as identity primary key,
  initials   text not null check (char_length(initials) between 1 and 3),
  score      integer not null check (score >= 0 and score < 100000),
  created_at timestamptz not null default now()
);

create index if not exists scores_score_desc_idx on public.scores (score desc);

alter table public.scores enable row level security;

drop policy if exists "scores public read" on public.scores;
create policy "scores public read"
  on public.scores for select
  to anon
  using (true);

drop policy if exists "scores public insert" on public.scores;
create policy "scores public insert"
  on public.scores for insert
  to anon
  with check (
    char_length(initials) between 1 and 3
    and score >= 0
    and score < 100000
  );
