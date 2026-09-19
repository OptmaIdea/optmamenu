-- Regulamento do programa no portal do cliente e bloqueio de nova adesão por CPF.
create or replace function public.get_customer_self_loyalty_program_safe()
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
 v_customer_id uuid:=public.app_current_customer_id(); v_store_id uuid:=public.app_current_store_id();
 v_customer public.customers%rowtype; v_program public.fidelity_programs%rowtype; v_store_name text;
 v_blocked boolean:=false; v_block_reason text; v_terms text; v_voucher_terms text; v_voucher_days integer:=15;
begin
 if public.app_current_role()<>'customer' or v_customer_id is null or v_store_id is null then return jsonb_build_object('ok',false,'error','access_denied'); end if;
 select * into v_customer from public.customers where id=v_customer_id and store_id=v_store_id limit 1;
 if not found then return jsonb_build_object('ok',false,'error','customer_not_found'); end if;
 select * into v_program from public.fidelity_programs where store_id=v_store_id order by is_active desc,updated_at desc limit 1;
 select s.name into v_store_name from public.stores s where s.id=v_store_id;
 select exists(select 1 from public.fidelity_membership_blocks b where b.store_id=v_store_id and b.unblocked_at is null
   and (b.customer_id=v_customer_id or (length(regexp_replace(coalesce(v_customer.cpf,''),'\D','','g'))=11 and b.cpf_hash=public.fidelity_cpf_hash(v_store_id,v_customer.cpf))))
 into v_blocked;
 select b.reason into v_block_reason from public.fidelity_membership_blocks b where b.store_id=v_store_id and b.unblocked_at is null
   and (b.customer_id=v_customer_id or (length(regexp_replace(coalesce(v_customer.cpf,''),'\D','','g'))=11 and b.cpf_hash=public.fidelity_cpf_hash(v_store_id,v_customer.cpf)))
 order by b.blocked_at desc limit 1;
 if v_program.id is null then return jsonb_build_object('ok',true,'program',null,'membership_blocked',v_blocked,'block_reason',v_block_reason); end if;
 select coalesce(max(fr.voucher_validity_days),15) into v_voucher_days from public.fidelity_rewards fr where fr.program_id=v_program.id and coalesce(fr.is_active,true)=true;
 v_terms:=coalesce(v_program.program_terms,''); v_voucher_terms:=coalesce(v_program.voucher_terms,'');
 v_terms:=replace(replace(replace(replace(v_terms,'{{STORE_NAME}}',coalesce(v_store_name,'Loja')),'{{CURRENT_DATE}}',to_char(current_date,'DD/MM/YYYY')),'{{POINTS_VALIDITY_MONTHS}}',coalesce(v_program.points_validity_months,0)::text),'{{VOUCHER_VALIDITY_DAYS}}',coalesce(v_voucher_days,15)::text);
 v_voucher_terms:=replace(replace(replace(replace(v_voucher_terms,'{{STORE_NAME}}',coalesce(v_store_name,'Loja')),'{{CURRENT_DATE}}',to_char(current_date,'DD/MM/YYYY')),'{{POINTS_VALIDITY_MONTHS}}',coalesce(v_program.points_validity_months,0)::text),'{{VOUCHER_VALIDITY_DAYS}}',coalesce(v_voucher_days,15)::text);
 return jsonb_build_object('ok',true,'membership_blocked',v_blocked,'block_reason',v_block_reason,'program',jsonb_build_object(
   'id',v_program.id,'name',v_program.name,'is_active',v_program.is_active,'points_per_currency',v_program.points_per_currency,
   'min_order_value',v_program.min_order_value,'enable_join_bonus',v_program.enable_join_bonus,'join_bonus_points',v_program.join_bonus_points,
   'enable_birthday_bonus',v_program.enable_birthday_bonus,'birthday_bonus_points',v_program.birthday_bonus_points,
   'points_validity_months',v_program.points_validity_months,'min_points_redemption',v_program.min_points_redemption,
   'program_terms',v_terms,'voucher_terms',v_voucher_terms,'updated_at',v_program.updated_at
 ));
end;
$function$;
revoke all on function public.get_customer_self_loyalty_program_safe() from public,anon;
grant execute on function public.get_customer_self_loyalty_program_safe() to authenticated,service_role;

-- Esta versão preserva o contrato anterior e adiciona a trava de CPF banido antes da adesão.
-- O corpo completo da RPC é mantido no banco; a alteração relevante é o lookup em fidelity_membership_blocks.
