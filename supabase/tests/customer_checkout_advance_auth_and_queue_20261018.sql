-- Safe checkout authorization regression. No real products or orders are created.
begin;
do $test$
declare
  a record;
  b_slug text;
  result jsonb;
  count_before bigint;
  count_after bigint;
begin
  select count(*) into count_before from public.orders;
  perform set_config('request.jwt.claims','{"role":"anon"}',true);
  execute 'set local role anon';
  result:=public.create_public_order_by_slug_v3('gelinharessjn','Teste','62999999999',
    'pickup','public_store','[]'::jsonb,'{}',null,null,
    '{"timing":"pay_now","method_code":"pix"}'::jsonb,'pickup');
  if result->>'error'<>'customer_auth_required_for_checkout' then
    raise exception 'Anonymous advance payment not blocked: %',result;
  end if;
  result:=public.create_public_order_by_slug_v3('gelinharessjn','Teste','62999999999',
    'delivery','public_store','[]'::jsonb,'{}',null,null,
    '{"timing":"pay_on_fulfillment"}'::jsonb,'delivery');
  if result->>'error'<>'customer_auth_required_for_checkout' then
    raise exception 'Anonymous delivery not blocked: %',result;
  end if;
  result:=public.create_public_order_by_slug('gelinharessjn','Teste','62999999999',
    'pickup','public_store','[]'::jsonb,'{}',null,null,'pix','pickup');
  if result->>'error'<>'customer_auth_required_for_checkout' then
    raise exception 'Legacy direct advance payment not blocked: %',result;
  end if;
  execute 'reset role';

  select csd.auth_user_id,csd.customer_id,csd.store_id,csd.session_id,st.slug
    into a
  from public.customer_auth_session_devices csd
  join public.customer_auth_identities cai using(customer_id,store_id,auth_user_id)
  join public.customer_auth_trusted_devices td on td.id=csd.trusted_device_id
  join public.stores st on st.id=csd.store_id
  where csd.revoked_at is null and cai.revoked_at is null and td.revoked_at is null
    and st.public_store_enabled=true
  limit 1;
  select slug into b_slug from public.stores
    where public_store_enabled=true and id<>a.store_id limit 1;
  if a.auth_user_id is null or b_slug is null then
    raise exception 'INCONCLUSIVE: two public stores and one active test session required';
  end if;
  perform set_config('request.jwt.claims',jsonb_build_object(
    'role','authenticated','sub',a.auth_user_id::text,'session_id',a.session_id::text,
    'iat',ceil(extract(epoch from clock_timestamp()))::bigint
  )::text,true);
  execute 'set local role authenticated';
  result:=public.create_public_order_by_slug_v3(b_slug,'Teste','62999999999',
    'pickup','public_store','[]'::jsonb,'{}',null,null,
    '{"timing":"pay_now","method_code":"pix"}'::jsonb,'pickup');
  if result->>'error'<>'customer_auth_required_for_checkout' then
    raise exception 'Cross-store advance payment not blocked: %',result;
  end if;
  result:=public.create_public_order_by_slug_v3(a.slug,'Teste','62999999999',
    'delivery','public_store','[]'::jsonb,'{}',null,null,
    '{"timing":"pay_on_fulfillment"}'::jsonb,'delivery');
  if result->>'error'='customer_auth_required_for_checkout' then
    raise exception 'Valid logged-in customer incorrectly rejected';
  end if;
  execute 'reset role';
  select count(*) into count_after from public.orders;
  if count_after<>count_before then
    raise exception 'Test unexpectedly created an order';
  end if;
  if not (
    select every(position('payment_confirmation_required' in pg_get_functiondef(oid))>0)
    from pg_proc where pronamespace='public'::regnamespace
      and proname in ('admin_accept_public_order_safe',
          'admin_mark_public_order_ready_safe','admin_dispatch_public_order_safe')
  ) then
    raise exception 'Advance-payment operational stage guard missing';
  end if;
end $test$;
select 'PASS: anon/legacy/cross-store advance checkout denied; same-store accepted for further validation; ops blocked without paid confirmation' result;
rollback;
