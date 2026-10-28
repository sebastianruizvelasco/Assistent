-- Vínculo entre Discord y AURA. Equivale a supabase/discord.sql.

create table if not exists public.discord_links (
  discord_user_id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists discord_links_user_id_idx on public.discord_links (user_id);
alter table public.discord_links enable row level security;

create table if not exists public.discord_link_codes (
  code text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.discord_link_codes enable row level security;

drop policy if exists "Los usuarios crean sus códigos" on public.discord_link_codes;
create policy "Los usuarios crean sus códigos"
  on public.discord_link_codes for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Los usuarios ven sus códigos" on public.discord_link_codes;
create policy "Los usuarios ven sus códigos"
  on public.discord_link_codes for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Los usuarios borran sus códigos" on public.discord_link_codes;
create policy "Los usuarios borran sus códigos"
  on public.discord_link_codes for delete to authenticated
  using (auth.uid() = user_id);
