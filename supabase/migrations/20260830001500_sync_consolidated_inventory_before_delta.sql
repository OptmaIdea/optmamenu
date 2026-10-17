create or replace function public.sync_inventory_balance_from_locations(
  p_store_id uuid,
  p_product_id uuid,
  p_variant_id uuid default null
)
returns public.inventory_balances
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_on_hand numeric := 0;
  v_reserved numeric := 0;
  v_row public.inventory_balances;
begin
  select coalesce(sum(ilb.on_hand), 0), coalesce(sum(ilb.reserved), 0)
    into v_on_hand, v_reserved
  from public.inventory_location_balances ilb
  where ilb.store_id = p_store_id
    and ilb.product_id = p_product_id
    and (
      (p_variant_id is null and ilb.variant_id is null)
      or ilb.variant_id = p_variant_id
    );

  v_row := public.get_inventory_balance_for_update(p_store_id, p_product_id, p_variant_id);

  update public.inventory_balances
     set on_hand = v_on_hand,
         reserved = v_reserved,
         updated_at = now()
   where id = v_row.id
  returning * into v_row;

  return v_row;
end;
$function$;

create or replace function public.apply_inventory_balance_delta(
  p_store_id uuid,
  p_product_id uuid,
  p_variant_id uuid,
  p_delta_on_hand numeric,
  p_delta_reserved numeric
)
returns public.inventory_balances
language plpgsql
set search_path to 'public'
as $function$
declare
    v_current public.inventory_balances;
    v_new_on_hand numeric;
    v_new_reserved numeric;
    v_row public.inventory_balances;
begin
    v_current := public.sync_inventory_balance_from_locations(
        p_store_id,
        p_product_id,
        p_variant_id
    );

    v_new_on_hand := coalesce(v_current.on_hand, 0) + coalesce(p_delta_on_hand, 0);
    v_new_reserved := coalesce(v_current.reserved, 0) + coalesce(p_delta_reserved, 0);

    if v_new_on_hand < 0 then
        raise exception 'Saldo físico consolidado insuficiente. Atual: %, delta: %, resultado: %',
            v_current.on_hand, p_delta_on_hand, v_new_on_hand
            using errcode = '23514';
    end if;

    if v_new_reserved < 0 then
        raise exception 'Saldo reservado consolidado insuficiente. Atual: %, delta: %, resultado: %',
            v_current.reserved, p_delta_reserved, v_new_reserved
            using errcode = '23514';
    end if;

    if v_new_reserved > v_new_on_hand then
        raise exception 'Saldo reservado consolidado não pode exceder saldo físico'
            using errcode = '23514';
    end if;

    update public.inventory_balances
       set on_hand = v_new_on_hand,
           reserved = v_new_reserved,
           updated_at = now()
     where id = v_current.id
    returning *
      into v_row;

    return v_row;
end;
$function$;

do $$
declare
  r record;
begin
  for r in
    select distinct ilb.store_id, ilb.product_id, ilb.variant_id
    from public.inventory_location_balances ilb
  loop
    perform public.sync_inventory_balance_from_locations(r.store_id, r.product_id, r.variant_id);
  end loop;
end;
$$;

update public.orders
   set payment_method_code = payment_metadata->'checkout'->>'promised_method_code',
       updated_at = now()
 where payment_method_code in ('pending', 'unknown')
   and payment_metadata->'checkout'->>'promised_method_code' in (
     'cash',
     'pix',
     'pix_manual',
     'pix_qrcode',
     'credit_card',
     'debit_card',
     'bank_transfer',
     'payment_link'
   );
