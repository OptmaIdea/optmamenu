-- Estornos/devoluções: sincroniza o total de pontos retirados com o valor efetivamente
-- devolvido. O extrato permanece imutável: diferenças são novos lançamentos reversos/corretivos.
create or replace function public.sync_order_loyalty_refund_reversal_internal(p_order_id uuid,p_force_full boolean default false,p_reason text default null)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_order record; v_tx record; v_total_refunded numeric:=0; v_target integer; v_current_removed integer; v_delta integer; v_balance_delta integer:=0; v_new_balance integer; v_tier_id uuid; v_tier_name text; begin
  select o.id,o.store_id,o.customer_id,o.total,o.order_code into v_order from public.orders o where o.id=p_order_id;
  if v_order.id is null or v_order.customer_id is null then return jsonb_build_object('ok',true,'skipped',true); end if;
  if p_force_full then v_total_refunded:=coalesce(v_order.total,0); else select coalesce(sum(sa.refund_amount),0) into v_total_refunded from public.sale_adjustments sa where sa.order_id=p_order_id and sa.store_id=v_order.store_id and sa.status='completed'; end if;
  if v_total_refunded<=0 then return jsonb_build_object('ok',true,'skipped',true); end if;

  for v_tx in select lt.* from public.loyalty_transactions lt where lt.order_id=p_order_id and lt.customer_id=v_order.customer_id and lt.type='order' and lt.points>0 order by lt.created_at loop
    v_target:=case when p_force_full or v_total_refunded>=coalesce(v_order.total,0)-0.005 then v_tx.points else floor(v_tx.points*least(v_total_refunded/greatest(v_order.total,0.01),1))::integer end;
    select greatest(coalesce(-sum(x.points),0),0)::integer into v_current_removed from public.loyalty_transactions x where x.related_transaction_id=v_tx.id and x.type in ('reversal','adjustment') and (x.description like 'Estorno de fidelidade:%' or x.description like 'Correção de estorno de fidelidade:%' or x.description like 'Estorno automático:%');
    v_delta:=v_target-v_current_removed;
    if v_delta>0 then
      insert into public.loyalty_transactions(program_id,customer_id,type,points,description,order_id,related_transaction_id,created_by,created_at)
      values(v_tx.program_id,v_order.customer_id,'reversal',-v_delta,'Estorno de fidelidade: '||coalesce(p_reason,'devolução/estorno da venda'),p_order_id,v_tx.id,auth.uid(),now());
      v_balance_delta:=v_balance_delta-v_delta;
    elsif v_delta<0 then
      insert into public.loyalty_transactions(program_id,customer_id,type,points,description,order_id,related_transaction_id,created_by,created_at)
      values(v_tx.program_id,v_order.customer_id,'adjustment',abs(v_delta),'Correção de estorno de fidelidade: recálculo da devolução',p_order_id,v_tx.id,auth.uid(),now());
      v_balance_delta:=v_balance_delta+abs(v_delta);
    end if;
  end loop;

  if v_balance_delta<>0 then
    update public.customers set loyalty_points=greatest(coalesce(loyalty_points,0)+v_balance_delta,0),last_point_activity_at=now(),updated_at=now() where id=v_order.customer_id and store_id=v_order.store_id returning loyalty_points into v_new_balance;
    select ft.id,ft.name into v_tier_id,v_tier_name from public.fidelity_tiers ft where ft.store_id=v_order.store_id and ft.min_points<=greatest(coalesce(v_new_balance,0),0) order by ft.min_points desc limit 1;
    update public.customers set current_tier_id=v_tier_id,loyalty_tier=coalesce(v_tier_name,'Bronze') where id=v_order.customer_id and store_id=v_order.store_id;
    insert into public.customer_notifications(customer_id,store_id,title,message,type)
    values(v_order.customer_id,v_order.store_id,case when v_balance_delta<0 then 'Pontos estornados' else 'Pontos recalculados' end,
      case when v_balance_delta<0 then abs(v_balance_delta)::text||' ponto(s) foram estornados por devolução/estorno da venda '||coalesce(v_order.order_code,'#'||substring(v_order.id::text,1,8))||'.' else v_balance_delta::text||' ponto(s) retornaram após recálculo da devolução.' end,
      case when v_balance_delta<0 then 'warning' else 'info' end);
  end if;
  return jsonb_build_object('ok',true,'balance_delta',v_balance_delta,'refunded_total',v_total_refunded);
