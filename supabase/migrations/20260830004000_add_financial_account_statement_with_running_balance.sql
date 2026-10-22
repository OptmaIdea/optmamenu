create or replace function public.list_financial_account_statement_safe(
  p_store_id uuid,
  p_account_id uuid default null,
  p_start_date date default null,
  p_end_date date default null,
  p_limit integer default 500,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path to public, auth, pg_temp
as $$
declare
  v_items jsonb := '[]'::jsonb;
  v_total bigint := 0;
  v_limit integer := greatest(1, least(coalesce(p_limit, 500), 1000));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
  v_opening_balance numeric := 0;
  v_period_inflows numeric := 0;
  v_period_outflows numeric := 0;
  v_period_net numeric := 0;
  v_final_balance numeric := 0;
  v_account jsonb := null;
  v_scope text := case when p_account_id is null then 'consolidated' else 'account' end;
begin
  if p_store_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_store_id');
  end if;

  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    if auth.uid() is null or not (
      public.app_is_store_owner(p_store_id)
      or public.user_has_store_permission_v2(p_store_id, 'financial.accounts.view')
      or public.user_has_store_permission_v2(p_store_id, 'cashbook.view')
    ) then
      return jsonb_build_object('ok', false, 'error', 'access_denied');
    end if;
  end if;

  if p_account_id is not null then
    select to_jsonb(a)
      into v_account
    from public.store_financial_accounts a
    where a.id = p_account_id
      and a.store_id = p_store_id;

    if v_account is null then
      return jsonb_build_object('ok', false, 'error', 'account_not_found');
    end if;
  end if;

  with base as (
    select
      e.id,
      e.entry_code,
      e.entry_date,
      e.occurred_at,
      e.description,
      e.notes,
      e.payment_method,
      e.payment_method_code,
      e.source,
      e.source_id,
      e.order_id,
      e.customer_id,
      e.type,
      coalesce(e.is_transfer, false) as is_transfer,
      e.transfer_group_id,
      e.direction,
      e.amount::numeric as amount,
      e.source_financial_account_id,
      e.destination_financial_account_id,
      o.order_code,
      o.customer_name as order_customer_name,
      case
        when p_account_id is null and coalesce(e.is_transfer, false) = true then 0::numeric
        when p_account_id is null and e.direction = 'in' then e.amount::numeric
        when p_account_id is null and e.direction = 'out' then -e.amount::numeric
        when e.destination_financial_account_id = p_account_id then e.amount::numeric
        when e.source_financial_account_id = p_account_id then -e.amount::numeric
        else 0::numeric
      end as signed_amount,
      case
        when p_account_id is null and coalesce(e.is_transfer, false) = true then 'transfer'
        when p_account_id is null and e.direction = 'in' then 'in'
        when p_account_id is null and e.direction = 'out' then 'out'
        when e.destination_financial_account_id = p_account_id then 'in'
        when e.source_financial_account_id = p_account_id then 'out'
        else e.direction
      end as account_direction,
      case
        when e.destination_financial_account_id = p_account_id then e.source_financial_account_id
        when e.source_financial_account_id = p_account_id then e.destination_financial_account_id
        else null::uuid
      end as counterpart_account_id
    from public.cashbook_entries e
    left join public.orders o on o.id = e.order_id and o.store_id = e.store_id
    where e.store_id = p_store_id
      and e.status = 'confirmed'
      and e.affects_balance = true
      and (
        p_account_id is null
        or e.source_financial_account_id = p_account_id
        or e.destination_financial_account_id = p_account_id
      )
  ), ordered as (
    select
      b.*,
      ca.name as counterpart_account_name,
      ca.code as counterpart_account_code,
      sum(b.signed_amount) over (order by b.occurred_at, b.id rows between unbounded preceding and current row) as running_balance_after
    from base b
    left join public.store_financial_accounts ca on ca.id = b.counterpart_account_id and ca.store_id = p_store_id
  ), scoped as (
    select *
    from ordered o
    where (p_start_date is null or o.entry_date >= p_start_date)
      and (p_end_date is null or o.entry_date <= p_end_date)
  ), page as (
    select *
    from scoped
    order by occurred_at desc, id desc
    limit v_limit offset v_offset
  )
  select
    coalesce((select sum(signed_amount) from ordered where p_start_date is not null and entry_date < p_start_date), 0),
    coalesce((select sum(amount) from scoped where signed_amount > 0), 0),
    coalesce((select sum(abs(signed_amount)) from scoped where signed_amount < 0), 0),
    coalesce((select sum(signed_amount) from scoped), 0),
    (select count(*) from scoped),
    coalesce((select jsonb_agg(to_jsonb(page) order by page.occurred_at desc, page.id desc) from page), '[]'::jsonb)
  into v_opening_balance, v_period_inflows, v_period_outflows, v_period_net, v_total, v_items;

  v_final_balance := v_opening_balance + v_period_net;

  return jsonb_build_object(
    'ok', true,
    'scope', v_scope,
    'account', v_account,
    'start_date', p_start_date,
    'end_date', p_end_date,
    'opening_balance', v_opening_balance,
    'period_inflows', v_period_inflows,
    'period_outflows', v_period_outflows,
    'period_net', v_period_net,
    'final_balance', v_final_balance,
    'total', v_total,
    'limit', v_limit,
    'offset', v_offset,
    'items', v_items
  );
end;
$$;

grant execute on function public.list_financial_account_statement_safe(uuid, uuid, date, date, integer, integer) to authenticated;
