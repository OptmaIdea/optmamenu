alter table public.store_financial_accounts
  add column if not exists is_sales_clearing_default boolean not null default false;

create unique index if not exists ux_store_financial_accounts_sales_clearing_default
  on public.store_financial_accounts(store_id)
  where is_sales_clearing_default = true;

create table if not exists public.store_financial_account_payment_methods (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  account_id uuid not null references public.store_financial_accounts(id) on delete cascade,
  payment_method_code text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique(account_id, payment_method_code)
);

create index if not exists idx_store_financial_account_payment_methods_store_account
  on public.store_financial_account_payment_methods(store_id, account_id, active);

alter table public.store_financial_account_payment_methods enable row level security;
revoke all on table public.store_financial_account_payment_methods from public, anon, authenticated;
grant all on table public.store_financial_account_payment_methods to service_role;

with ranked as (
  select a.id,
         row_number() over (
           partition by a.store_id
           order by a.is_default desc, a.sort_order, a.created_at, a.id
         ) as rn
  from public.store_financial_accounts a
  where a.active = true
    and a.account_type = 'cash_drawer'
)
update public.store_financial_accounts a
set is_sales_clearing_default = true,
    updated_at = now()
from ranked r
where a.id = r.id
  and r.rn = 1
  and not exists (
    select 1
    from public.store_financial_accounts current_default
    where current_default.store_id = a.store_id
      and current_default.is_sales_clearing_default = true
  );

insert into public.store_financial_account_payment_methods(
  store_id, account_id, payment_method_code, active, metadata
)
select a.store_id,
       a.id,
       defaults.payment_method_code,
       true,
       jsonb_build_object('source', 'account_type_default_seed')
from public.store_financial_accounts a
cross join lateral (
  select payment_method_code
  from (values
    ('cash_drawer', 'cash'),
    ('cash_drawer', 'pix'),
    ('cash_drawer', 'debit_card'),
    ('cash_drawer', 'credit_card'),
    ('safe', 'cash'),
    ('bank', 'pix'),
    ('bank', 'bank_transfer'),
    ('pix_wallet', 'pix'),
    ('card_acquirer', 'debit_card'),
    ('card_acquirer', 'credit_card'),
    ('card_receivable', 'debit_card'),
    ('card_receivable', 'credit_card'),
    ('owner', 'cash'),
    ('owner', 'pix'),
    ('owner', 'bank_transfer')
  ) v(account_type, payment_method_code)
  where v.account_type = a.account_type
) defaults
on conflict (account_id, payment_method_code) do nothing;

create or replace function public.set_financial_account_routing_safe(
  p_store_id uuid,
  p_account_id uuid,
  p_payment_method_codes text[] default '{}'::text[],
  p_is_sales_clearing_default boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $function$
declare
  v_account public.store_financial_accounts%rowtype;
  v_codes text[] := array(
    select distinct lower(trim(code))
    from unnest(coalesce(p_payment_method_codes, '{}'::text[])) code
    where nullif(trim(code), '') is not null
  );
begin
  if p_store_id is null or p_account_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_parameters');
  end if;

  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    if auth.uid() is null or not (
      public.app_is_store_owner(p_store_id)
      or public.user_has_store_permission_v2(p_store_id, 'financial.accounts.manage')
      or public.user_has_store_permission_v2(p_store_id, 'financial.manage')
    ) then
      return jsonb_build_object('ok', false, 'error', 'access_denied');
    end if;
  end if;

  select * into v_account
  from public.store_financial_accounts a
  where a.id = p_account_id
    and a.store_id = p_store_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'account_not_found');
  end if;

  if exists (
    select 1
    from unnest(v_codes) c(code)
    where not exists (
      select 1
      from public.store_payment_methods pm
      where pm.store_id = p_store_id
        and pm.code = c.code
    )
  ) then
    return jsonb_build_object('ok', false, 'error', 'unknown_payment_method');
  end if;

  update public.store_financial_account_payment_methods
  set active = false, updated_at = now()
  where store_id = p_store_id
    and account_id = p_account_id;

  insert into public.store_financial_account_payment_methods(
    store_id, account_id, payment_method_code, active, updated_at, metadata
  )
  select p_store_id, p_account_id, c.code, true, now(), jsonb_build_object('source', 'financial_account_routing_ui')
  from unnest(v_codes) c(code)
  on conflict (account_id, payment_method_code)
  do update set active = true, updated_at = now(), metadata = excluded.metadata;

  if coalesce(p_is_sales_clearing_default, false) then
    if v_account.active is not true then
      return jsonb_build_object('ok', false, 'error', 'clearing_account_must_be_active');
    end if;

    update public.store_financial_accounts
    set is_sales_clearing_default = false,
        updated_at = now()
    where store_id = p_store_id
      and id <> p_account_id
      and is_sales_clearing_default = true;
  end if;

  update public.store_financial_accounts
  set is_sales_clearing_default = coalesce(p_is_sales_clearing_default, false),
      updated_at = now()
  where id = p_account_id
    and store_id = p_store_id;

  return jsonb_build_object(
    'ok', true,
    'account_id', p_account_id,
    'payment_method_codes', to_jsonb(v_codes),
    'is_sales_clearing_default', coalesce(p_is_sales_clearing_default, false)
  );
