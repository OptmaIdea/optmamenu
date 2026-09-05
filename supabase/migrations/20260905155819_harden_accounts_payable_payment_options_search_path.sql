alter function public.list_accounts_payable_payment_options_safe(uuid) set search_path = '';

create or replace function public.list_accounts_payable_payment_options_safe(p_store_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida.';
  end if;

  if not (
    public.app_is_store_owner(p_store_id)
    or public.user_has_store_permission(p_store_id, 'accounts_payable.view')
    or public.user_has_store_permission(p_store_id, 'accounts_payable.manage')
    or public.user_has_store_permission(p_store_id, 'accounts_payable.pay')
    or public.user_has_store_permission(p_store_id, 'accounts_payable.reverse_payment')
  ) then
    raise exception 'Sem permissão para consultar opções financeiras de contas a pagar.';
  end if;

  return jsonb_build_object(
    'financial_accounts', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', a.id,
          'code', a.code,
          'name', a.name,
          'account_type', a.account_type,
          'is_default', a.is_default,
          'sort_order', a.sort_order
        )
        order by a.is_default desc, a.sort_order, a.name
      )
      from public.store_financial_accounts a
      where a.store_id = p_store_id
        and a.active is true
    ), '[]'::jsonb),
    'payment_methods', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'code', m.code,
          'base_code', m.base_code,
          'name', m.name,
          'preferred_financial_account_id', m.preferred_financial_account_id,
          'sort_order', m.sort_order
        )
        order by m.sort_order, m.name
      )
      from public.store_payment_methods m
      where m.store_id = p_store_id
        and m.active is true
        and m.affects_cashbook is true
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.list_accounts_payable_payment_options_safe(uuid) from public, anon;
grant execute on function public.list_accounts_payable_payment_options_safe(uuid) to authenticated;
