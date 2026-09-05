-- Pagamento confirmado e entrega não devem expirar a reserva.
create or replace function public.enforce_order_reservation_lifecycle()
returns trigger language plpgsql security definer set search_path to 'public','pg_temp' as $$
begin
  if coalesce(new.fulfillment_type,'pickup')='delivery' or coalesce(new.payment_status,'pending')='paid' then
    new.expires_at:=null;
    new.metadata:=coalesce(new.metadata,'{}'::jsonb)||jsonb_build_object(
      'reservation_timer_suspended_at',now(),
      'reservation_timer_suspension_reason',case when coalesce(new.payment_status,'pending')='paid' then 'payment_confirmed' else 'delivery_order' end);
  end if;
  return new;
end;
$$;
drop trigger if exists trg_enforce_order_reservation_lifecycle on public.orders;
create trigger trg_enforce_order_reservation_lifecycle
before insert or update of payment_status,fulfillment_type,expires_at on public.orders
for each row execute function public.enforce_order_reservation_lifecycle();

update public.orders set expires_at=null,
  metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('reservation_timer_suspended_at',now(),'reservation_timer_suspension_reason',case when coalesce(payment_status,'pending')='paid' then 'payment_confirmed_backfill' else 'delivery_order_backfill' end)
where expires_at is not null and (coalesce(payment_status,'pending')='paid' or coalesce(fulfillment_type,'pickup')='delivery');

create or replace function public.expire_public_order_reservations()
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare o record; r record; n integer:=0; m integer:=0;
begin
 for o in select id,store_id,order_code from public.orders
  where status='reserved' and coalesce(fulfillment_type,'pickup')='pickup'
   and coalesce(payment_status,'pending')<>'paid' and expires_at is not null and expires_at<=now()
  order by expires_at
 loop
  for r in select id,store_id,product_id,location_id,quantity from public.stock_reservations where order_id=o.id and status='active'
  loop
   update public.inventory_location_balances set reserved=greatest(0,reserved-r.quantity),updated_at=now() where store_id=r.store_id and product_id=r.product_id and location_id=r.location_id;
   update public.inventory_balances set reserved=greatest(0,reserved-r.quantity),updated_at=now() where store_id=r.store_id and product_id=r.product_id;
   update public.stock_reservations set status='expired',metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('expired_at',now(),'expired_by','expire_public_order_reservations') where id=r.id;
   m:=m+1;
  end loop;
  update public.orders set status='cancelled',commercial_metadata=coalesce(commercial_metadata,'{}'::jsonb)||jsonb_build_object('cancelled_reason','reservation_expired','cancelled_at',now(),'cancelled_by','expire_public_order_reservations'),metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('reservation_expired_at',now()) where id=o.id;
  n:=n+1;
 end loop;
 return jsonb_build_object('ok',true,'orders_expired',n,'reservations_expired',m);
end;
$$;

create or replace function public.admin_dispatch_public_order_safe_internal_0d(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare o public.orders%rowtype;
begin
 select * into o from public.orders where id=p_order_id for update;
 if o.id is null then return jsonb_build_object('ok',false,'error','order_not_found'); end if;
 if auth.uid() is null or not public.is_store_member(o.store_id) then return jsonb_build_object('ok',false,'error','access_denied'); end if;
 if coalesce(o.fulfillment_type,'pickup')<>'delivery' then return jsonb_build_object('ok',false,'error','order_is_not_delivery'); end if;
 if o.status::text='out_for_delivery' then return jsonb_build_object('ok',true,'skipped',true,'reason','already_out_for_delivery','order_id',o.id); end if;
 if o.status::text not in ('confirmed','ready') then return jsonb_build_object('ok',false,'error','order_not_ready_for_dispatch','current_status',o.status::text); end if;
 perform public.confirm_order_stock(o.store_id,o.id,auth.uid());
 update public.orders set status='out_for_delivery',expires_at=null,metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('out_for_delivery_at',now(),'stock_written_off_at',now()),updated_at=now() where id=o.id;
 return jsonb_build_object('ok',true,'order_id',o.id,'order_code',o.order_code,'status','out_for_delivery');
end;
$$;
create or replace function public.admin_dispatch_public_order_safe(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare s uuid; r text:=coalesce(auth.role(),'');
begin
 select store_id into s from public.orders where id=p_order_id;
 if s is null then return jsonb_build_object('ok',false,'error','order_not_found'); end if;
 if r in ('anon','authenticated') and (auth.uid() is null or not (public.app_is_store_owner(s) or public.user_has_store_permission(s,'orders.manage'))) then return jsonb_build_object('ok',false,'error','access_denied'); end if;
 return public.admin_dispatch_public_order_safe_internal_0d(p_order_id);
end;
$$;
create or replace function public.admin_complete_public_order_safe_internal_0d(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare o public.orders%rowtype; x jsonb;
begin
 if p_order_id is null then return jsonb_build_object('ok',false,'error','missing_order_id'); end if;
 select * into o from public.orders where id=p_order_id for update;
 if o.id is null then return jsonb_build_object('ok',false,'error','order_not_found'); end if;
 if auth.uid() is null or not public.is_store_member(o.store_id) then return jsonb_build_object('ok',false,'error','access_denied'); end if;
 if o.status::text='completed' then return jsonb_build_object('ok',true,'skipped',true,'reason','already_completed','order_id',o.id,'order_code',o.order_code); end if;
 if o.status::text='out_for_delivery' then
  update public.orders set status='completed',completed_at=coalesce(completed_at,now()),metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('delivery_completed_at',now()),updated_at=now() where id=o.id;
  return jsonb_build_object('ok',true,'order_id',o.id,'order_code',o.order_code,'status','completed');
 end if;
 if o.status::text not in ('confirmed','ready') then return jsonb_build_object('ok',false,'error','order_not_confirmed','current_status',o.status::text); end if;
 if o.status::text='ready' then update public.orders set status='confirmed' where id=o.id; end if;
 x:=public.complete_confirmed_public_order(o.id); return x;
end;
$$;
revoke all on function public.enforce_order_reservation_lifecycle() from public;
revoke all on function public.admin_dispatch_public_order_safe(uuid) from public;
revoke all on function public.admin_dispatch_public_order_safe_internal_0d(uuid) from public;
grant execute on function public.admin_dispatch_public_order_safe(uuid) to authenticated,service_role;
