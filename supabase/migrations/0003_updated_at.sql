-- `updated_at` real: sin el trigger solo se rellenaba al insertar, así que cualquier detección
-- de conflictos (bot de Discord, varias pestañas) quedaba a ciegas.

create or replace function public.aura_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists aura_user_data_touch on public.aura_user_data;
create trigger aura_user_data_touch
  before update on public.aura_user_data
  for each row
  execute function public.aura_touch_updated_at();

-- Rellena la fecha de las filas que nunca se actualizaron.
update public.aura_user_data set updated_at = now() where updated_at is null;
