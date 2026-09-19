-- Smoke estrutural de CLIENTES C2.
-- Pode ser executado após a migration; não cria dados persistentes.

do $$
begin
  if to_regclass('public.customer_merge_events') is null then
    raise exception 'customer_merge_events ausente';
  end if;

  if to_regprocedure('public.get_customer_duplicate_candidates_safe(uuid,uuid,integer)') is null then
    raise exception 'get_customer_duplicate_candidates_safe ausente';
  end if;

  if to_regprocedure('public.get_customer_merge_history_safe(uuid,uuid,integer)') is null then
    raise exception 'get_customer_merge_history_safe ausente';
  end if;

  if to_regprocedure('public.merge_customers_safe(uuid,uuid,uuid,text)') is null then
    raise exception 'merge_customers_safe ausente';
  end if;

  if exists (
    select 1
    from public.customers
    where status <> all(array['merged'::text, 'anonymized'::text])
      and phone_match_key is not null
    group by store_id, phone_match_key
    having count(*) > 1
  ) then
    raise exception 'Há duplicidade ativa de phone_match_key';
  end if;
end;
$$;
