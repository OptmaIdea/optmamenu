alter table public.store_payment_methods
  add column if not exists base_code text,
  add column if not exists preferred_financial_account_id uuid references public.store_financial_accounts(id) on delete set null;

update public.store_payment_methods
set base_code = case
  when code in ('pending','cash','pix','debit_card','credit_card','bank_transfer','voucher','other') then code
  else 'other'
end
where base_code is null;

alter table public.store_payment_methods
  alter column base_code set default 'other',
  alter column base_code set not null;

alter table public.store_payment_methods
  drop constraint if exists store_payment_methods_code_check;

alter table public.store_payment_methods
  drop constraint if exists store_payment_methods_code_format_check;
alter table public.store_payment_methods
  add constraint store_payment_methods_code_format_check
  check (code ~ '^[a-z0-9][a-z0-9_]{1,63}$');

alter table public.store_payment_methods
  drop constraint if exists store_payment_methods_base_code_check;
alter table public.store_payment_methods
  add constraint store_payment_methods_base_code_check
  check (base_code in ('pending','cash','pix','debit_card','credit_card','bank_transfer','voucher','other'));

create or replace function public.validate_store_payment_method_preferred_account()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if new.preferred_financial_account_id is not null and not exists (
    select 1
    from public.store_financial_accounts a
    where a.id = new.preferred_financial_account_id
      and a.store_id = new.store_id
  ) then
    raise exception 'preferred_financial_account_must_belong_to_store';
  end if;

  if new.base_code is null then
    new.base_code := case
      when new.code in ('pending','cash','pix','debit_card','credit_card','bank_transfer','voucher','other') then new.code
      else 'other'
    end;
  end if;
  return new;
end;
$function$;

revoke all on function public.validate_store_payment_method_preferred_account() from public, anon, authenticated;

drop trigger if exists trg_validate_store_payment_method_preferred_account on public.store_payment_methods;
create trigger trg_validate_store_payment_method_preferred_account
before insert or update of store_id, code, base_code, preferred_financial_account_id
on public.store_payment_methods
for each row execute function public.validate_store_payment_method_preferred_account();

