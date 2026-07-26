create table if not exists public.reward_media_assets (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  description text,
  storage_bucket text not null default 'reward-images',
  storage_path text not null,
  public_url text not null,
  mime_type text not null default 'image/webp',
  size_bytes bigint not null check (size_bytes >= 0),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  content_hash text not null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint reward_media_assets_storage_unique unique (storage_bucket, storage_path)
);

create unique index if not exists reward_media_assets_store_hash_active_uidx
  on public.reward_media_assets (store_id, content_hash)
  where archived_at is null;

create index if not exists reward_media_assets_store_created_idx
  on public.reward_media_assets (store_id, created_at desc);

alter table public.fidelity_rewards
  add column if not exists media_asset_id uuid references public.reward_media_assets(id) on delete set null;

create index if not exists fidelity_rewards_media_asset_idx
  on public.fidelity_rewards (media_asset_id)
  where media_asset_id is not null;

alter table public.reward_media_assets enable row level security;

drop policy if exists "Users can view their reward media" on public.reward_media_assets;
create policy "Users can view their reward media"
  on public.reward_media_assets
  for select
  to authenticated
  using (store_id in (select stores.id from public.stores where stores.user_id = auth.uid()));

drop policy if exists "Users can insert their reward media" on public.reward_media_assets;
create policy "Users can insert their reward media"
  on public.reward_media_assets
  for insert
  to authenticated
  with check (store_id in (select stores.id from public.stores where stores.user_id = auth.uid()));

drop policy if exists "Users can update their reward media" on public.reward_media_assets;
create policy "Users can update their reward media"
  on public.reward_media_assets
  for update
  to authenticated
  using (store_id in (select stores.id from public.stores where stores.user_id = auth.uid()))
  with check (store_id in (select stores.id from public.stores where stores.user_id = auth.uid()));

drop policy if exists "Users can delete unused reward media" on public.reward_media_assets;
create policy "Users can delete unused reward media"
  on public.reward_media_assets
  for delete
  to authenticated
  using (
    store_id in (select stores.id from public.stores where stores.user_id = auth.uid())
    and not exists (
      select 1 from public.fidelity_rewards
      where fidelity_rewards.media_asset_id = reward_media_assets.id
    )
  );

create or replace function public.set_reward_media_asset_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_reward_media_asset_updated_at on public.reward_media_assets;
create trigger set_reward_media_asset_updated_at
before update on public.reward_media_assets
for each row execute function public.set_reward_media_asset_updated_at();

grant select, insert, update, delete on public.reward_media_assets to authenticated;
