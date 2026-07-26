create or replace function public.enforce_reward_media_asset_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count integer;
begin
  select count(*)
    into current_count
  from public.reward_media_assets
  where store_id = new.store_id
    and archived_at is null;

  if current_count >= 15 then
    raise exception 'A biblioteca de imagens de prêmios atingiu o limite de 15 imagens para esta loja.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_reward_media_asset_limit on public.reward_media_assets;
create trigger trg_reward_media_asset_limit
before insert on public.reward_media_assets
for each row execute function public.enforce_reward_media_asset_limit();