end;
$function$;

revoke all on function public.set_financial_account_routing_safe(uuid, uuid, text[], boolean) from public, anon;
grant execute on function public.set_financial_account_routing_safe(uuid, uuid, text[], boolean) to authenticated, service_role;

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
  if coalesce(v_requested, 0) = 0 then
    return jsonb_build_object('ok', false, 'error', 'empty_selection');
  end if;
  if v_requested > 500 then
    return jsonb_build_object('ok', false, 'error', 'too_many_entries');
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

  select count(*) into v_valid
  from public.cashbook_entries e
  where e.store_id = p_store_id
    and e.id = any(p_entry_ids)
    and e.status = 'confirmed'
    and e.affects_balance = true
    and coalesce(e.is_transfer, false) = false
    and (
      (e.direction = 'in' and e.destination_financial_account_id is null)
      or (e.direction = 'out' and e.source_financial_account_id is null)
    );

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
          and apm.payment_method_code = coalesce(e.payment_method_code, e.payment_method)
          and apm.active = true
      )
  ) then
    return jsonb_build_object('ok', false, 'error', 'account_does_not_accept_all_payment_methods');
  end if;

  for v_entry in
    select e.*
    from public.cashbook_entries e
    where e.store_id = p_store_id
      and e.id = any(p_entry_ids)
    for update
  loop
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
      v_entry.id,
      v_entry.source_financial_account_id,
      v_entry.destination_financial_account_id,
      case when v_entry.direction = 'out' then p_account_id else v_entry.source_financial_account_id end,
      case when v_entry.direction = 'in' then p_account_id else v_entry.destination_financial_account_id end,
      v_reason,
      auth.uid(),
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
  where e.store_id = p_store_id
    and e.id = any(p_entry_ids);

  return jsonb_build_object('ok', true, 'classified_count', v_requested, 'account_id', p_account_id);
end;
$function$;

