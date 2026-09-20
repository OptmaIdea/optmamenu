create table if not exists public.cashbook_financial_account_allocation_audit (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  cashbook_entry_id uuid not null references public.cashbook_entries(id) on delete cascade,
  old_source_financial_account_id uuid null references public.store_financial_accounts(id),
  old_destination_financial_account_id uuid null references public.store_financial_accounts(id),
  new_source_financial_account_id uuid null references public.store_financial_accounts(id),
  new_destination_financial_account_id uuid null references public.store_financial_accounts(id),
  reason text null,
  changed_by uuid null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

alter table public.cashbook_financial_account_allocation_audit enable row level security;
revoke all on table public.cashbook_financial_account_allocation_audit from anon, authenticated;
grant all on table public.cashbook_financial_account_allocation_audit to service_role;

create index if not exists idx_cashbook_financial_account_allocation_audit_store_entry
  on public.cashbook_financial_account_allocation_audit(store_id, cashbook_entry_id, created_at desc);

create or replace function public.get_financial_account_balances_safe(p_store_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $function$
declare
  v_items jsonb := '[]'::jsonb;
  v_unallocated jsonb := '{}'::jsonb;
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

  with eligible as (
    select e.*
    from public.cashbook_entries e
    where e.store_id = p_store_id
      and e.status = 'confirmed'
      and e.affects_balance = true
  ), movements as (
    select e.source_financial_account_id as account_id,
           -e.amount::numeric as signed_amount,
           0::numeric as inflow,
           e.amount::numeric as outflow,
           e.occurred_at
    from eligible e
    where e.source_financial_account_id is not null
    union all
    select e.destination_financial_account_id as account_id,
           e.amount::numeric as signed_amount,
           e.amount::numeric as inflow,
           0::numeric as outflow,
           e.occurred_at
    from eligible e
    where e.destination_financial_account_id is not null
  ), per_account as (
    select a.id, a.store_id, a.code, a.name, a.account_type, a.description,
           a.active, a.is_default, a.sort_order,
           coalesce(sum(m.signed_amount), 0)::numeric as balance,
           coalesce(sum(m.inflow), 0)::numeric as inflows,
           coalesce(sum(m.outflow), 0)::numeric as outflows,
           count(m.account_id)::bigint as movement_count,
           max(m.occurred_at) as last_movement_at
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
    'summary', jsonb_build_object(
      'book_balance', v_book_balance,
      'allocated_balance', v_allocated_balance,
      'unallocated_balance', v_book_balance - v_allocated_balance
    ),
    'unallocated', v_unallocated
  );
end;
$function$;

revoke all on function public.get_financial_account_balances_safe(uuid) from public, anon;
grant execute on function public.get_financial_account_balances_safe(uuid) to authenticated, service_role;

create or replace function public.list_unallocated_cashbook_entries_safe(
  p_store_id uuid,
  p_limit integer default 100,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $function$
declare
  v_items jsonb := '[]'::jsonb;
  v_total bigint := 0;
  v_limit integer := greatest(1, least(coalesce(p_limit, 100), 500));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
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

  with unallocated as (
    select e.*
    from public.cashbook_entries e
    where e.store_id = p_store_id
      and e.status = 'confirmed'
      and e.affects_balance = true
      and (
        (coalesce(e.is_transfer, false) = false and e.direction = 'in' and e.destination_financial_account_id is null)
        or (coalesce(e.is_transfer, false) = false and e.direction = 'out' and e.source_financial_account_id is null)
        or (coalesce(e.is_transfer, false) = true and (e.source_financial_account_id is null or e.destination_financial_account_id is null))
      )
  ), page as (
    select u.id, u.entry_code, u.entry_date, u.occurred_at, u.direction, u.amount,
           u.description, u.notes, u.payment_method, u.payment_method_code, u.source,
           u.source_id, u.order_id, u.customer_id, u.is_transfer,
           u.source_financial_account_id, u.destination_financial_account_id,
           case when u.direction = 'in' then u.amount else -u.amount end as signed_amount,
           case when u.direction = 'in' then 'destination' else 'source' end as expected_side
    from unallocated u
    order by u.occurred_at desc, u.id desc
    limit v_limit offset v_offset
  )
  select coalesce(jsonb_agg(to_jsonb(page) order by page.occurred_at desc, page.id desc), '[]'::jsonb)
    into v_items
  from page;

  select count(*)
    into v_total
  from public.cashbook_entries e
  where e.store_id = p_store_id
    and e.status = 'confirmed'
    and e.affects_balance = true
    and (
      (coalesce(e.is_transfer, false) = false and e.direction = 'in' and e.destination_financial_account_id is null)
      or (coalesce(e.is_transfer, false) = false and e.direction = 'out' and e.source_financial_account_id is null)
      or (coalesce(e.is_transfer, false) = true and (e.source_financial_account_id is null or e.destination_financial_account_id is null))
    );

  return jsonb_build_object('ok', true, 'items', v_items, 'total', v_total, 'limit', v_limit, 'offset', v_offset);
end;
$function$;

revoke all on function public.list_unallocated_cashbook_entries_safe(uuid, integer, integer) from public, anon;
grant execute on function public.list_unallocated_cashbook_entries_safe(uuid, integer, integer) to authenticated, service_role;

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
    select 1
    from public.store_financial_accounts a
    where a.id = p_account_id
      and a.store_id = p_store_id
      and a.active = true
  ) then
    return jsonb_build_object('ok', false, 'error', 'invalid_financial_account');
  end if;

  select *
    into v_entry
  from public.cashbook_entries e
  where e.id = p_entry_id
    and e.store_id = p_store_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'entry_not_found');
  end if;

  if v_entry.status <> 'confirmed' or v_entry.affects_balance is not true then
    return jsonb_build_object('ok', false, 'error', 'entry_not_classifiable');
  end if;

  if coalesce(v_entry.is_transfer, false) then
    return jsonb_build_object('ok', false, 'error', 'transfer_requires_dedicated_flow');
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
    store_id,
    cashbook_entry_id,
    old_source_financial_account_id,
    old_destination_financial_account_id,
    new_source_financial_account_id,
    new_destination_financial_account_id,
    reason,
    changed_by,
    metadata
  ) values (
    p_store_id,
    p_entry_id,
    v_old_source,
    v_old_destination,
    v_new_source,
    v_new_destination,
    nullif(trim(coalesce(p_reason, '')), ''),
    auth.uid(),
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

revoke all on function public.classify_cashbook_entry_financial_account_safe(uuid, uuid, uuid, text) from public, anon;
grant execute on function public.classify_cashbook_entry_financial_account_safe(uuid, uuid, uuid, text) to authenticated, service_role;
