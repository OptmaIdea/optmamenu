create or replace function public.save_customer_self_cart_draft_safe(p_cart jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_customer_id uuid := public.app_current_customer_id();
  v_store_id uuid := public.app_current_store_id();
  v_store_from_cart text;
  v_items jsonb;
  v_updated_at timestamptz;
  v_current_updated_at timestamptz;
  v_current_cart jsonb;
  v_current_revision bigint;
  v_base_revision bigint;
  v_cart_to_store jsonb;
  v_revision bigint;
begin
  if public.app_current_role() <> 'customer' or v_customer_id is null or v_store_id is null then
    return jsonb_build_object('ok',false,'error','access_denied');
  end if;

  if p_cart is null or jsonb_typeof(p_cart) <> 'object' then
    return jsonb_build_object('ok',false,'error','invalid_cart');
  end if;

  if pg_column_size(p_cart) > 262144 then
    return jsonb_build_object('ok',false,'error','cart_too_large');
  end if;

  v_items := coalesce(p_cart->'items','[]'::jsonb);
  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) > 100 then
    return jsonb_build_object('ok',false,'error','invalid_cart_items');
  end if;

  v_store_from_cart := nullif(p_cart #>> '{context,storeId}','');
  if v_store_from_cart is not null and v_store_from_cart <> v_store_id::text then
    return jsonb_build_object('ok',false,'error','cart_store_mismatch');
  end if;

  begin
    v_base_revision := nullif(p_cart->>'syncBaseRevision','')::bigint;
  exception when others then
    return jsonb_build_object('ok',false,'error','invalid_sync_base');
  end;

  select cart,updated_at,revision
    into v_current_cart,v_current_updated_at,v_current_revision
  from public.customer_cart_drafts
  where customer_id=v_customer_id and store_id=v_store_id
  for update;

  if found then
    if v_base_revision is null then
      if coalesce((v_current_cart->>'cleared')::boolean,false) then
        return jsonb_build_object(
          'ok',true,'stale',true,
          'cart',coalesce(v_current_cart,'{}'::jsonb),
          'updated_at',v_current_updated_at,
          'revision',coalesce(v_current_revision,1)
        );
      end if;
    elsif v_base_revision <> coalesce(v_current_revision,1) then
      return jsonb_build_object(
        'ok',true,'stale',true,
        'cart',coalesce(v_current_cart,'{}'::jsonb),
        'updated_at',v_current_updated_at,
        'revision',coalesce(v_current_revision,1)
      );
    end if;
  end if;

  v_cart_to_store := p_cart - 'syncBaseUpdatedAt' - 'syncBaseRevision';

  if jsonb_array_length(v_items)=0 then
    v_cart_to_store := v_cart_to_store || jsonb_build_object(
      'cleared',true,
      'clearedAt',clock_timestamp()
    );
  else
    v_cart_to_store := v_cart_to_store - 'cleared' - 'clearedAt';
  end if;

  insert into public.customer_cart_drafts(store_id,customer_id,cart,updated_at,revision)
  values(v_store_id,v_customer_id,v_cart_to_store,clock_timestamp(),1)
  on conflict (store_id,customer_id)
  do update
     set cart=excluded.cart,
         updated_at=clock_timestamp(),
         revision=public.customer_cart_drafts.revision+1
  returning updated_at,revision into v_updated_at,v_revision;

  return jsonb_build_object(
    'ok',true,
    'stale',false,
    'updated_at',v_updated_at,
    'revision',v_revision
  );
end;
$function$;

revoke all on function public.save_customer_self_cart_draft_safe(jsonb) from public,anon;
grant execute on function public.save_customer_self_cart_draft_safe(jsonb) to authenticated,service_role;
