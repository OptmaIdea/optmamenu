create or replace function public.list_cashbook_entries_by_period_safe(
  p_store_id uuid,
  p_start_date date default null,
  p_end_date date default null,
  p_limit integer default 500
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entries jsonb := '[]'::jsonb;
  v_limit integer := greatest(1, least(coalesce(p_limit, 500), 1000));
begin
  if p_store_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_store_id', 'entries', '[]'::jsonb);
  end if;

  if auth.uid() is null or not (
    public.app_is_store_owner(p_store_id)
    or public.user_has_store_permission(p_store_id, 'cashbook.view')
    or public.user_has_store_permission(p_store_id, 'cashbook.create')
  ) then
    return jsonb_build_object('ok', false, 'error', 'access_denied', 'entries', '[]'::jsonb);
  end if;

  if p_start_date is not null and p_end_date is not null and p_start_date > p_end_date then
    return jsonb_build_object(
      'ok', false,
      'error', 'invalid_date_range',
      'message', 'A data inicial não pode ser posterior à data final.',
      'entries', '[]'::jsonb
    );
  end if;

  select coalesce(
    jsonb_agg(
      (
        to_jsonb(q)
        || jsonb_build_object(
          'payment_method_code', case when q.source in ('order', 'order_change') then null else q.payment_method_code end,
          'payment_method', coalesce(q.friendly_payment_label, q.payment_method),
          'financial_account_name', q.financial_account_name
        )
      )
      order by q.occurred_at desc
    ),
    '[]'::jsonb
  )
  into v_entries
  from (
    select
      ce.*,
      o.customer_name as order_customer_name,
      o.order_code as order_code,
      case when src.id is null then null else jsonb_build_object(
        'id', src.id,
        'name', src.name,
        'code', src.code,
        'account_type', src.account_type
      ) end as source_financial_account,
      case when dst.id is null then null else jsonb_build_object(
        'id', dst.id,
        'name', dst.name,
        'code', dst.code,
        'account_type', dst.account_type
      ) end as destination_financial_account,
      coalesce(dst.name, src.name) as financial_account_name,
      coalesce(dst.code, src.code) as financial_account_code,
      coalesce(dst.account_type, src.account_type) as financial_account_type,
      case
        when ce.payment_method_code = 'cash_change_sent' then
          'Dinheiro · troco enviado' || case when coalesce(src.name, dst.name) is not null then ' · ' || coalesce(src.name, dst.name) else '' end
        when coalesce(dst.name, src.name) is not null
          and ce.payment_method is not null
          and position(coalesce(dst.name, src.name) in ce.payment_method) = 0
          then ce.payment_method || ' · ' || coalesce(dst.name, src.name)
        when ce.payment_method is not null then ce.payment_method
        when coalesce(dst.name, src.name) is not null then coalesce(dst.name, src.name)
        else null
      end as friendly_payment_label
    from public.cashbook_entries ce
    left join public.orders o on o.id = ce.order_id
    left join public.store_financial_accounts src on src.id = ce.source_financial_account_id
    left join public.store_financial_accounts dst on dst.id = ce.destination_financial_account_id
    where ce.store_id = p_store_id
      and (p_start_date is null or ce.entry_date >= p_start_date)
      and (p_end_date is null or ce.entry_date <= p_end_date)
    order by ce.entry_date desc, ce.occurred_at desc
    limit v_limit
  ) q;

  return jsonb_build_object('ok', true, 'entries', v_entries);
exception
  when others then
    return jsonb_build_object(
      'ok', false,
      'error', 'unexpected_error',
      'message', 'Não foi possível listar os lançamentos do período.',
      'entries', '[]'::jsonb
    );
end;
$$;

update public.cashbook_entries
   set payment_method = 'Dinheiro · troco enviado'
 where payment_method_code = 'cash_change_sent'
   and payment_method in ('Cash Change Sent', 'cash_change_sent', 'Dinheiro · troco enviado');
