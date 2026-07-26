create or replace function public.delete_reward_media_asset_atomic(p_asset_id uuid)
returns table(storage_bucket text, storage_path text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asset public.reward_media_assets%rowtype;
  v_active_count integer;
begin
  select * into v_asset from public.reward_media_assets where id = p_asset_id;
  if not found then raise exception 'Imagem não encontrada.'; end if;

  if not exists (
    select 1 from public.stores s
    where s.id = v_asset.store_id and s.user_id = auth.uid()
  ) then
    raise exception 'Sem permissão para excluir esta imagem.';
  end if;

  select count(*) into v_active_count
  from public.fidelity_rewards r
  where r.media_asset_id = p_asset_id
    and r.is_active = true
    and (r.offer_valid_until is null or r.offer_valid_until >= now());

  if v_active_count > 0 then
    raise exception 'Esta imagem está vinculada a % prêmio(s) ativo(s).', v_active_count;
  end if;

  update public.fidelity_rewards
  set media_asset_id = null, image_url = null
  where media_asset_id = p_asset_id;

  delete from public.reward_media_assets where id = p_asset_id;
  return query select v_asset.storage_bucket, v_asset.storage_path;
end;
$$;

revoke all on function public.delete_reward_media_asset_atomic(uuid) from public;
grant execute on function public.delete_reward_media_asset_atomic(uuid) to authenticated;

create or replace function public.enforce_reward_media_asset_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active_count integer;
begin
  select count(*) into v_active_count
  from public.fidelity_rewards r
  where r.media_asset_id = old.id
    and r.is_active = true
    and (r.offer_valid_until is null or r.offer_valid_until >= now());

  if v_active_count > 0 then
    raise exception 'Esta imagem está vinculada a % prêmio(s) ativo(s).', v_active_count;
  end if;

  update public.fidelity_rewards
  set media_asset_id = null, image_url = null
  where media_asset_id = old.id;

  return old;
end;
$$;

drop trigger if exists trg_reward_media_asset_delete_cleanup on public.reward_media_assets;
create trigger trg_reward_media_asset_delete_cleanup
before delete on public.reward_media_assets
for each row execute function public.enforce_reward_media_asset_delete();