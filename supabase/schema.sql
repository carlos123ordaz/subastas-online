-- ============================================================
-- MichiStore Auction — Supabase Schema
-- Ejecuta este archivo en el SQL Editor de tu proyecto Supabase
-- ============================================================

-- Extensiones
create extension if not exists "uuid-ossp";

-- ─── Perfiles (extiende auth.users) ─────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text,
  handle      text,
  color       text    default '#ff2e88',
  role        text    default 'user' check (role in ('user', 'admin')),
  created_at  timestamptz default now()
);

-- Trigger: crear perfil automáticamente al registrarse
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, name, handle, color)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    '@' || lower(regexp_replace(coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), '[^a-zA-Z0-9]', '', 'g')),
    (array['#ff2e88','#2af0ff','#ffd23a','#c8ff2e','#b06bff','#ff7a3a','#ff5fb3','#3affc8'])[floor(random()*8+1)::int]
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── Subastas (sesiones) ─────────────────────────────────
create table if not exists public.auctions (
  id              uuid primary key default gen_random_uuid(),
  title           text    not null default 'Subasta MichiStore',
  tiktok_handle   text    default '@michistore',
  status          text    default 'pending' check (status in ('pending', 'live', 'closed')),
  created_by      uuid    references public.profiles(id),
  created_at      timestamptz default now()
);

-- ─── Lotes (ítems a subastar) ────────────────────────────
create table if not exists public.lots (
  id                   uuid primary key default gen_random_uuid(),
  auction_id           uuid references public.auctions(id) on delete cascade,
  name                 text not null,
  emoji                text default '📦',
  color_desc           text,
  hint                 text,
  start_price          numeric default 10,
  order_num            int     default 0,
  status               text    default 'pending' check (status in ('pending', 'live', 'sold')),
  winner_id            uuid    references public.profiles(id),
  winning_price        numeric,
  -- Timer
  timer_duration       int     default 60,
  timer_ends_at        timestamptz,
  timer_remaining      int,
  anti_snipe_seconds   int     default 5,
  anti_snipe_extension int     default 10,
  created_at           timestamptz default now()
);

-- ─── Pujas ───────────────────────────────────────────────
create table if not exists public.bids (
  id          uuid primary key default gen_random_uuid(),
  lot_id      uuid not null references public.lots(id) on delete cascade,
  bidder_id   uuid not null references public.profiles(id),
  amount      numeric not null,
  delta       numeric not null default 1,
  created_at  timestamptz default now()
);

-- Unique: solo la puja más alta por usuario por lote (upsert on conflict)
-- La lógica de "un pujador sube" la manejamos en el cliente con insert normal.

-- ─── Eventos del overlay ────────────────────────────────
create table if not exists public.overlay_events (
  id          uuid primary key default gen_random_uuid(),
  lot_id      uuid references public.lots(id) on delete cascade,
  auction_id  uuid references public.auctions(id) on delete cascade,
  type        text not null,
  message     text,
  created_at  timestamptz default now()
);

-- ─── RLS ─────────────────────────────────────────────────
alter table public.profiles       enable row level security;
alter table public.auctions       enable row level security;
alter table public.lots           enable row level security;
alter table public.bids           enable row level security;
alter table public.overlay_events enable row level security;

-- Profiles: lectura pública, escritura del propio usuario
create policy "profiles: lectura publica"   on public.profiles for select using (true);
create policy "profiles: actualizar propio" on public.profiles for update using (auth.uid() = id);

-- Auctions: lectura pública, escritura de admin
create policy "auctions: lectura publica"     on public.auctions for select using (true);
create policy "auctions: admin puede escribir" on public.auctions for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Lots: lectura pública, escritura de admin
create policy "lots: lectura publica"      on public.lots for select using (true);
create policy "lots: admin puede escribir" on public.lots for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Bids: lectura pública, insertar si autenticado
create policy "bids: lectura publica"       on public.bids for select using (true);
create policy "bids: insertar si logueado"  on public.bids for insert
  with check (auth.uid() = bidder_id and auth.uid() is not null);

-- Overlay events: lectura pública, escritura de admin
create policy "overlay_events: lectura publica"      on public.overlay_events for select using (true);
create policy "overlay_events: admin puede escribir" on public.overlay_events for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- ─── Realtime ────────────────────────────────────────────
-- Habilitar replicación para las tablas que necesitan tiempo real
alter publication supabase_realtime add table public.lots;
alter publication supabase_realtime add table public.bids;
alter publication supabase_realtime add table public.overlay_events;
alter publication supabase_realtime add table public.auctions;

-- ─── Índices de rendimiento ──────────────────────────────
create index if not exists bids_lot_id_idx         on public.bids(lot_id);
create index if not exists bids_bidder_id_idx      on public.bids(bidder_id);
create index if not exists bids_amount_desc_idx    on public.bids(lot_id, amount desc);
create index if not exists lots_auction_id_idx     on public.lots(auction_id);
create index if not exists lots_status_idx         on public.lots(status);
create index if not exists overlay_lot_id_idx      on public.overlay_events(lot_id);

-- ─── Función: hacer admin a un usuario ──────────────────
-- Ejecutar en el SQL Editor de Supabase después de que el usuario se registre:
-- UPDATE public.profiles SET role = 'admin' WHERE id = '<user-uuid>';
-- O con el email:
-- UPDATE public.profiles SET role = 'admin'
--   WHERE id = (SELECT id FROM auth.users WHERE email = 'tu@email.com');