create or replace function public.list_store_payment_methods_with_routing_safe(p_store_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $function$
declare
  v_items jsonb := '[]'::jsonb;
begin
  if p_store_id is null then return jsonb_build_object('ok', false, 'error', 'missing_store_id'); end if;

  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    if auth.uid() is null or not (
      public.app_is_store_owner(p_store_id)
      or public.user_has_store_permission_v2(p_store_id, 'settings.payment.view')
      or public.user_has_store_permission_v2(p_store_id, 'settings.view')
      or public.user_has_store_permission_v2(p_store_id, 'financial.accounts.view')
    ) then return jsonb_build_object('ok', false, 'error', 'access_denied'); end if;
  end if;

  select coalesce(jsonb_agg(
    to_jsonb(pm) || jsonb_build_object(
      'preferred_financial_account_name', a.name,
      'is_custom_variant', pm.code <> pm.base_code
    ) order by pm.sort_order, pm.name
  ), '[]'::jsonb)
  into v_items
  from public.store_payment_methods pm
  left join public.store_financial_accounts a
    on a.id = pm.preferred_financial_account_id and a.store_id = pm.store_id
  where pm.store_id = p_store_id;

  return jsonb_build_object('ok', true, 'items', v_items);
end;
$function$;

revoke all on function public.list_store_payment_methods_with_routing_safe(uuid) from public, anon;
grant execute on function public.list_store_payment_methods_with_routing_safe(uuid) to authenticated, service_role;

create or replace function public.upsert_store_payment_method_variant_safe(
  p_store_id uuid,
  p_method_id uuid default null,
  p_name text default null,
  p_base_code text default null,
  p_code text default null,
  p_description text default null,
  p_preferred_financial_account_id uuid default null,
  p_active boolean default true,
  p_public_enabled boolean default false,
  p_requires_proof boolean default false,
  p_requires_change_for boolean default false,
  p_affects_cashbook boolean default true,
  p_sort_order integer default 500
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $function$
declare
  v_base_code text := lower(trim(coalesce(p_base_code, '')));
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_code text := lower(trim(coalesce(p_code, '')));
  v_slug text;
  v_method public.store_payment_methods%rowtype;
  v_account_name text;
begin
  if p_store_id is null or v_name is null or v_base_code = '' then return jsonb_build_object('ok', false, 'error', 'missing_required_fields'); end if;

  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    if auth.uid() is null or not (
      public.app_is_store_owner(p_store_id)
      or public.user_has_store_permission_v2(p_store_id, 'settings.payment.manage')
    ) then return jsonb_build_object('ok', false, 'error', 'access_denied'); end if;
  end if;

  if v_base_code not in ('cash','pix','debit_card','credit_card','bank_transfer','voucher','other') then return jsonb_build_object('ok', false, 'error', 'invalid_base_code'); end if;

  if p_preferred_financial_account_id is not null then
    select a.name into v_account_name
    from public.store_financial_accounts a
    where a.id = p_preferred_financial_account_id and a.store_id = p_store_id and a.active = true;
    if v_account_name is null then return jsonb_build_object('ok', false, 'error', 'invalid_preferred_financial_account'); end if;
  end if;

  if p_method_id is null then
    if v_code = '' then
      v_slug := lower(regexp_replace(unaccent(v_name), '[^a-zA-Z0-9]+', '_', 'g'));
      v_slug := trim(both '_' from v_slug);
      v_code := left(v_base_code || '_' || v_slug, 56);
    end if;
    if v_code = v_base_code then v_code := left(v_base_code || '_personalizado', 56); end if;
    if v_code !~ '^[a-z0-9][a-z0-9_]{1,63}$' then return jsonb_build_object('ok', false, 'error', 'invalid_code'); end if;
    if exists (select 1 from public.store_payment_methods pm where pm.store_id = p_store_id and pm.code = v_code) then
      v_code := left(v_code, 55) || '_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
    end if;

    insert into public.store_payment_methods(
      store_id, code, base_code, name, description, active, public_enabled, sort_order,
      requires_proof, requires_change_for, affects_cashbook, preferred_financial_account_id,
      metadata, updated_at
    ) values (
      p_store_id, v_code, v_base_code, v_name, nullif(trim(coalesce(p_description, '')), ''),
      coalesce(p_active, true), coalesce(p_public_enabled, false), coalesce(p_sort_order, 500),
      coalesce(p_requires_proof, false), coalesce(p_requires_change_for, false), coalesce(p_affects_cashbook, true),
      p_preferred_financial_account_id,
      jsonb_build_object('custom_variant', true, 'created_by', auth.uid(), 'created_at', now()), now()
    ) returning * into v_method;
  else
    update public.store_payment_methods pm
    set name = v_name,
        description = nullif(trim(coalesce(p_description, '')), ''),
        active = coalesce(p_active, pm.active),
        public_enabled = coalesce(p_public_enabled, pm.public_enabled),
        sort_order = coalesce(p_sort_order, pm.sort_order),
        requires_proof = coalesce(p_requires_proof, pm.requires_proof),
        requires_change_for = coalesce(p_requires_change_for, pm.requires_change_for),
        affects_cashbook = coalesce(p_affects_cashbook, pm.affects_cashbook),
        preferred_financial_account_id = p_preferred_financial_account_id,
        updated_at = now(),
        metadata = coalesce(pm.metadata, '{}'::jsonb) || jsonb_build_object('updated_by', auth.uid(), 'updated_at', now())
    where pm.id = p_method_id and pm.store_id = p_store_id
    returning * into v_method;
    if v_method.id is null then return jsonb_build_object('ok', false, 'error', 'payment_method_not_found'); end if;
  end if;

  if p_preferred_financial_account_id is not null then
    insert into public.store_financial_account_payment_methods(
      store_id, account_id, payment_method_code, active, updated_at, metadata
    ) values (
      p_store_id, p_preferred_financial_account_id, v_method.code, true, now(),
      jsonb_build_object('source', 'payment_method_preferred_account')
    )
    on conflict (account_id, payment_method_code)
    do update set active = true, updated_at = now(), metadata = excluded.metadata;
  end if;

  return jsonb_build_object(
    'ok', true,
    'method', to_jsonb(v_method) || jsonb_build_object(
      'preferred_financial_account_name', v_account_name,
      'is_custom_variant', v_method.code <> v_method.base_code
    )
  );
end;
$function$;

revoke all on function public.upsert_store_payment_method_variant_safe(uuid, uuid, text, text, text, text, uuid, boolean, boolean, boolean, boolean, boolean, integer) from public, anon;
grant execute on function public.upsert_store_payment_method_variant_safe(uuid, uuid, text, text, text, text, uuid, boolean, boolean, boolean, boolean, boolean, integer) to authenticated, service_role;

create or replace function public.normalize_order_payment_method_from_code()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_base_code text;
begin
  if new.store_id is null or nullif(trim(coalesce(new.payment_method_code, '')), '') is null then return new; end if;
  select coalesce(pm.base_code, pm.code) into v_base_code
  from public.store_payment_methods pm
  where pm.store_id = new.store_id and pm.code = new.payment_method_code
  limit 1;
  if v_base_code is null then return new; end if;
  new.payment_method := case
    when v_base_code = 'cash' then 'cash'::public.payment_method
    when v_base_code = 'pix' then 'pix'::public.payment_method
    when v_base_code in ('debit_card','credit_card') then 'card'::public.payment_method
    else 'pending'::public.payment_method
  end;
  return new;
end;
$function$;

revoke all on function public.normalize_order_payment_method_from_code() from public, anon, authenticated;

drop trigger if exists trg_normalize_order_payment_method_from_code on public.orders;
create trigger trg_normalize_order_payment_method_from_code
before insert or update of payment_method_code on public.orders
for each row execute function public.normalize_order_payment_method_from_code();

create or replace function public.route_sale_cashbook_entry_to_clearing_account()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_account_id uuid;
  v_payment_code text;
  v_base_code text;
  v_should_route boolean := false;
begin
  if new.store_id is null or new.type <> 'sale' or new.direction <> 'in' or new.status <> 'confirmed'
     or new.affects_balance is not true or new.destination_financial_account_id is not null then return new; end if;

  if tg_op = 'INSERT' then v_should_route := true;
  elsif tg_op = 'UPDATE' then
    v_should_route := (old.status is distinct from new.status and new.status = 'confirmed')
      or (old.affects_balance is distinct from new.affects_balance and new.affects_balance = true);
  end if;
  if not v_should_route then return new; end if;

  v_payment_code := coalesce(nullif(new.payment_method_code, ''), nullif(new.payment_method, ''));
  if v_payment_code is null then return new; end if;

  select coalesce(pm.base_code, pm.code) into v_base_code
  from public.store_payment_methods pm
  where pm.store_id = new.store_id and pm.code = v_payment_code
  limit 1;
  v_base_code := coalesce(v_base_code, v_payment_code);

  select a.id into v_account_id
  from public.store_financial_accounts a
  where a.store_id = new.store_id and a.active = true and a.is_sales_clearing_default = true
    and exists (
      select 1 from public.store_financial_account_payment_methods apm
      where apm.store_id = new.store_id and apm.account_id = a.id and apm.active = true
        and apm.payment_method_code in (v_payment_code, v_base_code)
    )
  limit 1;

  if v_account_id is not null then
    new.destination_financial_account_id := v_account_id;
    new.metadata := coalesce(new.metadata, '{}'::jsonb) || jsonb_build_object(
      'sales_clearing_account_auto_routed', true,
      'sales_clearing_account_id', v_account_id,
      'sales_clearing_payment_method_code', v_payment_code,
      'sales_clearing_base_payment_method_code', v_base_code,
      'sales_clearing_routed_at', now()
    );
  else
    new.metadata := coalesce(new.metadata, '{}'::jsonb) || jsonb_build_object(
      'sales_clearing_account_auto_routed', false,
      'sales_clearing_route_failure', 'no_compatible_default_account',
      'sales_clearing_payment_method_code', v_payment_code,
      'sales_clearing_base_payment_method_code', v_base_code,
      'sales_clearing_routed_at', now()
    );
  end if;
  return new;
end;
$function$;

revoke all on function public.route_sale_cashbook_entry_to_clearing_account() from public, anon, authenticated;

create or replace function public.confirm_pending_order_payment_safe(
  p_store_id uuid,
  p_order_id uuid,
  p_payment_method_code text,
  p_received_at timestamptz default now(),
  p_notes text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_order record;
  v_payment record;
  v_payment_code text;
  v_payment_method_enum public.payment_method;
  v_cashbook_entry record;
  v_cashbook_result jsonb := null;
  v_affects_cashbook boolean := true;
  v_received_at timestamptz := coalesce(p_received_at, now());
begin
  if p_store_id is null then return jsonb_build_object('ok', false, 'error', 'missing_store_id'); end if;
  if p_order_id is null then return jsonb_build_object('ok', false, 'error', 'missing_order_id'); end if;
  v_payment_code := coalesce(nullif(trim(coalesce(p_payment_method_code, '')), ''), 'pending');
  if v_payment_code = 'pending' then return jsonb_build_object('ok', false, 'error', 'invalid_payment_method', 'message', 'Informe a forma de pagamento recebida.'); end if;

  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    if v_user_id is null or not (public.app_is_store_owner(p_store_id) or public.user_has_store_permission(p_store_id, 'orders.manage')) then
      return jsonb_build_object('ok', false, 'error', 'access_denied', 'message', 'Voce nao tem permissao para confirmar recebimento.');
    end if;
  end if;

  select o.* into v_order from public.orders o where o.id = p_order_id and o.store_id = p_store_id for update;
  if v_order.id is null then return jsonb_build_object('ok', false, 'error', 'order_not_found'); end if;
  if coalesce(v_order.status::text, '') = 'cancelled' then return jsonb_build_object('ok', false, 'error', 'order_cancelled'); end if;
  if coalesce(v_order.payment_method_code, v_order.payment_method::text, '') <> 'pending' then
    return jsonb_build_object('ok', false, 'error', 'payment_not_pending', 'payment_method_code', coalesce(v_order.payment_method_code, v_order.payment_method::text));
  end if;

  select pm.code, pm.name, coalesce(pm.base_code, pm.code) as base_code,
         coalesce(pm.affects_cashbook, true) as affects_cashbook,
         coalesce(pm.requires_proof, false) as requires_proof,
         coalesce(pm.requires_change_for, false) as requires_change_for
  into v_payment
  from public.store_payment_methods pm
  where pm.store_id = p_store_id and pm.code = v_payment_code and pm.active = true
  limit 1;
  if v_payment.code is null then return jsonb_build_object('ok', false, 'error', 'payment_method_disabled'); end if;
  v_affects_cashbook := coalesce(v_payment.affects_cashbook, true);

  v_payment_method_enum := case
    when v_payment.base_code = 'cash' then 'cash'::public.payment_method
    when v_payment.base_code = 'pix' then 'pix'::public.payment_method
    when v_payment.base_code in ('debit_card','credit_card') then 'card'::public.payment_method
    else 'pending'::public.payment_method
  end;

  if exists (
    select 1 from public.cashbook_entries ce
    where ce.store_id = p_store_id and ce.order_id = p_order_id and ce.type = 'sale'
      and ce.status = 'confirmed' and coalesce(ce.affects_balance, true) = true
  ) then return jsonb_build_object('ok', false, 'error', 'cashbook_entry_already_confirmed'); end if;

  update public.orders o
  set payment_method = v_payment_method_enum,
      payment_method_code = v_payment.code,
      payment_metadata = coalesce(o.payment_metadata, '{}'::jsonb) || jsonb_build_object(
        'code', v_payment.code, 'name', v_payment.name, 'base_code', v_payment.base_code,
        'affects_cashbook', v_affects_cashbook, 'requires_proof', coalesce(v_payment.requires_proof, false),
        'requires_change_for', coalesce(v_payment.requires_change_for, false), 'confirmed_from_pending', true,
        'confirmed_at', v_received_at, 'confirmed_by', v_user_id,
        'notes', nullif(trim(coalesce(p_notes, '')), '')
      ),
      commercial_metadata = coalesce(o.commercial_metadata, '{}'::jsonb) || jsonb_build_object(
        'payment_confirmed_from_pending', true, 'payment_confirmed_at', v_received_at,
        'payment_confirmed_by', v_user_id, 'payment_method_code', v_payment.code,
        'payment_method_name', v_payment.name, 'payment_method_base_code', v_payment.base_code
      ),
      metadata = coalesce(o.metadata, '{}'::jsonb) || jsonb_build_object(
        'pending_payment_confirmed', true, 'pending_payment_confirmed_at', v_received_at,
        'pending_payment_confirmed_by', v_user_id
      )
  where o.id = p_order_id and o.store_id = p_store_id;

  select ce.* into v_cashbook_entry
  from public.cashbook_entries ce
  where ce.store_id = p_store_id and ce.order_id = p_order_id and ce.type = 'sale'
  order by ce.created_at desc limit 1 for update;

  if v_cashbook_entry.id is not null then
    update public.cashbook_entries ce
    set status = 'confirmed', affects_balance = v_affects_cashbook,
        payment_method = v_payment.code, payment_method_code = v_payment.code,
        occurred_at = v_received_at, entry_date = (v_received_at at time zone 'America/Sao_Paulo')::date,
        notes = coalesce(nullif(trim(coalesce(p_notes, '')), ''), ce.notes),
        metadata = coalesce(ce.metadata, '{}'::jsonb) || jsonb_build_object(
          'pending_payment_confirmed', true, 'pending_payment_confirmed_at', v_received_at,
          'pending_payment_confirmed_by', v_user_id, 'payment_method_code', v_payment.code,
          'payment_method_name', v_payment.name, 'payment_method_base_code', v_payment.base_code,
          'affects_balance_after_confirmation', v_affects_cashbook
        ) || coalesce(p_metadata, '{}'::jsonb), updated_at = now()
    where ce.id = v_cashbook_entry.id
    returning to_jsonb(ce.*) into v_cashbook_result;
  elsif v_affects_cashbook then
    v_cashbook_result := public.create_cashbook_entry_from_order(p_order_id);
  else
    v_cashbook_result := jsonb_build_object('ok', true, 'skipped', true, 'reason', 'payment_method_does_not_affect_cashbook', 'payment_method_code', v_payment.code);
  end if;

  if v_order.customer_id is not null then perform public.refresh_customer_commercial_summary(v_order.customer_id); end if;

  return jsonb_build_object(
    'ok', true, 'order_id', p_order_id, 'order_code', v_order.order_code,
    'payment_method_code', v_payment.code, 'payment_method_name', v_payment.name,
    'payment_method_base_code', v_payment.base_code, 'affects_cashbook', v_affects_cashbook,
    'received_at', v_received_at, 'cashbook', coalesce(v_cashbook_result, 'null'::jsonb)
  );
exception when others then
  return jsonb_build_object('ok', false, 'error', 'unexpected_error', 'message', sqlerrm);
end;
$function$;

revoke all on function public.confirm_pending_order_payment_safe(uuid, uuid, text, timestamptz, text, jsonb) from public, anon;
grant execute on function public.confirm_pending_order_payment_safe(uuid, uuid, text, timestamptz, text, jsonb) to authenticated, service_role;
