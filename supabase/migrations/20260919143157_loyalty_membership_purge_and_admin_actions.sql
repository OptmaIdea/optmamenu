-- Saída definitiva, remoção administrativa e banimento da fidelidade.
create or replace function public.purge_customer_loyalty_data_internal(p_store_id uuid,p_customer_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_vouchers integer:=0; v_transactions integer:=0; v_consents integer:=0;
begin
  delete from public.fidelity_vouchers where store_id=p_store_id and customer_id=p_customer_id;
  get diagnostics v_vouchers=row_count;
  delete from public.loyalty_transactions lt
   where lt.customer_id=p_customer_id and (
     lt.program_id is null
     or exists(select 1 from public.fidelity_programs fp where fp.id=lt.program_id and fp.store_id=p_store_id)
     or exists(select 1 from public.orders o where o.id=lt.order_id and o.store_id=p_store_id)
   );
  get diagnostics v_transactions=row_count;
  delete from public.customer_consent_logs where customer_id=p_customer_id and store_id=p_store_id and consent_type='loyalty_program';
  get diagnostics v_consents=row_count;
  update public.customers set loyalty_opt_in=false,loyalty_points=0,loyalty_tier='Bronze',current_tier_id=null,
    current_stamps=0,last_point_activity_at=null,updated_at=clock_timestamp()
  where id=p_customer_id and store_id=p_store_id;
  return jsonb_build_object('ok',true,'deleted_vouchers',v_vouchers,'deleted_transactions',v_transactions,'deleted_loyalty_consents',v_consents);
end;
$function$;
revoke all on function public.purge_customer_loyalty_data_internal(uuid,uuid) from public,anon,authenticated;
grant execute on function public.purge_customer_loyalty_data_internal(uuid,uuid) to service_role;

create or replace function public.leave_customer_self_loyalty_safe()
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_customer_id uuid:=public.app_current_customer_id(); v_store_id uuid:=public.app_current_store_id(); v_result jsonb;
begin
  if public.app_current_role()<>'customer' or v_customer_id is null or v_store_id is null then
    return jsonb_build_object('ok',false,'error','access_denied');
  end if;
  if not exists(select 1 from public.customers c where c.id=v_customer_id and c.store_id=v_store_id and c.status not in ('merged','anonymized')) then
    return jsonb_build_object('ok',false,'error','customer_not_found');
  end if;
  v_result:=public.purge_customer_loyalty_data_internal(v_store_id,v_customer_id);
  return coalesce(v_result,'{}'::jsonb)||jsonb_build_object('ok',true,'membership','left','can_rejoin',true,'message','Participação encerrada e dados do programa removidos.');
end;
$function$;
revoke all on function public.leave_customer_self_loyalty_safe() from public,anon;
grant execute on function public.leave_customer_self_loyalty_safe() to authenticated,service_role;

create or replace function public.admin_set_customer_loyalty_membership_safe(p_store_id uuid,p_customer_id uuid,p_action text,p_reason text default null)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
 v_action text:=lower(trim(coalesce(p_action,''))); v_customer public.customers%rowtype; v_hash text;
 v_user uuid:=auth.uid(); v_result jsonb:='{}'::jsonb;
begin
 if p_store_id is null or p_customer_id is null then return jsonb_build_object('ok',false,'error','missing_parameters'); end if;
 if not (public.app_is_store_owner(p_store_id) or public.user_has_store_permission_v2(p_store_id,'loyalty.manage') or public.user_has_store_permission_v2(p_store_id,'customers.manage')) then
   return jsonb_build_object('ok',false,'error','access_denied');
 end if;
 select * into v_customer from public.customers where id=p_customer_id and store_id=p_store_id for update;
 if not found then return jsonb_build_object('ok',false,'error','customer_not_found'); end if;
 if v_action='remove' then
   v_result:=public.purge_customer_loyalty_data_internal(p_store_id,p_customer_id);
   return coalesce(v_result,'{}'::jsonb)||jsonb_build_object('ok',true,'membership','removed','can_rejoin',true);
 end if;
 if v_action='ban' then
   if length(regexp_replace(coalesce(v_customer.cpf,''),'\D','','g'))<>11 then return jsonb_build_object('ok',false,'error','cpf_required_for_ban'); end if;
   v_hash:=public.fidelity_cpf_hash(p_store_id,v_customer.cpf);
   v_result:=public.purge_customer_loyalty_data_internal(p_store_id,p_customer_id);
   insert into public.fidelity_membership_blocks(store_id,customer_id,cpf_hash,cpf_last4,reason,blocked_by,metadata)
   values(p_store_id,p_customer_id,v_hash,right(regexp_replace(v_customer.cpf,'\D','','g'),4),nullif(trim(coalesce(p_reason,'')),''),v_user,jsonb_build_object('source','admin_loyalty_membership'))
   on conflict (store_id,cpf_hash) where unblocked_at is null do update
   set customer_id=excluded.customer_id,reason=excluded.reason,blocked_by=excluded.blocked_by,blocked_at=clock_timestamp(),metadata=excluded.metadata;
   return coalesce(v_result,'{}'::jsonb)||jsonb_build_object('ok',true,'membership','banned','can_rejoin',false);
 end if;
 if v_action='unban' then
   if length(regexp_replace(coalesce(v_customer.cpf,''),'\D','','g'))=11 then
     v_hash:=public.fidelity_cpf_hash(p_store_id,v_customer.cpf);
     update public.fidelity_membership_blocks set unblocked_at=clock_timestamp(),unblocked_by=v_user
     where store_id=p_store_id and unblocked_at is null and (customer_id=p_customer_id or cpf_hash=v_hash);
   else
     update public.fidelity_membership_blocks set unblocked_at=clock_timestamp(),unblocked_by=v_user
     where store_id=p_store_id and unblocked_at is null and customer_id=p_customer_id;
   end if;
   return jsonb_build_object('ok',true,'membership','unbanned','can_rejoin',true);
 end if;
 return jsonb_build_object('ok',false,'error','invalid_action');
end;
$function$;
revoke all on function public.admin_set_customer_loyalty_membership_safe(uuid,uuid,text,text) from public,anon;
grant execute on function public.admin_set_customer_loyalty_membership_safe(uuid,uuid,text,text) to authenticated,service_role;

create or replace function public.get_admin_customer_loyalty_membership_safe(p_store_id uuid,p_customer_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_block record;
begin
 if not (public.app_is_store_owner(p_store_id) or public.user_has_store_permission_v2(p_store_id,'loyalty.view') or public.user_has_store_permission_v2(p_store_id,'customers.view')) then
   return jsonb_build_object('ok',false,'error','access_denied');
 end if;
 select b.id,b.reason,b.blocked_at,b.cpf_last4 into v_block
 from public.fidelity_membership_blocks b where b.store_id=p_store_id and b.customer_id=p_customer_id and b.unblocked_at is null
 order by b.blocked_at desc limit 1;
 return jsonb_build_object('ok',true,'blocked',v_block.id is not null,'reason',v_block.reason,'blocked_at',v_block.blocked_at,'cpf_last4',v_block.cpf_last4);
end;
$function$;
revoke all on function public.get_admin_customer_loyalty_membership_safe(uuid,uuid) from public,anon;
grant execute on function public.get_admin_customer_loyalty_membership_safe(uuid,uuid) to authenticated,service_role;
