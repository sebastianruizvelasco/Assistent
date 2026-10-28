-- Suscripciones a notificaciones Web Push y registro de recordatorios ya enviados.
-- Ejecuta este archivo después de 0001_init.sql.

create table if not exists public.push_subscriptions (
  endpoint text primary key,
  -- auth.uid() como valor por defecto: el navegador no necesita saber su propio id.
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "Cada usuario ve sus suscripciones" on public.push_subscriptions;
create policy "Cada usuario ve sus suscripciones"
  on public.push_subscriptions for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Cada usuario crea sus suscripciones" on public.push_subscriptions;
create policy "Cada usuario crea sus suscripciones"
  on public.push_subscriptions for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Cada usuario actualiza sus suscripciones" on public.push_subscriptions;
create policy "Cada usuario actualiza sus suscripciones"
  on public.push_subscriptions for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Cada usuario borra sus suscripciones" on public.push_subscriptions;
create policy "Cada usuario borra sus suscripciones"
  on public.push_subscriptions for delete to authenticated
  using (auth.uid() = user_id);

-- Qué recordatorios ya se avisaron. Sin políticas: solo el bot con service_role.
create table if not exists public.push_sent (
  user_id uuid not null references auth.users (id) on delete cascade,
  event_id integer not null,
  occurrence text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, event_id, occurrence)
);

alter table public.push_sent enable row level security;
