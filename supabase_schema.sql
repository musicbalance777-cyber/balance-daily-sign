-- Run once in Supabase SQL Editor. Do not expose the service role key to clients.
create table if not exists public.daily_letters (
  user_id text not null,
  day_key date not null,
  category text not null check (category in ('important','pleasant','unexpected')),
  message_text text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, day_key, category)
);
alter table public.daily_letters enable row level security;
-- No public RLS policies: only Netlify Functions using the server-side service-role key may access these records.
