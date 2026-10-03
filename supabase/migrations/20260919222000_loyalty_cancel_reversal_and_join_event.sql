-- Fidelidade: estorno automático dos pontos quando um pedido concluído
-- é posteriormente cancelado por um fluxo de pós-venda autorizado.
create or replace function public.reverse_order_loyalty_points_on_cancel()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tx record;
  v_reversed integer := 0;
  v_new_balance integer;
  v_program_id uuid;
  v_tier_id uuid;
  v_tier_name text;
begin
  if tg_op <> 'UPDATE'
     or old.status::text <> 'completed'
     or new.status::text <> 'cancelled'
     or new.customer_id is null then
    return new;
  end if;

  for v_tx in
    select lt.*
    from public.loyalty_transactions lt
    where lt.order_id = new.id
      and lt.customer_id = new.customer_id
      and lt.type = 'order'
      and lt.points > 0
      and not exists (
        select 1
        from public.loyalty_transactions rev
        where rev.related_transaction_id = lt.id
          and rev.type = 'reversal'
      )
    order by lt.created_at
  loop
    insert into public.loyalty_transactions(
      program_id,customer_id,type,points,description,order_id,related_transaction_id,created_by,created_at
    ) values (
      v_tx.program_id,
      new.customer_id,
      'reversal',
      -abs(v_tx.points),
      'Estorno automático: pedido ' || coalesce(new.order_code,'#'||substring(new.id::text,1,8)) || ' cancelado',
      new.id,
      v_tx.id,
      auth.uid(),
      now()
    );

    v_reversed := v_reversed + abs(v_tx.points);
    v_program_id := coalesce(v_program_id,v_tx.program_id);
  end loop;

  if v_reversed <= 0 then
    return new;
  end if;

  update public.customers c
     set loyalty_points = coalesce(c.loyalty_points,0) - v_reversed,
         last_point_activity_at = now(),
         updated_at = now()
   where c.id = new.customer_id
     and c.store_id = new.store_id
  returning loyalty_points into v_new_balance;

  select ft.id,ft.name
    into v_tier_id,v_tier_name
  from public.fidelity_tiers ft
  where ft.store_id = new.store_id
    and ft.min_points <= greatest(coalesce(v_new_balance,0),0)
  order by ft.min_points desc
  limit 1;

  if v_tier_id is not null then
    update public.customers
       set current_tier_id=v_tier_id,
           loyalty_tier=v_tier_name
     where id=new.customer_id and store_id=new.store_id;
  end if;

  insert into public.customer_notifications(customer_id,store_id,title,message,type)
  values(
    new.customer_id,
    new.store_id,
    'Pontos estornados',
    v_reversed::text || ' ponto(s) foram estornados porque o pedido ' ||
      coalesce(new.order_code,'#'||substring(new.id::text,1,8)) || ' foi cancelado.',
    'warning'
  );

  return new;
end;
$function$;

drop trigger if exists on_order_cancelled_reverse_loyalty on public.orders;
create trigger on_order_cancelled_reverse_loyalty
after update of status on public.orders
for each row
when (
  old.status is distinct from new.status
  and old.status = 'completed'::public.order_status
  and new.status = 'cancelled'::public.order_status
)
execute function public.reverse_order_loyalty_points_on_cancel();

alter table public.loyalty_point_rules
  drop constraint if exists loyalty_point_rules_trigger_check;

alter table public.loyalty_point_rules
  add constraint loyalty_point_rules_trigger_check
  check (trigger_event = any(array[
    'order_completed'::text,
    'first_order'::text,
    'birthday'::text,
    'referral'::text,
    'manual_adjustment'::text,
    'campaign'::text,
    'loyalty_join'::text
  ]));

update public.loyalty_point_rules
set trigger_event='loyalty_join',
    metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
      'corrected_from','order_completed',
      'corrected_reason','join_bonus_must_not_run_on_every_completed_order',
      'corrected_at',now()
    ),
    updated_at=now()
where store_id='0abba741-0f77-4783-8cf8-58811cf7343b'
  and lower(trim(name))='bônus de adesão'
  and trigger_event='order_completed';
