-- Prévia autoritativa de preços do PDV com validação de vínculo e permissão.

create or replace function public.quote_pos_cart_safe(
  p_store_id uuid,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Autenticação necessária.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.store_members sm
    where sm.store_id = p_store_id
      and sm.user_id = v_user_id
      and sm.status = 'active'
  ) then
    raise exception 'Vínculo ativo com a loja não encontrado.'
      using errcode = '42501';
  end if;

  if not (
    public.app_is_store_owner(p_store_id)
    or public.user_has_store_permission_v2(p_store_id, 'pdv.view')
  ) then
    raise exception 'Sem permissão para consultar preços do PDV.'
      using errcode = '42501';
  end if;

  return public.calculate_store_cart_pricing(p_store_id, p_items);
end;
$function$;

comment on function public.quote_pos_cart_safe(uuid, jsonb) is
  'Prévia autoritativa do carrinho do PDV, restrita a membro ativo com pdv.view.';

revoke all on function public.calculate_store_cart_pricing(uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.quote_pos_cart_safe(uuid, jsonb)
  from public, anon;
grant execute on function public.quote_pos_cart_safe(uuid, jsonb)
  to authenticated;
