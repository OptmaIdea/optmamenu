-- Purchase/AP payment methods: keep purchase-facing options friendly and separate from public checkout.

update public.store_payment_methods
set metadata = coalesce(metadata, '{}'::jsonb) || '{"purchase_enabled": true}'::jsonb,
    updated_at = now()
where code in ('pix','cash','other');

insert into public.store_payment_methods (
  store_id, code, name, description, active, public_enabled, sort_order,
  requires_proof, requires_change_for, affects_cashbook, metadata, base_code
)
select s.id, x.code, x.name, x.description, true, false, x.sort_order,
       false, false, true, '{"purchase_enabled": true, "purchase_only": true}'::jsonb, x.base_code
from public.stores s
cross join (values
  ('boleto'::text, 'Boleto'::text, 'Pagamento de fornecedor por boleto.', 30, 'other'::text),
  ('bank_transfer'::text, 'Transferência bancária'::text, 'Pagamento de fornecedor por transferência bancária.', 40, 'bank_transfer'::text),
  ('account_debit'::text, 'Débito em conta'::text, 'Débito direto em conta bancária.', 50, 'bank_transfer'::text)
) as x(code, name, description, sort_order, base_code)
on conflict (store_id, code) do update
set name = excluded.name,
    description = excluded.description,
    active = true,
    public_enabled = false,
    affects_cashbook = true,
    metadata = coalesce(public.store_payment_methods.metadata, '{}'::jsonb) || excluded.metadata,
    base_code = excluded.base_code,
    sort_order = excluded.sort_order,
    updated_at = now();

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
    or public.user_has_store_permission(p_store_id, 'purchases.view')
    or public.user_has_store_permission(p_store_id, 'purchases.create')
    or public.user_has_store_permission(p_store_id, 'purchases.confirm')
  ) then
    raise exception 'Sem permissão para consultar opções financeiras de compras.';
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
        and a.account_type not in ('card_receivable', 'card_acquirer')
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
        and coalesce((m.metadata->>'purchase_enabled')::boolean, false) is true
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.list_accounts_payable_payment_options_safe(uuid) from public, anon;
grant execute on function public.list_accounts_payable_payment_options_safe(uuid) to authenticated;
