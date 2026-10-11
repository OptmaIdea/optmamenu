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
$function$;

CREATE OR REPLACE FUNCTION public.create_store_financial_account_with_opening_safe(p_store_id uuid, p_code text, p_name text, p_account_type text, p_description text, p_is_default boolean, p_active boolean, p_sort_order integer, p_metadata jsonb, p_opening_balance numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
declare v_result jsonb;v_open jsonb;v_account_id uuid;
begin
 if p_opening_balance is null or p_opening_balance<0 or round(p_opening_balance,2)<>p_opening_balance then
   return jsonb_build_object('ok',false,'error','invalid_opening_balance');
 end if;
 if not p_active and p_opening_balance>0 then
   return jsonb_build_object('ok',false,'error','inactive_opening_balance');
 end if;
 -- Preserve the legacy idempotent upsert contract; prevent existing-code reuse only for new openings.
 perform pg_advisory_xact_lock(hashtextextended(p_store_id::text||':'||
   lower(regexp_replace(trim(coalesce(p_code,p_name,'')), '[^a-zA-Z0-9]+','_','g')),0));
 if exists (
   select 1 from public.store_financial_accounts
   where store_id=p_store_id
     and code=lower(regexp_replace(trim(coalesce(p_code,p_name,'')), '[^a-zA-Z0-9]+','_','g'))
 ) then
   return jsonb_build_object('ok',false,'error','account_code_already_exists');
 end if;
 v_result:=public.upsert_store_financial_account_safe(
  p_store_id,null,p_code,p_name,p_account_type,p_description,p_is_default,p_active,p_sort_order,p_metadata
 );
 if coalesce((v_result->>'ok')::boolean,false)<>true then return v_result; end if;
 v_account_id:=(v_result->'account'->>'id')::uuid;
 if p_opening_balance>0 then
   v_open:=public.adjust_financial_account_balance_safe(
      p_store_id,v_account_id,now(),p_opening_balance,
      'Abertura de conta — saldo inicial informado no cadastro'
   );
   if coalesce((v_open->>'ok')::boolean,false)<>true then
      raise exception 'Falha ao registrar saldo de abertura: %',coalesce(v_open->>'error','desconhecida');
   end if;
 end if;
 return v_result||jsonb_build_object('opening_entry_created',p_opening_balance>0);
end $function$;