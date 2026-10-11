begin;

create or replace function public.customer_order_notification_after_write()
returns trigger
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_code text := coalesce(nullif(new.order_code,''),'Seu pedido');
  v_status text := new.status::text;
  v_title text;
  v_message text;
  v_type text := 'info';
begin
  if new.customer_id is null or new.store_id is null then
    return new;
  end if;

  if tg_op='INSERT' or old.status is distinct from new.status then
    v_title := case v_status
      when 'reserved' then 'Pedido recebido'
      when 'confirmed' then 'Pedido confirmado'
      when 'ready' then case when coalesce(new.fulfillment_type,'')='pickup' then 'Pedido pronto para retirada' else 'Pedido pronto' end
      when 'out_for_delivery' then 'Pedido saiu para entrega'
      when 'completed' then 'Pedido concluído'
      when 'cancelled' then 'Pedido cancelado'
      else 'Atualização do pedido'
    end;

    v_message := case v_status
      when 'reserved' then 'Recebemos o pedido '||v_code||' e ele está aguardando confirmação da loja.'
      when 'confirmed' then 'A loja confirmou o pedido '||v_code||'.'
      when 'ready' then case when coalesce(new.fulfillment_type,'')='pickup'
        then 'O pedido '||v_code||' está pronto para retirada.'
        else 'O pedido '||v_code||' está pronto.'
      end
      when 'out_for_delivery' then 'O pedido '||v_code||' saiu para entrega.'
      when 'completed' then 'O pedido '||v_code||' foi concluído.'
      when 'cancelled' then 'O pedido '||v_code||' foi cancelado.'
      else 'O pedido '||v_code||' recebeu uma atualização de status.'
    end;

    v_type := case
      when v_status='cancelled' then 'warning'
      when v_status in ('confirmed','ready','out_for_delivery','completed') then 'success'
      else 'info'
    end;

    insert into public.customer_notifications(
      customer_id,store_id,title,message,type,category,read,created_at
    ) values(
      new.customer_id,new.store_id,v_title,v_message,v_type,'orders',false,clock_timestamp()
    );
  end if;

  if tg_op='UPDATE'
     and old.payment_status is distinct from new.payment_status
     and coalesce(new.payment_status,'')='paid' then
    insert into public.customer_notifications(
      customer_id,store_id,title,message,type,category,read,created_at
    ) values(
      new.customer_id,new.store_id,'Pagamento confirmado',
      'O pagamento do pedido '||v_code||' foi confirmado.',
      'success','orders',false,clock_timestamp()
    );
  end if;

  return new;
end;
$function$;

revoke all on function public.customer_order_notification_after_write()
from public,anon,authenticated;

drop trigger if exists trg_customer_order_notification_after_write on public.orders;
create trigger trg_customer_order_notification_after_write
after insert or update of status,payment_status
on public.orders
for each row
execute function public.customer_order_notification_after_write();

create or replace function public.customer_loyalty_notification_after_insert()
returns trigger
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_store_id uuid;
  v_abs_points integer := abs(coalesce(new.points,0));
  v_title text;
  v_message text;
  v_type text;
begin
  if new.customer_id is null or coalesce(new.points,0)=0 then
    return new;
  end if;

  select fp.store_id into v_store_id
  from public.fidelity_programs fp
  where fp.id=new.program_id;

  if v_store_id is null and new.order_id is not null then
    select o.store_id into v_store_id
    from public.orders o
    where o.id=new.order_id;
  end if;

  if v_store_id is null then
    select c.store_id into v_store_id
    from public.customers c
    where c.id=new.customer_id
    limit 1;
  end if;

  if v_store_id is null then
    return new;
  end if;

  if new.points > 0 then
    v_title := 'Você ganhou '||v_abs_points||case when v_abs_points=1 then ' ponto' else ' pontos' end;
    v_type := 'success';
  elsif lower(coalesce(new.type,'')) in ('redeem','redemption','reward') then
    v_title := 'Você usou '||v_abs_points||case when v_abs_points=1 then ' ponto' else ' pontos' end;
    v_type := 'info';
  else
    v_title := 'Movimentação de fidelidade: '||new.points||' pontos';
    v_type := 'info';
  end if;

  v_message := coalesce(nullif(trim(new.description),''),'Seu saldo de fidelidade foi atualizado.');

  insert into public.customer_notifications(
    customer_id,store_id,title,message,type,category,read,created_at
  ) values(
    new.customer_id,v_store_id,v_title,v_message,v_type,'loyalty',false,clock_timestamp()
  );

  return new;
