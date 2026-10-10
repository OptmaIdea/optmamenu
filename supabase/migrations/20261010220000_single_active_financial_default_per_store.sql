with ranked as (
 select id,row_number() over(partition by store_id order by
  case when is_sales_clearing_default then 0 when account_type='cash_drawer' then 1 else 2 end,
  created_at,id) as rn
 from public.store_financial_accounts where active and is_default
)
update public.store_financial_accounts a set is_default=false,updated_at=now()
from ranked r where a.id=r.id and r.rn>1;

create unique index if not exists uq_store_financial_accounts_one_active_general_default
on public.store_financial_accounts(store_id) where active and is_default;

CREATE OR REPLACE FUNCTION public.upsert_store_financial_account_safe(p_store_id uuid, p_account_id uuid DEFAULT NULL::uuid, p_code text DEFAULT NULL::text, p_name text DEFAULT NULL::text, p_account_type text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_is_default boolean DEFAULT false, p_active boolean DEFAULT true, p_sort_order integer DEFAULT 0, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
declare
  v_code text := lower(regexp_replace(trim(coalesce(p_code, p_name, '')), '[^a-zA-Z0-9]+', '_', 'g'));
  v_account public.store_financial_accounts%rowtype;
begin
  if p_store_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_store_id');
  end if;

  if nullif(trim(coalesce(p_name, '')), '') is null then
    return jsonb_build_object('ok', false, 'error', 'missing_name');
  end if;

  if coalesce(p_account_type, '') not in ('cash_drawer', 'safe', 'bank', 'pix_wallet', 'card_acquirer', 'card_receivable', 'owner', 'other') then
    return jsonb_build_object('ok', false, 'error', 'invalid_account_type');
  end if;

  if v_code = '' then
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
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

  if p_is_default and not coalesce(p_active,true) then
    return jsonb_build_object('ok',false,'error','inactive_account_cannot_be_default');
  end if;

  if p_is_default then
    update public.store_financial_accounts
    set is_default = false, updated_at = now()
    where store_id = p_store_id
      and active=true
      and (p_account_id is null or id <> p_account_id);
  end if;

  if p_account_id is null then
    insert into public.store_financial_accounts (
      store_id, code, name, account_type, description, is_default, active, sort_order, metadata
    ) values (
      p_store_id, v_code, trim(p_name), p_account_type,
      nullif(trim(coalesce(p_description, '')), ''),
      coalesce(p_is_default, false), coalesce(p_active, true), coalesce(p_sort_order, 0), coalesce(p_metadata, '{}'::jsonb)
    )
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

    if v_account.id is null then
      return jsonb_build_object('ok', false, 'error', 'account_not_found');
    end if;
  end if;

  return jsonb_build_object('ok', true, 'account', to_jsonb(v_account));
end;
$function$
