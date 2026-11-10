-- Fidelidade: expose existing stamp campaign rules to authenticated customer self-service.
-- Read-only addition; authorization and all existing fields remain unchanged.
CREATE OR REPLACE FUNCTION public.get_customer_self_loyalty_program_safe()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_customer_id uuid:=public.app_current_customer_id();
  v_store_id uuid:=public.app_current_store_id();
  v_customer public.customers%rowtype;
  v_program public.fidelity_programs%rowtype;
  v_store_name text;
  v_blocked boolean:=false;
  v_block_reason text;
  v_terms text;
  v_voucher_terms text;
  v_voucher_days integer:=15;
  v_preview jsonb;
begin
  if public.app_current_role()<>'customer' or v_customer_id is null or v_store_id is null then
    return jsonb_build_object('ok',false,'error','access_denied');
  end if;
  select * into v_customer from public.customers where id=v_customer_id and store_id=v_store_id limit 1;
  if not found then return jsonb_build_object('ok',false,'error','customer_not_found'); end if;
  select * into v_program from public.fidelity_programs where store_id=v_store_id order by is_active desc,updated_at desc limit 1;
  select s.name into v_store_name from public.stores s where s.id=v_store_id;
  select exists(
    select 1 from public.fidelity_membership_blocks b
    where b.store_id=v_store_id and b.unblocked_at is null and (
      b.customer_id=v_customer_id or (
        length(regexp_replace(coalesce(v_customer.cpf,''),'\D','','g'))=11
        and b.cpf_hash=public.fidelity_cpf_hash(v_store_id,v_customer.cpf)
      )
    )
  ) into v_blocked;
  select b.reason into v_block_reason from public.fidelity_membership_blocks b
  where b.store_id=v_store_id and b.unblocked_at is null and (
    b.customer_id=v_customer_id or (
      length(regexp_replace(coalesce(v_customer.cpf,''),'\D','','g'))=11
      and b.cpf_hash=public.fidelity_cpf_hash(v_store_id,v_customer.cpf)
    )
  ) order by b.blocked_at desc limit 1;
  if v_program.id is null then
    return jsonb_build_object('ok',true,'program',null,'membership_blocked',v_blocked,'block_reason',v_block_reason);
  end if;
  select coalesce(max(fr.voucher_validity_days),15) into v_voucher_days
  from public.fidelity_rewards fr where fr.program_id=v_program.id and coalesce(fr.is_active,true)=true;
  v_terms:=coalesce(v_program.program_terms,'');
  v_voucher_terms:=coalesce(v_program.voucher_terms,'');
  v_terms:=replace(replace(replace(replace(v_terms,'{{STORE_NAME}}',coalesce(v_store_name,'Loja')),'{{CURRENT_DATE}}',to_char(current_date,'DD/MM/YYYY')),'{{POINTS_VALIDITY_MONTHS}}',coalesce(v_program.points_validity_months,0)::text),'{{VOUCHER_VALIDITY_DAYS}}',coalesce(v_voucher_days,15)::text);
  v_voucher_terms:=replace(replace(replace(replace(v_voucher_terms,'{{STORE_NAME}}',coalesce(v_store_name,'Loja')),'{{CURRENT_DATE}}',to_char(current_date,'DD/MM/YYYY')),'{{POINTS_VALIDITY_MONTHS}}',coalesce(v_program.points_validity_months,0)::text),'{{VOUCHER_VALIDITY_DAYS}}',coalesce(v_voucher_days,15)::text);
  v_preview:=public.loyalty_join_bonus_preview_internal(v_store_id,v_customer_id);
  return jsonb_build_object(
    'ok',true,'membership_blocked',v_blocked,'block_reason',v_block_reason,'join_policy',v_preview,
    'audit_retention_months',v_program.loyalty_audit_retention_months,
    'audit_purpose','Prevenção de abuso de bônus de reentrada, segurança e auditoria do programa.',
    'program',jsonb_build_object(
      'id',v_program.id,'name',v_program.name,'is_active',v_program.is_active,
      'points_per_currency',v_program.points_per_currency,'min_order_value',v_program.min_order_value,
      'enable_join_bonus',v_program.enable_join_bonus,'join_bonus_points',v_program.join_bonus_points,
      'reentry_bonus_mode',v_program.reentry_bonus_mode,'reentry_bonus_percentage',v_program.reentry_bonus_percentage,
      'reentry_bonus_fixed_points',v_program.reentry_bonus_fixed_points,'reentry_bonus_cooldown_days',v_program.reentry_bonus_cooldown_days,
      'reentry_bonus_max_awards',v_program.reentry_bonus_max_awards,
      'enable_birthday_bonus',v_program.enable_birthday_bonus,'birthday_bonus_points',v_program.birthday_bonus_points,
      'points_validity_months',v_program.points_validity_months,
      'enable_stamps',v_program.enable_stamps,
      'min_order_for_stamp',v_program.min_order_for_stamp,
      'stamps_target',v_program.stamps_target,
      'points_per_stamp_block',v_program.points_per_stamp_block,
      'min_points_redemption',v_program.min_points_redemption,
      'program_terms',v_terms,'voucher_terms',v_voucher_terms,'updated_at',v_program.updated_at
    )
  );
end;
$function$;
