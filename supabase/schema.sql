create table if not exists public.aura_user_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.aura_user_data enable row level security;
grant select, insert, update on public.aura_user_data to authenticated;
revoke all on public.aura_user_data from anon;

drop policy if exists "Users can read their own AURA data" on public.aura_user_data;
create policy "Users can read their own AURA data"
  on public.aura_user_data for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own AURA data" on public.aura_user_data;
create policy "Users can insert their own AURA data"
  on public.aura_user_data for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own AURA data" on public.aura_user_data;
create policy "Users can update their own AURA data"
  on public.aura_user_data for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);