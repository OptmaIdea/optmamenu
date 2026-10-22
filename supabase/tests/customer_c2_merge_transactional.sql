-- Smoke transacional de CLIENTES C2.
-- Executar em homologação. O bloco usa uma loja existente e faz ROLLBACK ao final.
-- Substitua TEST_STORE_ID apenas se necessário no ambiente alvo.

begin;

do $$
declare
  v_store uuid := '0abba741-0f77-4783-8cf8-58811cf7343b';
  v_a uuid := gen_random_uuid();
  v_b uuid := gen_random_uuid();
  v_candidates jsonb;
  v_merge jsonb;
  v_status text;
  v_target uuid;
begin
  insert into public.customers(id, store_id, phone, full_name, birth_date, source, registration_method, data_ownership)
  values
    (v_a, v_store, '62999000101', 'Cliente C2 Teste', '1990-01-01', 'admin', 'admin', 'store_managed'),
    (v_b, v_store, '62999000102', 'Cliente C2 Teste', '1990-01-01', 'admin', 'admin', 'store_managed');

  insert into public.customer_addresses(customer_id, zip_code, street, number, district, city, state, is_default)
  values (v_b, '74000000', 'Rua Teste C2', '10', 'Centro', 'Inhumas', 'GO', true);

  v_candidates := public.get_customer_duplicate_candidates_safe(v_store, v_a, 10);
  if coalesce(jsonb_array_length(v_candidates->'candidates'), 0) < 1 then
    raise exception 'C2 candidato por nome+data não detectado: %', v_candidates;
  end if;

  v_merge := public.merge_customers_safe(v_store, v_a, v_b, 'Smoke transacional C2');
  if coalesce((v_merge->>'ok')::boolean, false) is not true then
    raise exception 'C2 merge falhou: %', v_merge;
  end if;

  select status, merged_into_customer_id into v_status, v_target
  from public.customers where id = v_b;
  if v_status <> 'merged' or v_target <> v_a then
    raise exception 'C2 duplicado não marcado como merged';
  end if;

  if not exists(select 1 from public.customer_addresses where customer_id = v_a and street = 'Rua Teste C2') then
    raise exception 'C2 endereço não foi movido';
  end if;

  if not exists(select 1 from public.customer_merge_events where id = (v_merge->>'merge_id')::uuid) then
    raise exception 'C2 ledger de merge não foi criado';
  end if;
end;
$$;

rollback;
