create or replace function public.update_store_config_admin(
  p_store_id uuid,
  p_config jsonb
)
returns void
language plpgsql
security definer
as $$
begin
  update public.stores
  set config = p_config
  where id = p_store_id;
end;
$$;

-- opcional (recomendado): garantir schema/path seguro
alter function public.update_store_config_admin(uuid, jsonb) set search_path = public;