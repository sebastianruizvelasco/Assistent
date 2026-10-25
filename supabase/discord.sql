-- Vínculo entre una cuenta de Discord y una cuenta de AURA.
-- Ejecuta este archivo en el SQL Editor de Supabase, después de supabase/schema.sql.

create table if not exists public.discord_links (
  discord_user_id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists discord_links_user_id_idx on public.discord_links (user_id);

-- Nadie desde el navegador lee ni escribe esta tabla: solo el bot con la clave service_role,
-- que se salta RLS. Sin políticas, un usuario autenticado no ve los vínculos de los demás.
alter table public.discord_links enable row level security;

-- Códigos de un solo uso que genera la app para vincular Discord.
create table if not exists public.discord_link_codes (
  code text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.discord_link_codes enable row level security;

-- El navegador crea, consulta y borra únicamente sus propios códigos.
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

-- Limpieza manual de códigos caducados (el bot también los rechaza):
-- delete from public.discord_link_codes where expires_at < now();