end;
$function$;

revoke all on function public.customer_loyalty_notification_after_insert()
from public,anon,authenticated;

drop trigger if exists trg_customer_loyalty_notification_after_insert
on public.loyalty_transactions;
create trigger trg_customer_loyalty_notification_after_insert
after insert on public.loyalty_transactions
for each row
execute function public.customer_loyalty_notification_after_insert();

-- Backfill somente a janela recente para que a homologação atual não perca
-- os eventos que aconteceram antes da criação dos gatilhos.
insert into public.customer_notifications(
  customer_id,store_id,title,message,type,category,read,created_at
)
select
  o.customer_id,
  o.store_id,
  case o.status::text
    when 'reserved' then 'Pedido recebido'
    when 'confirmed' then 'Pedido confirmado'
    when 'ready' then case when coalesce(o.fulfillment_type,'')='pickup' then 'Pedido pronto para retirada' else 'Pedido pronto' end
    when 'out_for_delivery' then 'Pedido saiu para entrega'
    when 'completed' then 'Pedido concluído'
    when 'cancelled' then 'Pedido cancelado'
    else 'Atualização do pedido'
  end,
  case o.status::text
    when 'reserved' then 'Recebemos o pedido '||coalesce(o.order_code,'')||' e ele está aguardando confirmação da loja.'
    when 'confirmed' then 'A loja confirmou o pedido '||coalesce(o.order_code,'')||'.'
    when 'ready' then case when coalesce(o.fulfillment_type,'')='pickup'
      then 'O pedido '||coalesce(o.order_code,'')||' está pronto para retirada.'
      else 'O pedido '||coalesce(o.order_code,'')||' está pronto.'
    end
    when 'out_for_delivery' then 'O pedido '||coalesce(o.order_code,'')||' saiu para entrega.'
    when 'completed' then 'O pedido '||coalesce(o.order_code,'')||' foi concluído.'
    when 'cancelled' then 'O pedido '||coalesce(o.order_code,'')||' foi cancelado.'
    else 'O pedido '||coalesce(o.order_code,'')||' recebeu uma atualização.'
  end,
  case when o.status::text='cancelled' then 'warning'
       when o.status::text in ('confirmed','ready','out_for_delivery','completed') then 'success'
       else 'info' end,
  'orders',
  false,
  coalesce(o.updated_at,o.created_at,clock_timestamp())
from public.orders o
where o.customer_id is not null
  and o.created_at >= clock_timestamp()-interval '24 hours'
  and not exists (
    select 1
    from public.customer_notifications n
    where n.customer_id=o.customer_id
      and n.store_id=o.store_id
      and n.category='orders'
      and n.message ilike '%'||coalesce(o.order_code,'')||'%'
  );

insert into public.customer_notifications(
  customer_id,store_id,title,message,type,category,read,created_at
)
select
  lt.customer_id,
  fp.store_id,
  case
    when lt.points>0 then 'Você ganhou '||abs(lt.points)||case when abs(lt.points)=1 then ' ponto' else ' pontos' end
    when lower(coalesce(lt.type,'')) in ('redeem','redemption','reward')
      then 'Você usou '||abs(lt.points)||case when abs(lt.points)=1 then ' ponto' else ' pontos' end
    else 'Movimentação de fidelidade: '||lt.points||' pontos'
  end,
  coalesce(nullif(trim(lt.description),''),'Seu saldo de fidelidade foi atualizado.'),
  case when lt.points>0 then 'success' else 'info' end,
  'loyalty',
  false,
  lt.created_at
from public.loyalty_transactions lt
join public.fidelity_programs fp on fp.id=lt.program_id
where lt.created_at >= clock_timestamp()-interval '24 hours'
  and coalesce(lt.points,0)<>0
  and not exists (
    select 1
    from public.customer_notifications n
    where n.customer_id=lt.customer_id
      and n.store_id=fp.store_id
      and n.category='loyalty'
      and n.message=coalesce(nullif(trim(lt.description),''),'Seu saldo de fidelidade foi atualizado.')
      and abs(extract(epoch from (n.created_at-lt.created_at))) < 10
  );

commit;