end;$function$;
revoke all on function public.sync_order_loyalty_refund_reversal_internal(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.sync_order_loyalty_refund_reversal_internal(uuid,boolean,text) to service_role;

create or replace function public.sync_loyalty_after_sale_adjustment()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  if new.status='completed' and (tg_op='INSERT' or old.status is distinct from new.status or old.refund_amount is distinct from new.refund_amount) then
    perform public.sync_order_loyalty_refund_reversal_internal(new.order_id,false,case when new.adjustment_type='full_cancellation' then 'cancelamento integral da venda' else 'devolução parcial da venda' end);
  end if;
  return new;
end;$function$;
revoke all on function public.sync_loyalty_after_sale_adjustment() from public,anon,authenticated;
grant execute on function public.sync_loyalty_after_sale_adjustment() to service_role;

drop trigger if exists trg_sale_adjustments_sync_loyalty on public.sale_adjustments;
create trigger trg_sale_adjustments_sync_loyalty
after insert or update of status,refund_amount on public.sale_adjustments
for each row execute function public.sync_loyalty_after_sale_adjustment();

create or replace function public.reverse_order_loyalty_points_on_cancel()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  if tg_op='UPDATE' and old.status::text='completed' and new.status::text='cancelled' and new.customer_id is not null then
    perform public.sync_order_loyalty_refund_reversal_internal(new.id,true,'pedido concluído posteriormente cancelado');
  end if;
  return new;
end;$function$;
revoke all on function public.reverse_order_loyalty_points_on_cancel() from public,anon,authenticated;
grant execute on function public.reverse_order_loyalty_points_on_cancel() to service_role;

drop policy if exists "Users can manage their own fidelity program" on public.fidelity_programs;
drop policy if exists "Store owners manage tiers" on public.fidelity_tiers;
drop policy if exists "Users can manage their own fidelity rewards" on public.fidelity_rewards;
drop policy if exists "Public can view active rewards" on public.fidelity_rewards;
drop policy if exists loyalty_point_rules_store_members_all on public.loyalty_point_rules;
drop policy if exists customer_benefit_rules_store_members_all on public.customer_benefit_rules;
drop policy if exists loyalty_transactions_owner_all on public.loyalty_transactions;
drop policy if exists fidelity_vouchers_owner_all on public.fidelity_vouchers;

drop policy if exists fidelity_rewards_public_read_by_store on public.fidelity_rewards;
create policy fidelity_rewards_public_read_by_store on public.fidelity_rewards for select to anon,authenticated using (
  public.app_current_role() in ('store_anon','customer') and exists(
    select 1 from public.fidelity_programs fp where fp.id=fidelity_rewards.program_id and fp.store_id=public.app_current_store_id() and coalesce(fp.is_active,false)=true
  ) and coalesce(is_active,true)=true
);

alter table public.fidelity_programs force row level security;
alter table public.fidelity_tiers force row level security;
alter table public.fidelity_rewards force row level security;
alter table public.fidelity_vouchers force row level security;
alter table public.loyalty_point_rules force row level security;
alter table public.loyalty_transactions force row level security;
alter table public.customer_benefit_rules force row level security;

revoke insert,update,delete,truncate,references,trigger on public.fidelity_programs from anon,authenticated;
revoke insert,update,delete,truncate,references,trigger on public.fidelity_tiers from anon,authenticated;
revoke insert,update,delete,truncate,references,trigger on public.fidelity_rewards from anon,authenticated;
revoke insert,update,delete,truncate,references,trigger on public.fidelity_vouchers from anon,authenticated;
revoke insert,update,delete,truncate,references,trigger on public.loyalty_point_rules from anon,authenticated;
revoke insert,update,delete,truncate,references,trigger on public.loyalty_transactions from anon,authenticated;
revoke insert,update,delete,truncate,references,trigger on public.customer_benefit_rules from anon,authenticated;

revoke all on function public.adjust_customer_loyalty_points_safe(uuid,uuid,integer,text) from public,anon;
grant execute on function public.adjust_customer_loyalty_points_safe(uuid,uuid,integer,text) to authenticated,service_role;
revoke all on function public.upsert_loyalty_point_rule_safe(uuid,uuid,text,text,text,text,text,text,numeric,integer,boolean,boolean,timestamptz,timestamptz,jsonb,jsonb) from public,anon;
grant execute on function public.upsert_loyalty_point_rule_safe(uuid,uuid,text,text,text,text,text,text,numeric,integer,boolean,boolean,timestamptz,timestamptz,jsonb,jsonb) to authenticated,service_role;