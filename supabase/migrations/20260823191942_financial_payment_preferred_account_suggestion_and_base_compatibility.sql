create or replace function public.get_financial_account_balances_safe(p_store_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $function$
declare
  v_items jsonb := '[]'::jsonb;
  v_unallocated jsonb := '{}'::jsonb;
  v_payment_methods jsonb := '[]'::jsonb;
  v_book_balance numeric := 0;
  v_allocated_balance numeric := 0;
  v_can_manage boolean := false;
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

  v_can_manage := case
    when coalesce(auth.role(), '') not in ('anon', 'authenticated') then true
    else public.app_is_store_owner(p_store_id)
      or public.user_has_store_permission_v2(p_store_id, 'financial.accounts.manage')
      or public.user_has_store_permission_v2(p_store_id, 'financial.manage')
      or public.user_has_store_permission_v2(p_store_id, 'cashbook.create')
  end;

  select coalesce(jsonb_agg(jsonb_build_object(
    'code', pm.code,
    'base_code', coalesce(pm.base_code, pm.code),
    'name', pm.name,
    'affects_cashbook', pm.affects_cashbook,
    'preferred_financial_account_id', pm.preferred_financial_account_id
  ) order by pm.sort_order, pm.name), '[]'::jsonb)
  into v_payment_methods
  from public.store_payment_methods pm
  where pm.store_id = p_store_id
    and pm.active = true
    and pm.code <> 'pending'
    and pm.affects_cashbook = true;

  with eligible as (
    select e.*
    from public.cashbook_entries e
    where e.store_id = p_store_id
      and e.status = 'confirmed'
      and e.affects_balance = true
  ), movements as (
    select e.source_financial_account_id as account_id,
           coalesce(nullif(e.payment_method_code, ''), nullif(e.payment_method, ''), 'other') as payment_method_code,
           -e.amount::numeric as signed_amount,
           0::numeric as inflow,
           e.amount::numeric as outflow,
           e.occurred_at
    from eligible e
    where e.source_financial_account_id is not null
    union all
    select e.destination_financial_account_id as account_id,
           coalesce(nullif(e.payment_method_code, ''), nullif(e.payment_method, ''), 'other') as payment_method_code,
           e.amount::numeric as signed_amount,
           e.amount::numeric as inflow,
           0::numeric as outflow,
           e.occurred_at
    from eligible e
    where e.destination_financial_account_id is not null
  ), method_totals as (
    select m.account_id, m.payment_method_code,
           sum(m.signed_amount)::numeric as balance,
           sum(m.inflow)::numeric as inflows,
           sum(m.outflow)::numeric as outflows,
           count(*)::bigint as movement_count
    from movements m
    group by m.account_id, m.payment_method_code
  ), per_account as (
    select a.id, a.store_id, a.code, a.name, a.account_type, a.description,
           a.active, a.is_default, a.is_sales_clearing_default, a.sort_order,
           coalesce(sum(m.signed_amount), 0)::numeric as balance,
           coalesce(sum(m.inflow), 0)::numeric as inflows,
           coalesce(sum(m.outflow), 0)::numeric as outflows,
           count(m.account_id)::bigint as movement_count,
           max(m.occurred_at) as last_movement_at,
           coalesce((
             select jsonb_agg(apm.payment_method_code order by pm.sort_order, apm.payment_method_code)
             from public.store_financial_account_payment_methods apm
             left join public.store_payment_methods pm
               on pm.store_id = apm.store_id and pm.code = apm.payment_method_code
             where apm.store_id = p_store_id
               and apm.account_id = a.id
               and apm.active = true
           ), '[]'::jsonb) as accepted_payment_methods,
           coalesce((
             select jsonb_agg(jsonb_build_object(
               'payment_method_code', mt.payment_method_code,
               'balance', mt.balance,
               'inflows', mt.inflows,
               'outflows', mt.outflows,
               'movement_count', mt.movement_count
             ) order by mt.payment_method_code)
             from method_totals mt
             where mt.account_id = a.id
           ), '[]'::jsonb) as payment_breakdown
    from public.store_financial_accounts a
    left join movements m on m.account_id = a.id
    where a.store_id = p_store_id
    group by a.id
  )
  select coalesce(jsonb_agg(to_jsonb(pa) order by pa.active desc, pa.sort_order, pa.name), '[]'::jsonb),
         coalesce(sum(pa.balance), 0)
  into v_items, v_allocated_balance
  from per_account pa;

  select coalesce(sum(
    case
      when e.is_transfer then 0
      when e.direction = 'in' then e.amount
      when e.direction = 'out' then -e.amount
      else 0
    end
  ), 0)::numeric
  into v_book_balance
  from public.cashbook_entries e
  where e.store_id = p_store_id
    and e.status = 'confirmed'
    and e.affects_balance = true;

  select jsonb_build_object(
    'count', count(*)::bigint,
    'inflows', coalesce(sum(case when e.direction = 'in' then e.amount else 0 end), 0)::numeric,
    'outflows', coalesce(sum(case when e.direction = 'out' then e.amount else 0 end), 0)::numeric,
    'balance', coalesce(sum(case when e.direction = 'in' then e.amount when e.direction = 'out' then -e.amount else 0 end), 0)::numeric
  )
  into v_unallocated
  from public.cashbook_entries e
  where e.store_id = p_store_id
    and e.status = 'confirmed'
    and e.affects_balance = true
    and (
      (coalesce(e.is_transfer, false) = false and e.direction = 'in' and e.destination_financial_account_id is null)
      or (coalesce(e.is_transfer, false) = false and e.direction = 'out' and e.source_financial_account_id is null)
      or (coalesce(e.is_transfer, false) = true and (e.source_financial_account_id is null or e.destination_financial_account_id is null))
    );

  return jsonb_build_object(
    'ok', true,
    'can_manage', v_can_manage,
    'accounts', v_items,
    'payment_methods', v_payment_methods,
    'summary', jsonb_build_object(
      'book_balance', v_book_balance,
      'allocated_balance', v_allocated_balance,
      'unallocated_balance', v_book_balance - v_allocated_balance
    ),
    'unallocated', v_unallocated
  );
end;
$function$;

create or replace function public.classify_cashbook_entry_financial_account_safe(
  p_store_id uuid,
  p_entry_id uuid,
  p_account_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $function$
declare
  v_entry public.cashbook_entries%rowtype;
  v_old_source uuid;
  v_old_destination uuid;
  v_new_source uuid;
  v_new_destination uuid;
  v_payment_code text;
  v_base_code text;
begin
  if p_store_id is null or p_entry_id is null or p_account_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_parameters');
  end if;

  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    if auth.uid() is null or not (
      public.app_is_store_owner(p_store_id)
      or public.user_has_store_permission_v2(p_store_id, 'financial.accounts.manage')
      or public.user_has_store_permission_v2(p_store_id, 'financial.manage')
      or public.user_has_store_permission_v2(p_store_id, 'cashbook.create')
    ) then
      return jsonb_build_object('ok', false, 'error', 'access_denied');
    end if;
  end if;

  if not exists (
    select 1 from public.store_financial_accounts a
    where a.id = p_account_id and a.store_id = p_store_id and a.active = true
  ) then
    return jsonb_build_object('ok', false, 'error', 'invalid_financial_account');
  end if;

  select * into v_entry
  from public.cashbook_entries e
  where e.id = p_entry_id and e.store_id = p_store_id
  for update;

  if not found then return jsonb_build_object('ok', false, 'error', 'entry_not_found'); end if;
  if v_entry.status <> 'confirmed' or v_entry.affects_balance is not true then
    return jsonb_build_object('ok', false, 'error', 'entry_not_classifiable');
  end if;
  if coalesce(v_entry.is_transfer, false) then
    return jsonb_build_object('ok', false, 'error', 'transfer_requires_dedicated_flow');
  end if;

  v_payment_code := coalesce(nullif(v_entry.payment_method_code, ''), nullif(v_entry.payment_method, ''));
  if v_payment_code is not null then
    select coalesce(pm.base_code, pm.code) into v_base_code
    from public.store_payment_methods pm
    where pm.store_id = p_store_id and pm.code = v_payment_code
    limit 1;
    v_base_code := coalesce(v_base_code, v_payment_code);

    if not exists (
      select 1 from public.store_financial_account_payment_methods apm
      where apm.store_id = p_store_id
        and apm.account_id = p_account_id
        and apm.payment_method_code in (v_payment_code, v_base_code)
        and apm.active = true
    ) then
      return jsonb_build_object('ok', false, 'error', 'account_does_not_accept_payment_method', 'payment_method_code', v_payment_code);
    end if;
  end if;

  v_old_source := v_entry.source_financial_account_id;
  v_old_destination := v_entry.destination_financial_account_id;
  v_new_source := v_old_source;
  v_new_destination := v_old_destination;

  if v_entry.direction = 'in' then
    if v_entry.destination_financial_account_id is not null then
      return jsonb_build_object('ok', false, 'error', 'entry_already_allocated');
    end if;
    v_new_destination := p_account_id;
  elsif v_entry.direction = 'out' then
    if v_entry.source_financial_account_id is not null then
      return jsonb_build_object('ok', false, 'error', 'entry_already_allocated');
    end if;
    v_new_source := p_account_id;
  else
    return jsonb_build_object('ok', false, 'error', 'unsupported_direction');
  end if;

  update public.cashbook_entries
  set source_financial_account_id = v_new_source,
      destination_financial_account_id = v_new_destination,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'financial_account_classified_at', now(),
        'financial_account_classified_by', auth.uid(),
        'financial_account_classification_reason', nullif(trim(coalesce(p_reason, '')), '')
      ),
      updated_at = now()
  where id = p_entry_id and store_id = p_store_id;

  insert into public.cashbook_financial_account_allocation_audit(
    store_id, cashbook_entry_id,
    old_source_financial_account_id, old_destination_financial_account_id,
    new_source_financial_account_id, new_destination_financial_account_id,
    reason, changed_by, metadata
  ) values (
    p_store_id, p_entry_id,
    v_old_source, v_old_destination,
    v_new_source, v_new_destination,
    nullif(trim(coalesce(p_reason, '')), ''), auth.uid(),
    jsonb_build_object('source', 'saldos_por_conta_manual_classification')
  );

  return jsonb_build_object(
    'ok', true,
    'entry_id', p_entry_id,
    'source_financial_account_id', v_new_source,
    'destination_financial_account_id', v_new_destination
  );
end;
$function$;

create or replace function public.classify_cashbook_entries_bulk_safe(
  p_store_id uuid,
  p_entry_ids uuid[],
  p_account_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $function$
declare
  v_requested integer;
  v_valid integer;
  v_entry record;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if p_store_id is null or p_account_id is null or p_entry_ids is null then
    return jsonb_build_object('ok', false, 'error', 'missing_parameters');
  end if;

  v_requested := cardinality(array(select distinct x from unnest(p_entry_ids) x where x is not null));
  if coalesce(v_requested, 0) = 0 then return jsonb_build_object('ok', false, 'error', 'empty_selection'); end if;
  if v_requested > 500 then return jsonb_build_object('ok', false, 'error', 'too_many_entries'); end if;

  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    if auth.uid() is null or not (
      public.app_is_store_owner(p_store_id)
      or public.user_has_store_permission_v2(p_store_id, 'financial.accounts.manage')
      or public.user_has_store_permission_v2(p_store_id, 'financial.manage')
      or public.user_has_store_permission_v2(p_store_id, 'cashbook.create')
    ) then
      return jsonb_build_object('ok', false, 'error', 'access_denied');
    end if;
  end if;

  if not exists (
    select 1 from public.store_financial_accounts a
    where a.id = p_account_id and a.store_id = p_store_id and a.active = true
  ) then
    return jsonb_build_object('ok', false, 'error', 'invalid_financial_account');
  end if;

  select count(*) into v_valid
  from public.cashbook_entries e
  where e.store_id = p_store_id
    and e.id = any(p_entry_ids)
    and e.status = 'confirmed'
    and e.affects_balance = true
    and coalesce(e.is_transfer, false) = false
    and ((e.direction = 'in' and e.destination_financial_account_id is null)
      or (e.direction = 'out' and e.source_financial_account_id is null));

  if v_valid <> v_requested then
    return jsonb_build_object('ok', false, 'error', 'selection_contains_non_classifiable_entries');
  end if;

  if exists (
    select 1
    from public.cashbook_entries e
    where e.store_id = p_store_id
      and e.id = any(p_entry_ids)
      and nullif(coalesce(e.payment_method_code, e.payment_method, ''), '') is not null
      and not exists (
        select 1
        from public.store_financial_account_payment_methods apm
        where apm.store_id = p_store_id
          and apm.account_id = p_account_id
          and apm.active = true
          and apm.payment_method_code in (
            coalesce(e.payment_method_code, e.payment_method),
            coalesce((
              select pm.base_code
              from public.store_payment_methods pm
              where pm.store_id = p_store_id
                and pm.code = coalesce(e.payment_method_code, e.payment_method)
              limit 1
            ), coalesce(e.payment_method_code, e.payment_method))
          )
      )
  ) then
    return jsonb_build_object('ok', false, 'error', 'account_does_not_accept_all_payment_methods');
  end if;

  for v_entry in
    select e.*
    from public.cashbook_entries e
    where e.store_id = p_store_id and e.id = any(p_entry_ids)
    for update
  loop
    insert into public.cashbook_financial_account_allocation_audit(
      store_id, cashbook_entry_id,
      old_source_financial_account_id, old_destination_financial_account_id,
      new_source_financial_account_id, new_destination_financial_account_id,
      reason, changed_by, metadata
    ) values (
      p_store_id, v_entry.id,
      v_entry.source_financial_account_id, v_entry.destination_financial_account_id,
      case when v_entry.direction = 'out' then p_account_id else v_entry.source_financial_account_id end,
      case when v_entry.direction = 'in' then p_account_id else v_entry.destination_financial_account_id end,
      v_reason, auth.uid(),
      jsonb_build_object('source', 'saldos_por_conta_bulk_classification')
    );
  end loop;

  update public.cashbook_entries e
  set source_financial_account_id = case when e.direction = 'out' then p_account_id else e.source_financial_account_id end,
      destination_financial_account_id = case when e.direction = 'in' then p_account_id else e.destination_financial_account_id end,
      metadata = coalesce(e.metadata, '{}'::jsonb) || jsonb_build_object(
        'financial_account_classified_at', now(),
        'financial_account_classified_by', auth.uid(),
        'financial_account_classification_reason', v_reason,
        'financial_account_bulk_classification', true
      ),
      updated_at = now()
  where e.store_id = p_store_id and e.id = any(p_entry_ids);

  return jsonb_build_object('ok', true, 'classified_count', v_requested, 'account_id', p_account_id);
end;
$function$;

create or replace function public.change_cashbook_entry_payment_route_safe(
  p_store_id uuid,
  p_entry_id uuid,
  p_payment_method_code text,
  p_account_id uuid default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $function$
declare
  v_entry public.cashbook_entries%rowtype;
  v_method record;
  v_old_payment_code text;
  v_old_source uuid;
  v_old_destination uuid;
  v_new_source uuid;
  v_new_destination uuid;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_payment_enum public.payment_method;
begin
  if p_store_id is null or p_entry_id is null or nullif(trim(coalesce(p_payment_method_code, '')), '') is null then
    return jsonb_build_object('ok', false, 'error', 'missing_parameters');
  end if;

  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    if auth.uid() is null or not (
      public.app_is_store_owner(p_store_id)
      or public.user_has_store_permission_v2(p_store_id, 'financial.accounts.manage')
      or public.user_has_store_permission_v2(p_store_id, 'financial.manage')
      or public.user_has_store_permission_v2(p_store_id, 'cashbook.create')
      or public.user_has_store_permission_v2(p_store_id, 'orders.manage')
    ) then
      return jsonb_build_object('ok', false, 'error', 'access_denied');
    end if;
  end if;

  select * into v_entry
  from public.cashbook_entries e
  where e.id = p_entry_id and e.store_id = p_store_id
  for update;

  if not found then return jsonb_build_object('ok', false, 'error', 'entry_not_found'); end if;
  if v_entry.status <> 'confirmed' or v_entry.affects_balance is not true then
    return jsonb_build_object('ok', false, 'error', 'entry_not_adjustable');
  end if;
  if coalesce(v_entry.is_transfer, false) then
    return jsonb_build_object('ok', false, 'error', 'transfer_requires_dedicated_flow');
  end if;

  select pm.code, pm.name, pm.affects_cashbook,
         coalesce(pm.base_code, pm.code) as base_code,
         pm.preferred_financial_account_id
  into v_method
  from public.store_payment_methods pm
  where pm.store_id = p_store_id
    and pm.code = trim(p_payment_method_code)
    and pm.active = true
  limit 1;

  if v_method.code is null then return jsonb_build_object('ok', false, 'error', 'payment_method_disabled'); end if;
  if v_method.code = 'pending' or coalesce(v_method.affects_cashbook, false) is not true then
    return jsonb_build_object('ok', false, 'error', 'payment_method_not_receipt');
  end if;

  v_old_payment_code := coalesce(nullif(v_entry.payment_method_code, ''), nullif(v_entry.payment_method, ''));
  v_old_source := v_entry.source_financial_account_id;
  v_old_destination := v_entry.destination_financial_account_id;
  v_new_source := v_old_source;
  v_new_destination := v_old_destination;

  if p_account_id is not null then
    if not exists (
      select 1 from public.store_financial_accounts a
      where a.id = p_account_id and a.store_id = p_store_id and a.active = true
    ) then
      return jsonb_build_object('ok', false, 'error', 'invalid_financial_account');
    end if;

    if not exists (
      select 1 from public.store_financial_account_payment_methods apm
      where apm.store_id = p_store_id
        and apm.account_id = p_account_id
        and apm.payment_method_code in (v_method.code, v_method.base_code)
        and apm.active = true
    ) then
      return jsonb_build_object('ok', false, 'error', 'account_does_not_accept_payment_method');
    end if;

    if v_entry.direction = 'in' then
      v_new_destination := p_account_id;
    elsif v_entry.direction = 'out' then
      v_new_source := p_account_id;
    else
      return jsonb_build_object('ok', false, 'error', 'unsupported_direction');
    end if;
  else
    if v_entry.direction = 'in' and v_old_destination is not null and not exists (
      select 1 from public.store_financial_account_payment_methods apm
      where apm.store_id = p_store_id
        and apm.account_id = v_old_destination
        and apm.payment_method_code in (v_method.code, v_method.base_code)
        and apm.active = true
    ) then
      return jsonb_build_object('ok', false, 'error', 'account_required_for_payment_change');
    end if;

    if v_entry.direction = 'out' and v_old_source is not null and not exists (
      select 1 from public.store_financial_account_payment_methods apm
      where apm.store_id = p_store_id
        and apm.account_id = v_old_source
        and apm.payment_method_code in (v_method.code, v_method.base_code)
        and apm.active = true
    ) then
      return jsonb_build_object('ok', false, 'error', 'account_required_for_payment_change');
    end if;
  end if;

  update public.cashbook_entries
  set payment_method = v_method.code,
      payment_method_code = v_method.code,
      source_financial_account_id = v_new_source,
      destination_financial_account_id = v_new_destination,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'payment_route_changed_at', now(),
        'payment_route_changed_by', auth.uid(),
        'old_payment_method_code', v_old_payment_code,
        'new_payment_method_code', v_method.code,
        'new_payment_base_code', v_method.base_code,
        'preferred_financial_account_id', v_method.preferred_financial_account_id,
        'payment_route_change_reason', v_reason
      ),
      updated_at = now()
  where id = p_entry_id and store_id = p_store_id;

  v_payment_enum := case
    when v_method.base_code = 'cash' then 'cash'::public.payment_method
    when v_method.base_code = 'pix' then 'pix'::public.payment_method
    when v_method.base_code in ('debit_card', 'credit_card', 'card') then 'card'::public.payment_method
    else 'pending'::public.payment_method
  end;

  if v_entry.order_id is not null then
    update public.orders o
    set payment_method = v_payment_enum,
        payment_method_code = v_method.code,
        payment_metadata = coalesce(o.payment_metadata, '{}'::jsonb) || jsonb_build_object(
          'code', v_method.code,
          'base_code', v_method.base_code,
          'name', v_method.name,
          'affects_cashbook', true,
          'changed_after_sale', true,
          'changed_after_sale_at', now(),
          'changed_after_sale_by', auth.uid(),
          'change_reason', v_reason
        ),
        commercial_metadata = coalesce(o.commercial_metadata, '{}'::jsonb) || jsonb_build_object(
          'payment_method_code', v_method.code,
          'payment_method_base_code', v_method.base_code,
          'payment_method_name', v_method.name,
          'payment_changed_after_sale', true,
          'payment_changed_after_sale_at', now(),
          'payment_changed_after_sale_by', auth.uid()
        )
    where o.id = v_entry.order_id and o.store_id = p_store_id;
  end if;

  insert into public.cashbook_payment_route_audit(
    store_id, cashbook_entry_id, order_id,
    old_payment_method_code, new_payment_method_code,
    old_source_financial_account_id, old_destination_financial_account_id,
    new_source_financial_account_id, new_destination_financial_account_id,
    reason, changed_by, metadata
  ) values (
    p_store_id, p_entry_id, v_entry.order_id,
    v_old_payment_code, v_method.code,
    v_old_source, v_old_destination,
    v_new_source, v_new_destination,
    v_reason, auth.uid(),
    jsonb_build_object(
      'source', 'financial_accounts_reconciliation',
      'base_code', v_method.base_code,
      'preferred_financial_account_id', v_method.preferred_financial_account_id
    )
  );

  return jsonb_build_object(
    'ok', true,
    'entry_id', p_entry_id,
    'payment_method_code', v_method.code,
    'payment_method_base_code', v_method.base_code,
    'preferred_financial_account_id', v_method.preferred_financial_account_id,
    'source_financial_account_id', v_new_source,
    'destination_financial_account_id', v_new_destination,
    'order_id', v_entry.order_id
  );
end;
$function$;

create or replace function public.transfer_financial_account_balance_safe(
  p_store_id uuid,
  p_source_account_id uuid,
  p_destination_account_id uuid,
  p_payment_method_code text,
  p_amount numeric,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $function$
declare
  v_available numeric := 0;
  v_entry_id uuid;
  v_entry_code text;
  v_group_id uuid := gen_random_uuid();
  v_payment_code text := lower(trim(coalesce(p_payment_method_code, '')));
  v_base_code text;
begin
  if p_store_id is null or p_source_account_id is null or p_destination_account_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_parameters');
  end if;
  if p_source_account_id = p_destination_account_id then return jsonb_build_object('ok', false, 'error', 'same_account'); end if;
  if coalesce(p_amount, 0) <= 0 then return jsonb_build_object('ok', false, 'error', 'invalid_amount'); end if;
  if v_payment_code = '' then return jsonb_build_object('ok', false, 'error', 'missing_payment_method'); end if;

  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    if auth.uid() is null or not (
      public.app_is_store_owner(p_store_id)
      or public.user_has_store_permission_v2(p_store_id, 'financial.accounts.manage')
      or public.user_has_store_permission_v2(p_store_id, 'financial.manage')
      or public.user_has_store_permission_v2(p_store_id, 'cashbook.create')
    ) then
      return jsonb_build_object('ok', false, 'error', 'access_denied');
    end if;
  end if;

  if not exists (select 1 from public.store_financial_accounts a where a.id = p_source_account_id and a.store_id = p_store_id and a.active = true)
     or not exists (select 1 from public.store_financial_accounts a where a.id = p_destination_account_id and a.store_id = p_store_id and a.active = true) then
    return jsonb_build_object('ok', false, 'error', 'invalid_account');
  end if;

  select coalesce(pm.base_code, pm.code) into v_base_code
  from public.store_payment_methods pm
  where pm.store_id = p_store_id and pm.code = v_payment_code
  limit 1;
  v_base_code := coalesce(v_base_code, v_payment_code);

  if not exists (
    select 1 from public.store_financial_account_payment_methods apm
    where apm.store_id = p_store_id
      and apm.account_id = p_destination_account_id
      and apm.payment_method_code in (v_payment_code, v_base_code)
      and apm.active = true
  ) then
    return jsonb_build_object('ok', false, 'error', 'destination_does_not_accept_payment_method');
  end if;

  select coalesce(sum(
    case
      when e.destination_financial_account_id = p_source_account_id then e.amount
      when e.source_financial_account_id = p_source_account_id then -e.amount
      else 0
    end
  ), 0)::numeric
  into v_available
  from public.cashbook_entries e
  where e.store_id = p_store_id
    and e.status = 'confirmed'
    and e.affects_balance = true
    and coalesce(e.payment_method_code, e.payment_method, '') = v_payment_code
    and (e.source_financial_account_id = p_source_account_id or e.destination_financial_account_id = p_source_account_id);

  if v_available < p_amount then
    return jsonb_build_object('ok', false, 'error', 'insufficient_method_balance', 'available', v_available);
  end if;

  v_entry_code := public.generate_cashbook_entry_code();

  insert into public.cashbook_entries(
    store_id, entry_code, entry_date, occurred_at, type, direction, amount, description,
    notes, payment_method, payment_method_code, source, status, affects_balance, metadata,
    created_by, source_financial_account_id, destination_financial_account_id,
    is_transfer, transfer_group_id, affects_cash_drawer, affects_financial_result
  ) values (
    p_store_id, v_entry_code, (now() at time zone 'America/Sao_Paulo')::date, now(),
    'transfer', 'out', p_amount, 'Transferência entre contas financeiras',
    nullif(trim(coalesce(p_reason, '')), ''),
    v_payment_code, v_payment_code, 'financial_account_transfer', 'confirmed', true,
    jsonb_build_object(
      'source', 'saldos_por_conta_transfer',
      'payment_method_code', v_payment_code,
      'payment_method_base_code', v_base_code,
      'reason', nullif(trim(coalesce(p_reason, '')), '')
    ),
    auth.uid(), p_source_account_id, p_destination_account_id,
    true, v_group_id, false, false
  ) returning id into v_entry_id;

  return jsonb_build_object(
    'ok', true,
    'entry_id', v_entry_id,
    'entry_code', v_entry_code,
    'transfer_group_id', v_group_id,
    'payment_method_code', v_payment_code,
    'payment_method_base_code', v_base_code,
    'amount', p_amount,
    'available_before', v_available,
    'available_after', v_available - p_amount
  );
end;
$function$;

revoke all on function public.get_financial_account_balances_safe(uuid) from public, anon;
grant execute on function public.get_financial_account_balances_safe(uuid) to authenticated, service_role;
revoke all on function public.classify_cashbook_entry_financial_account_safe(uuid, uuid, uuid, text) from public, anon;
grant execute on function public.classify_cashbook_entry_financial_account_safe(uuid, uuid, uuid, text) to authenticated, service_role;
revoke all on function public.classify_cashbook_entries_bulk_safe(uuid, uuid[], uuid, text) from public, anon;
grant execute on function public.classify_cashbook_entries_bulk_safe(uuid, uuid[], uuid, text) to authenticated, service_role;
revoke all on function public.change_cashbook_entry_payment_route_safe(uuid, uuid, text, uuid, text) from public, anon;
grant execute on function public.change_cashbook_entry_payment_route_safe(uuid, uuid, text, uuid, text) to authenticated, service_role;
revoke all on function public.transfer_financial_account_balance_safe(uuid, uuid, uuid, text, numeric, text) from public, anon;
grant execute on function public.transfer_financial_account_balance_safe(uuid, uuid, uuid, text, numeric, text) to authenticated, service_role;