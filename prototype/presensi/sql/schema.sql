-- ============================================================
-- SCHEMA PRESENSI ORGANISASI (Supabase / PostgreSQL)
-- Jalankan seluruh isi file ini di Supabase > SQL Editor
-- ============================================================
create extension if not exists pgcrypto;

-- ---------- TABEL ----------
create table public.profiles (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null unique references auth.users(id) on delete cascade,
  nama      text not null,
  email     text not null,
  role      text not null default 'anggota' check (role in ('admin','anggota')),
  divisi    text,
  created_at timestamptz not null default now()
);

create table public.events (
  id          uuid primary key default gen_random_uuid(),
  nama_event  text not null,
  tanggal     timestamptz not null,
  qr_code_key text not null unique default encode(gen_random_bytes(16),'hex'),
  latitude    double precision not null check (latitude between -90 and 90),
  longitude   double precision not null check (longitude between -180 and 180),
  radius_meter integer not null default 100 check (radius_meter > 0),
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.attendances (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(user_id) on delete cascade,
  event_id    uuid not null references public.events(id) on delete cascade,
  waktu_absen timestamptz not null default now(),
  status      text not null default 'hadir' check (status in ('hadir','izin','sakit','alpha')),
  latitude    double precision,
  longitude   double precision,
  jarak_meter integer,
  unique (user_id, event_id)
);

create table public.permissions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(user_id) on delete cascade,
  event_id        uuid not null references public.events(id) on delete cascade,
  jenis           text not null default 'izin' check (jenis in ('izin','sakit')),
  alasan          text not null,
  status_approval text not null default 'pending' check (status_approval in ('pending','approved','rejected')),
  created_at      timestamptz not null default now(),
  unique (user_id, event_id)
);

-- ---------- FUNGSI BANTUAN ----------
create or replace function public.my_role() returns text
language sql security definer stable set search_path = public as
$$ select role from public.profiles where user_id = auth.uid() $$;

create or replace function public.is_admin() returns boolean
language sql security definer stable set search_path = public as
$$ select coalesce(public.my_role() = 'admin', false) $$;

-- Profil dibuat otomatis saat register. Role SELALU 'anggota'
-- (admin hanya bisa dipromosikan manual, lihat bagian bawah).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, nama, email, divisi)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'nama', split_part(new.email,'@',1)),
          new.email,
          new.raw_user_meta_data->>'divisi');
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- Izin disetujui -> otomatis tercatat di attendances
create or replace function public.on_permission_approved() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.attendances (user_id, event_id, status)
  values (new.user_id, new.event_id, new.jenis)
  on conflict (user_id, event_id) do update set status = excluded.status;
  return new;
end $$;

create trigger permission_approved
  after update of status_approval on public.permissions
  for each row
  when (new.status_approval = 'approved' and old.status_approval is distinct from 'approved')
  execute function public.on_permission_approved();

-- ---------- PRESENSI (validasi QR + GPS + waktu di SERVER) ----------
-- Anggota TIDAK bisa insert ke attendances langsung; wajib lewat fungsi ini.
create or replace function public.submit_attendance(
  p_qr_key text, p_lat double precision, p_lng double precision)
returns json language plpgsql security definer set search_path = public as $$
declare ev public.events%rowtype; dist double precision;
begin
  if auth.uid() is null then raise exception 'Kamu belum login'; end if;
  select * into ev from public.events where qr_code_key = p_qr_key;
  if not found then raise exception 'QR Code tidak valid'; end if;

  -- Jendela waktu: 1 jam sebelum s/d 6 jam setelah jam mulai (ubah sesuai kebutuhan)
  if now() < ev.tanggal - interval '1 hour' or now() > ev.tanggal + interval '6 hours' then
    raise exception 'Presensi untuk acara ini belum dibuka atau sudah ditutup';
  end if;

  -- Jarak haversine (meter)
  dist := 6371000 * 2 * asin(sqrt(
    power(sin(radians(p_lat - ev.latitude)/2), 2) +
    cos(radians(ev.latitude)) * cos(radians(p_lat)) *
    power(sin(radians(p_lng - ev.longitude)/2), 2)));
  if dist > ev.radius_meter then
    raise exception 'Kamu berada % m dari lokasi (batas % m)', round(dist), ev.radius_meter;
  end if;

  insert into public.attendances (user_id, event_id, status, latitude, longitude, jarak_meter)
  values (auth.uid(), ev.id, 'hadir', p_lat, p_lng, round(dist))
  on conflict (user_id, event_id) do nothing;
  if not found then raise exception 'Kamu sudah tercatat untuk acara ini'; end if;

  return json_build_object('event', ev.nama_event, 'jarak_meter', round(dist));
end $$;

grant execute on function public.submit_attendance(text,double precision,double precision) to authenticated;

-- ---------- VIEW EVENT PUBLIK (tanpa qr_code_key) ----------
-- Anggota tidak boleh membaca qr_code_key, kalau tidak bisa absen tanpa hadir.
create view public.events_public as
  select id, nama_event, tanggal, latitude, longitude, radius_meter from public.events;
revoke all on public.events_public from anon;
grant select on public.events_public to authenticated;

-- ---------- ROW LEVEL SECURITY ----------
alter table public.profiles    enable row level security;
alter table public.events      enable row level security;
alter table public.attendances enable row level security;
alter table public.permissions enable row level security;

-- profiles
create policy "profiles: baca sendiri/admin" on public.profiles for select
  using (user_id = auth.uid() or public.is_admin());
create policy "profiles: ubah sendiri (role tidak boleh berubah)" on public.profiles for update
  using (user_id = auth.uid()) with check (user_id = auth.uid() and role = public.my_role());
create policy "profiles: admin ubah semua" on public.profiles for update
  using (public.is_admin()) with check (public.is_admin());

-- events: hanya admin (anggota pakai view events_public)
create policy "events: admin penuh" on public.events for all
  using (public.is_admin()) with check (public.is_admin());

-- attendances: baca milik sendiri / admin; tulis hanya admin (anggota lewat RPC)
create policy "attendances: baca sendiri/admin" on public.attendances for select
  using (user_id = auth.uid() or public.is_admin());
create policy "attendances: admin penuh" on public.attendances for all
  using (public.is_admin()) with check (public.is_admin());

-- permissions
create policy "permissions: baca sendiri/admin" on public.permissions for select
  using (user_id = auth.uid() or public.is_admin());
create policy "permissions: anggota ajukan (pending)" on public.permissions for insert
  with check (user_id = auth.uid() and status_approval = 'pending');
create policy "permissions: admin verifikasi" on public.permissions for update
  using (public.is_admin()) with check (public.is_admin());

-- ---------- JADIKAN ADMIN (jalankan manual setelah akun terdaftar) ----------
-- update public.profiles set role = 'admin' where email = 'ketua@contoh.com';