revoke all on function public.classify_cashbook_entries_bulk_safe(uuid, uuid[], uuid, text) from public, anon;
grant execute on function public.classify_cashbook_entries_bulk_safe(uuid, uuid[], uuid, text) to authenticated, service_role;

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
begin
  if p_store_id is null or p_source_account_id is null or p_destination_account_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_parameters');
  end if;
  if p_source_account_id = p_destination_account_id then
    return jsonb_build_object('ok', false, 'error', 'same_account');
  end if;
  if coalesce(p_amount, 0) <= 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_amount');
  end if;
  if v_payment_code = '' then
    return jsonb_build_object('ok', false, 'error', 'missing_payment_method');
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
    where a.id = p_source_account_id and a.store_id = p_store_id and a.active = true
  ) or not exists (
    select 1 from public.store_financial_accounts a
    where a.id = p_destination_account_id and a.store_id = p_store_id and a.active = true
  ) then
    return jsonb_build_object('ok', false, 'error', 'invalid_account');
  end if;

  if not exists (
    select 1 from public.store_financial_account_payment_methods apm
    where apm.store_id = p_store_id
      and apm.account_id = p_destination_account_id
      and apm.payment_method_code = v_payment_code
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
    'transfer', 'out', p_amount,
    'Transferência entre contas financeiras',
    nullif(trim(coalesce(p_reason, '')), ''),
    v_payment_code, v_payment_code, 'financial_account_transfer', 'confirmed', true,
    jsonb_build_object(
      'source', 'saldos_por_conta_transfer',
      'payment_method_code', v_payment_code,
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
    'amount', p_amount,
    'available_before', v_available,
    'available_after', v_available - p_amount
  );
end;
$function$;

revoke all on function public.transfer_financial_account_balance_safe(uuid, uuid, uuid, text, numeric, text) from public, anon;
grant execute on function public.transfer_financial_account_balance_safe(uuid, uuid, uuid, text, numeric, text) to authenticated, service_role;

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
    'name', pm.name,
    'affects_cashbook', pm.affects_cashbook
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

revoke all on function public.get_financial_account_balances_safe(uuid) from public, anon;
grant execute on function public.get_financial_account_balances_safe(uuid) to authenticated, service_role;

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

  select * into v_entry
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

  v_payment_code := coalesce(nullif(v_entry.payment_method_code, ''), nullif(v_entry.payment_method, ''));
  if v_payment_code is not null and not exists (
    select 1
    from public.store_financial_account_payment_methods apm
    where apm.store_id = p_store_id
      and apm.account_id = p_account_id
      and apm.payment_method_code = v_payment_code
      and apm.active = true
  ) then
    return jsonb_build_object('ok', false, 'error', 'account_does_not_accept_payment_method', 'payment_method_code', v_payment_code);
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

revoke all on function public.classify_cashbook_entry_financial_account_safe(uuid, uuid, uuid, text) from public, anon;
grant execute on function public.classify_cashbook_entry_financial_account_safe(uuid, uuid, uuid, text) to authenticated, service_role;

create or replace function public.route_sale_cashbook_entry_to_clearing_account()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_account_id uuid;
  v_payment_code text;
  v_should_route boolean := false;
begin
  if new.store_id is null
     or new.type <> 'sale'
     or new.direction <> 'in'
     or new.status <> 'confirmed'
     or new.affects_balance is not true
     or new.destination_financial_account_id is not null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_should_route := true;
  elsif tg_op = 'UPDATE' then
    v_should_route := (old.status is distinct from new.status and new.status = 'confirmed')
      or (old.affects_balance is distinct from new.affects_balance and new.affects_balance = true);
  end if;

  if not v_should_route then
    return new;
  end if;

  v_payment_code := coalesce(nullif(new.payment_method_code, ''), nullif(new.payment_method, ''));
  if v_payment_code is null then
    return new;
  end if;

  select a.id
  into v_account_id
  from public.store_financial_accounts a
  where a.store_id = new.store_id
    and a.active = true
    and a.is_sales_clearing_default = true
    and exists (
      select 1
      from public.store_financial_account_payment_methods apm
      where apm.store_id = new.store_id
        and apm.account_id = a.id
        and apm.payment_method_code = v_payment_code
        and apm.active = true
    )
  limit 1;

  if v_account_id is not null then
    new.destination_financial_account_id := v_account_id;
    new.metadata := coalesce(new.metadata, '{}'::jsonb) || jsonb_build_object(
      'sales_clearing_account_auto_routed', true,
      'sales_clearing_account_id', v_account_id,
      'sales_clearing_payment_method_code', v_payment_code,
      'sales_clearing_routed_at', now()
    );
  else
    new.metadata := coalesce(new.metadata, '{}'::jsonb) || jsonb_build_object(
      'sales_clearing_account_auto_routed', false,
      'sales_clearing_route_failure', 'no_compatible_default_account',
      'sales_clearing_payment_method_code', v_payment_code,
      'sales_clearing_routed_at', now()
    );
  end if;

  return new;
end;
$function$;

revoke all on function public.route_sale_cashbook_entry_to_clearing_account() from public, anon, authenticated;

drop trigger if exists trg_route_sale_cashbook_entry_to_clearing_account on public.cashbook_entries;
create trigger trg_route_sale_cashbook_entry_to_clearing_account
before insert or update of status, affects_balance on public.cashbook_entries
for each row
execute function public.route_sale_cashbook_entry_to_clearing_account();
