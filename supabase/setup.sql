-- Im Supabase SQL Editor ausführen.
create extension if not exists pgcrypto;

create table if not exists public.audio_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.audio_admins enable row level security;
drop policy if exists "Admins read own row" on public.audio_admins;
create policy "Admins read own row" on public.audio_admins for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.audio_admins from anon, authenticated;
grant select on public.audio_admins to authenticated;

create table if not exists public.audio_tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text default '',
  storage_path text not null unique,
  created_at timestamptz not null default now()
);
alter table public.audio_tracks enable row level security;
drop policy if exists "Public read tracks" on public.audio_tracks;
create policy "Public read tracks" on public.audio_tracks for select to anon, authenticated using (true);
drop policy if exists "Admins insert tracks" on public.audio_tracks;
create policy "Admins insert tracks" on public.audio_tracks for insert to authenticated with check (exists(select 1 from public.audio_admins a where a.user_id=(select auth.uid())));
drop policy if exists "Admins delete tracks" on public.audio_tracks;
create policy "Admins delete tracks" on public.audio_tracks for delete to authenticated using (exists(select 1 from public.audio_admins a where a.user_id=(select auth.uid())));

create table if not exists public.shop_products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text default '',
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'CHF',
  cover_emoji text default '✦',
  storage_path text not null unique,
  published boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.shop_products enable row level security;
drop policy if exists "Public read published products" on public.shop_products;
create policy "Public read published products" on public.shop_products for select to anon, authenticated using (published=true);
-- Product insert/update/delete policies intentionally omitted: manage products only in the Supabase dashboard.
-- Never place the Supabase service/secret key in browser code.

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values
 ('audio-files','audio-files',true,104857600,array['audio/mpeg','audio/wav','audio/ogg','audio/mp4','audio/aac','audio/flac','audio/x-wav']),
 ('zip-products','zip-products',false,524288000,array['application/zip','application/x-zip-compressed','application/octet-stream'])
on conflict (id) do update set public=excluded.public, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "Public read audio files" on storage.objects;
create policy "Public read audio files" on storage.objects for select to anon, authenticated using (bucket_id='audio-files');
drop policy if exists "Admins upload audio" on storage.objects;
create policy "Admins upload audio" on storage.objects for insert to authenticated with check (bucket_id='audio-files' and exists(select 1 from public.audio_admins a where a.user_id=(select auth.uid())));
drop policy if exists "Admins delete audio" on storage.objects;
create policy "Admins delete audio" on storage.objects for delete to authenticated using (bucket_id='audio-files' and exists(select 1 from public.audio_admins a where a.user_id=(select auth.uid())));

-- ZIPs are PRIVATE. Only the server-side download function should create signed links.
-- No public SELECT/INSERT/DELETE policies for zip-products are created.

-- After creating your admin user in Authentication > Users, replace UUID and run:
-- insert into public.audio_admins(user_id) values ('ADMIN_USER_UUID_HERE');
