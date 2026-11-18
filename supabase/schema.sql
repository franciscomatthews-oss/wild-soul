-- Generador de guiones Wild Soul
-- Pega este archivo completo en Supabase > SQL Editor y ejecútalo una vez.

-- 1. Lista de correos con acceso
create table if not exists public.permitidos (
  email text primary key
);

alter table public.permitidos enable row level security;

drop policy if exists "cada uno ve su fila" on public.permitidos;
create policy "cada uno ve su fila" on public.permitidos
  for select to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));

create or replace function public.es_permitido()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.permitidos
    where lower(email) = lower(auth.jwt() ->> 'email')
  );
$$;

-- 2. Guiones
create table if not exists public.guiones (
  id uuid primary key default gen_random_uuid(),
  creado_por uuid default auth.uid() references auth.users (id),
  creado_por_email text default (auth.jwt() ->> 'email'),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  origen text not null check (origen in ('referente', 'producto')),
  formato text check (formato in ('video_corto', 'video_juanita', 'carrusel', 'ugc')),
  eje text,
  titulo text not null default 'Sin título',
  producto text,
  nombre_archivo text,
  entrada jsonb not null default '{}'::jsonb,
  guion jsonb,
  claims jsonb not null default '[]'::jsonb,
  alertas jsonb not null default '[]'::jsonb,
  fuentes jsonb not null default '[]'::jsonb,
  estado text not null default 'procesando'
    check (estado in ('procesando', 'por_revisar', 'aprobado', 'en_grilla', 'error')),
  aprobado_por text,
  aprobado_en timestamptz,
  reglas_version text,
  costo_usd numeric(10, 4) not null default 0,
  error text
);

create index if not exists guiones_estado_idx on public.guiones (estado, creado_en desc);

alter table public.guiones enable row level security;

drop policy if exists "equipo permitido" on public.guiones;
create policy "equipo permitido" on public.guiones
  for all to authenticated
  using (public.es_permitido())
  with check (public.es_permitido());

create or replace function public.tocar_actualizado_en()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;

drop trigger if exists guiones_actualizado_en on public.guiones;
create trigger guiones_actualizado_en
  before update on public.guiones
  for each row execute function public.tocar_actualizado_en();

-- 3. Agrega aquí los correos del equipo (uno por línea)
insert into public.permitidos (email) values
  ('francisco.matthews@thewildfoods.com')
on conflict do nothing;
