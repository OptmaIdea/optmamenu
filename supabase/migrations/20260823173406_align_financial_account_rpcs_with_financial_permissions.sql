create or replace function public.list_store_financial_accounts_safe(p_store_id uuid, p_include_inactive boolean default false)
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
      or public.user_has_store_permission_v2(p_store_id, 'financial.accounts.view')
      or public.user_has_store_permission_v2(p_store_id, 'cashbook.view')
    ) then return jsonb_build_object('ok', false, 'error', 'access_denied'); end if;
  end if;
  select coalesce(jsonb_agg(to_jsonb(a) order by a.active desc, a.sort_order, a.name), '[]'::jsonb)
  into v_items
  from public.store_financial_accounts a
  where a.store_id = p_store_id and (p_include_inactive or a.active = true);
  return jsonb_build_object('ok', true, 'items', v_items);
end;
$function$;

create or replace function public.upsert_store_financial_account_safe(
  p_store_id uuid, p_account_id uuid default null, p_code text default null, p_name text default null,
  p_account_type text default null, p_description text default null, p_is_default boolean default false,
  p_active boolean default true, p_sort_order integer default 0, p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $function$
declare
  v_code text := lower(regexp_replace(trim(coalesce(p_code, p_name, '')), '[^a-zA-Z0-9]+', '_', 'g'));
  v_account public.store_financial_accounts%rowtype;
begin
  if p_store_id is null then return jsonb_build_object('ok', false, 'error', 'missing_store_id'); end if;
  if nullif(trim(coalesce(p_name, '')), '') is null then return jsonb_build_object('ok', false, 'error', 'missing_name'); end if;
  if coalesce(p_account_type, '') not in ('cash_drawer', 'safe', 'bank', 'pix_wallet', 'card_acquirer', 'card_receivable', 'owner', 'other') then
    return jsonb_build_object('ok', false, 'error', 'invalid_account_type');
  end if;
  if v_code = '' then return jsonb_build_object('ok', false, 'error', 'invalid_code'); end if;
  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    if auth.uid() is null or not (
      public.app_is_store_owner(p_store_id)
      or public.user_has_store_permission_v2(p_store_id, 'financial.accounts.manage')
      or public.user_has_store_permission_v2(p_store_id, 'financial.manage')
      or public.user_has_store_permission_v2(p_store_id, 'cashbook.create')
    ) then return jsonb_build_object('ok', false, 'error', 'access_denied'); end if;
  end if;
  if p_is_default then
    update public.store_financial_accounts
    set is_default = false, updated_at = now()
    where store_id = p_store_id and account_type = p_account_type and (p_account_id is null or id <> p_account_id);
  end if;
  if p_account_id is null then
    insert into public.store_financial_accounts (store_id, code, name, account_type, description, is_default, active, sort_order, metadata)
    values (p_store_id, v_code, trim(p_name), p_account_type, nullif(trim(coalesce(p_description, '')), ''), coalesce(p_is_default, false), coalesce(p_active, true), coalesce(p_sort_order, 0), coalesce(p_metadata, '{}'::jsonb))
    on conflict (store_id, code) do update set
      name = excluded.name,
      account_type = excluded.account_type,
      description = excluded.description,
      is_default = excluded.is_default,
      active = excluded.active,
      sort_order = excluded.sort_order,
      metadata = coalesce(public.store_financial_accounts.metadata, '{}'::jsonb) || coalesce(excluded.metadata, '{}'::jsonb),
      updated_at = now()
    returning * into v_account;
  else
    update public.store_financial_accounts
    set code = v_code,
        name = trim(p_name),
        account_type = p_account_type,
        description = nullif(trim(coalesce(p_description, '')), ''),
        is_default = coalesce(p_is_default, false),
        active = coalesce(p_active, true),
        sort_order = coalesce(p_sort_order, sort_order),
        metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb),
        updated_at = now()
    where id = p_account_id and store_id = p_store_id
    returning * into v_account;
    if v_account.id is null then return jsonb_build_object('ok', false, 'error', 'account_not_found'); end if;
  end if;
  return jsonb_build_object('ok', true, 'account', to_jsonb(v_account));
end;
$function$;

create or replace function public.set_store_financial_account_active_safe(p_store_id uuid, p_account_id uuid, p_active boolean)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $function$
declare
  v_account public.store_financial_accounts%rowtype;
begin
  if p_store_id is null or p_account_id is null then return jsonb_build_object('ok', false, 'error', 'missing_required_fields'); end if;
  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    if auth.uid() is null or not (
      public.app_is_store_owner(p_store_id)
      or public.user_has_store_permission_v2(p_store_id, 'financial.accounts.manage')
      or public.user_has_store_permission_v2(p_store_id, 'financial.manage')
      or public.user_has_store_permission_v2(p_store_id, 'cashbook.create')
    ) then return jsonb_build_object('ok', false, 'error', 'access_denied'); end if;
  end if;
  update public.store_financial_accounts
  set active = coalesce(p_active, true), updated_at = now()
  where id = p_account_id and store_id = p_store_id
  returning * into v_account;
  if v_account.id is null then return jsonb_build_object('ok', false, 'error', 'account_not_found'); end if;
  return jsonb_build_object('ok', true, 'account', to_jsonb(v_account));
end;
$function$;
