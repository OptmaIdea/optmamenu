create or replace function public.create_customer_self_email_verification_challenge_safe(
  p_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_customer_id uuid:=public.app_current_customer_id();
  v_store_id uuid:=public.app_current_store_id();
  v_customer public.customers%rowtype;
  v_store record;
  v_challenge_id uuid;
  v_expires_at timestamptz:=clock_timestamp()+interval '30 minutes';
  v_recent_count integer:=0;
  v_hourly_count integer:=0;
begin
  if public.app_current_role()<>'customer' or v_customer_id is null or v_store_id is null then
    return jsonb_build_object('ok',false,'error','access_denied');
  end if;

  if nullif(trim(coalesce(p_token_hash,'')),'') is null or length(trim(p_token_hash))<>64 then
    return jsonb_build_object('ok',false,'error','invalid_token_hash');
  end if;

  select * into v_customer
  from public.customers
  where id=v_customer_id and store_id=v_store_id
  limit 1;

  if not found then
    return jsonb_build_object('ok',false,'error','customer_not_found');
  end if;

  if coalesce(v_customer.email_verified,false) then
    return jsonb_build_object('ok',true,'already_verified',true,'email',v_customer.email);
  end if;

  if v_customer.email is null or v_customer.email !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$' then
    return jsonb_build_object('ok',false,'error','valid_email_required');
  end if;

  select count(*) into v_recent_count
  from public.customer_email_verification_challenges c
  where c.store_id=v_store_id
    and c.customer_id=v_customer_id
    and c.used_at is null
    and c.requested_at>=clock_timestamp()-interval '1 minute';

  select count(*) into v_hourly_count
  from public.customer_email_verification_challenges c
  where c.store_id=v_store_id
    and c.customer_id=v_customer_id
    and c.requested_at>=clock_timestamp()-interval '1 hour';

  if v_recent_count>=1 or v_hourly_count>=10 then
    return jsonb_build_object('ok',false,'error','rate_limited');
  end if;

  select s.name,s.slug,s.logo_url into v_store
  from public.stores s
  where s.id=v_store_id
  limit 1;

  if not found then
    return jsonb_build_object('ok',false,'error','store_not_found');
  end if;

  update public.customer_email_verification_challenges
  set used_at=coalesce(used_at,clock_timestamp()),
      metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('superseded',true)
  where store_id=v_store_id and customer_id=v_customer_id and used_at is null;

  insert into public.customer_email_verification_challenges(
    store_id,customer_id,email,token_hash,expires_at,metadata
  ) values(
    v_store_id,v_customer_id,lower(trim(v_customer.email)),lower(trim(p_token_hash)),v_expires_at,
    jsonb_build_object('source','vercel_email_fallback')
  )
  returning id into v_challenge_id;

  return jsonb_build_object(
    'ok',true,
    'challenge_id',v_challenge_id,
    'email',lower(trim(v_customer.email)),
    'full_name',coalesce(nullif(trim(v_customer.full_name),''),nullif(trim(v_customer.nickname),''),'Cliente'),
    'store_name',coalesce(nullif(trim(v_store.name),''),nullif(trim(v_store.slug),''),'Loja'),
    'store_slug',v_store.slug,
    'store_logo_url',v_store.logo_url,
    'expires_at',v_expires_at
  );
end;
$function$;

revoke all on function public.create_customer_self_email_verification_challenge_safe(text) from public,anon;
grant execute on function public.create_customer_self_email_verification_challenge_safe(text) to authenticated,service_role;
