create table if not exists public.cashbook_payment_route_audit (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  cashbook_entry_id uuid not null references public.cashbook_entries(id) on delete cascade,
  order_id uuid null references public.orders(id) on delete set null,
  old_payment_method_code text null,
  new_payment_method_code text not null,
  old_source_financial_account_id uuid null references public.store_financial_accounts(id) on delete set null,
  old_destination_financial_account_id uuid null references public.store_financial_accounts(id) on delete set null,
  new_source_financial_account_id uuid null references public.store_financial_accounts(id) on delete set null,
  new_destination_financial_account_id uuid null references public.store_financial_accounts(id) on delete set null,
  reason text null,
  changed_by uuid null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_cashbook_payment_route_audit_store_entry
  on public.cashbook_payment_route_audit(store_id, cashbook_entry_id, created_at desc);

alter table public.cashbook_payment_route_audit enable row level security;
revoke all on table public.cashbook_payment_route_audit from public, anon, authenticated;
grant all on table public.cashbook_payment_route_audit to service_role;

create or replace function public.list_financial_account_movements_safe(
  p_store_id uuid,
  p_account_id uuid,
  p_payment_method_code text default null,
  p_start_date date default null,
  p_end_date date default null,
  p_limit integer default 200,
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
  v_net numeric := 0;
  v_limit integer := greatest(1, least(coalesce(p_limit, 200), 500));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
  v_payment_code text := nullif(trim(coalesce(p_payment_method_code, '')), '');
begin
  if p_store_id is null or p_account_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_parameters');
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

  if not exists (
    select 1 from public.store_financial_accounts a
    where a.id = p_account_id and a.store_id = p_store_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'account_not_found');
  end if;

  with filtered as (
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
      e.is_transfer,
      e.transfer_group_id,
      e.source_financial_account_id,
      e.destination_financial_account_id,
      case
        when e.destination_financial_account_id = p_account_id then 'in'
        when e.source_financial_account_id = p_account_id then 'out'
        else e.direction
      end as account_direction,
      case
        when e.destination_financial_account_id = p_account_id then e.amount
        when e.source_financial_account_id = p_account_id then -e.amount
        else 0
      end::numeric as signed_amount,
      case
        when e.destination_financial_account_id = p_account_id then e.source_financial_account_id
        when e.source_financial_account_id = p_account_id then e.destination_financial_account_id
        else null
      end as counterpart_account_id,
      o.order_code,
      o.customer_name as order_customer_name
    from public.cashbook_entries e
    left join public.orders o on o.id = e.order_id and o.store_id = e.store_id
    where e.store_id = p_store_id
      and e.status = 'confirmed'
      and e.affects_balance = true
      and (e.source_financial_account_id = p_account_id or e.destination_financial_account_id = p_account_id)
      and (v_payment_code is null or coalesce(nullif(e.payment_method_code, ''), nullif(e.payment_method, '')) = v_payment_code)
      and (p_start_date is null or e.entry_date >= p_start_date)
      and (p_end_date is null or e.entry_date <= p_end_date)
  ), page as (
    select f.*, ca.name as counterpart_account_name
    from filtered f
    left join public.store_financial_accounts ca on ca.id = f.counterpart_account_id and ca.store_id = p_store_id
    order by f.occurred_at desc, f.id desc
    limit v_limit offset v_offset
  )
  select coalesce(jsonb_agg(to_jsonb(page) order by page.occurred_at desc, page.id desc), '[]'::jsonb)
    into v_items
  from page;

  select count(*), coalesce(sum(
    case
      when e.destination_financial_account_id = p_account_id then e.amount
      when e.source_financial_account_id = p_account_id then -e.amount
      else 0
    end
  ), 0)::numeric
  into v_total, v_net
  from public.cashbook_entries e
  where e.store_id = p_store_id
    and e.status = 'confirmed'
    and e.affects_balance = true
    and (e.source_financial_account_id = p_account_id or e.destination_financial_account_id = p_account_id)
    and (v_payment_code is null or coalesce(nullif(e.payment_method_code, ''), nullif(e.payment_method, '')) = v_payment_code)
    and (p_start_date is null or e.entry_date >= p_start_date)
    and (p_end_date is null or e.entry_date <= p_end_date);

  return jsonb_build_object('ok', true, 'items', v_items, 'total', v_total, 'net_balance', v_net, 'limit', v_limit, 'offset', v_offset);
end;
$function$;

revoke all on function public.list_financial_account_movements_safe(uuid, uuid, text, date, date, integer, integer) from public, anon;
grant execute on function public.list_financial_account_movements_safe(uuid, uuid, text, date, date, integer, integer) to authenticated, service_role;

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
  if v_entry.status <> 'confirmed' or v_entry.affects_balance is not true then return jsonb_build_object('ok', false, 'error', 'entry_not_adjustable'); end if;
  if coalesce(v_entry.is_transfer, false) then return jsonb_build_object('ok', false, 'error', 'transfer_requires_dedicated_flow'); end if;

  select pm.code, pm.name, pm.affects_cashbook into v_method
  from public.store_payment_methods pm
  where pm.store_id = p_store_id and pm.code = trim(p_payment_method_code) and pm.active = true
  limit 1;

  if v_method.code is null then return jsonb_build_object('ok', false, 'error', 'payment_method_disabled'); end if;
  if v_method.code = 'pending' or coalesce(v_method.affects_cashbook, false) is not true then return jsonb_build_object('ok', false, 'error', 'payment_method_not_receipt'); end if;

  v_old_payment_code := coalesce(nullif(v_entry.payment_method_code, ''), nullif(v_entry.payment_method, ''));
  v_old_source := v_entry.source_financial_account_id;
  v_old_destination := v_entry.destination_financial_account_id;
  v_new_source := v_old_source;
  v_new_destination := v_old_destination;

  if p_account_id is not null then
    if not exists (select 1 from public.store_financial_accounts a where a.id = p_account_id and a.store_id = p_store_id and a.active = true) then
      return jsonb_build_object('ok', false, 'error', 'invalid_financial_account');
    end if;

    if not exists (
      select 1 from public.store_financial_account_payment_methods apm
      where apm.store_id = p_store_id and apm.account_id = p_account_id and apm.payment_method_code = v_method.code and apm.active = true
    ) then
      return jsonb_build_object('ok', false, 'error', 'account_does_not_accept_payment_method');
    end if;

    if v_entry.direction = 'in' then v_new_destination := p_account_id;
    elsif v_entry.direction = 'out' then v_new_source := p_account_id;
    else return jsonb_build_object('ok', false, 'error', 'unsupported_direction'); end if;
  else
    if v_entry.direction = 'in' and v_old_destination is not null and not exists (
      select 1 from public.store_financial_account_payment_methods apm
      where apm.store_id = p_store_id and apm.account_id = v_old_destination and apm.payment_method_code = v_method.code and apm.active = true
    ) then return jsonb_build_object('ok', false, 'error', 'account_required_for_payment_change'); end if;

    if v_entry.direction = 'out' and v_old_source is not null and not exists (
      select 1 from public.store_financial_account_payment_methods apm
      where apm.store_id = p_store_id and apm.account_id = v_old_source and apm.payment_method_code = v_method.code and apm.active = true
    ) then return jsonb_build_object('ok', false, 'error', 'account_required_for_payment_change'); end if;
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
        'payment_route_change_reason', v_reason
      ),
      updated_at = now()
  where id = p_entry_id and store_id = p_store_id;

  v_payment_enum := case
    when v_method.code = 'cash' then 'cash'::public.payment_method
    when v_method.code = 'pix' then 'pix'::public.payment_method
    when v_method.code in ('debit_card', 'credit_card', 'card') then 'card'::public.payment_method
    else 'pending'::public.payment_method
  end;

  if v_entry.order_id is not null then
    update public.orders o
    set payment_method = v_payment_enum,
        payment_method_code = v_method.code,
        payment_metadata = coalesce(o.payment_metadata, '{}'::jsonb) || jsonb_build_object(
          'code', v_method.code,
          'name', v_method.name,
          'affects_cashbook', true,
          'changed_after_sale', true,
          'changed_after_sale_at', now(),
          'changed_after_sale_by', auth.uid(),
          'change_reason', v_reason
        ),
        commercial_metadata = coalesce(o.commercial_metadata, '{}'::jsonb) || jsonb_build_object(
          'payment_method_code', v_method.code,
          'payment_method_name', v_method.name,
          'payment_changed_after_sale', true,
          'payment_changed_after_sale_at', now(),
          'payment_changed_after_sale_by', auth.uid()
        )
    where o.id = v_entry.order_id and o.store_id = p_store_id;
  end if;

  insert into public.cashbook_payment_route_audit(
    store_id, cashbook_entry_id, order_id, old_payment_method_code, new_payment_method_code,
    old_source_financial_account_id, old_destination_financial_account_id,
    new_source_financial_account_id, new_destination_financial_account_id,
    reason, changed_by, metadata
  ) values (
    p_store_id, p_entry_id, v_entry.order_id, v_old_payment_code, v_method.code,
    v_old_source, v_old_destination, v_new_source, v_new_destination,
    v_reason, auth.uid(), jsonb_build_object('source', 'financial_accounts_reconciliation')
  );

  return jsonb_build_object(
    'ok', true,
    'entry_id', p_entry_id,
    'payment_method_code', v_method.code,
    'source_financial_account_id', v_new_source,
    'destination_financial_account_id', v_new_destination,
    'order_id', v_entry.order_id
  );
end;
$function$;

revoke all on function public.change_cashbook_entry_payment_route_safe(uuid, uuid, text, uuid, text) from public, anon;
grant execute on function public.change_cashbook_entry_payment_route_safe(uuid, uuid, text, uuid, text) to authenticated, service_role;
