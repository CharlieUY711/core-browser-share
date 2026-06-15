-- Core Browser Share — initial schema
-- Run this in your Supabase SQL editor

create table if not exists public.browser_sessions (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  created_at  timestamptz not null default now(),
  active      boolean not null default true
);

-- Index for fast lookup by code
create index if not exists browser_sessions_code_idx on public.browser_sessions (code);

-- Auto-deactivate sessions older than 24 hours (run as a scheduled job or cron)
-- delete from public.browser_sessions where created_at < now() - interval '24 hours';

-- Enable Row Level Security
alter table public.browser_sessions enable row level security;

-- Allow anonymous read (needed for join flow)
create policy "Allow anon read" on public.browser_sessions
  for select using (true);

-- Allow anon insert (session creation)
create policy "Allow anon insert" on public.browser_sessions
  for insert with check (true);

-- Allow anon update active flag (session close)
create policy "Allow anon update active" on public.browser_sessions
  for update using (true) with check (true);
