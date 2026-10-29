-- Segurança administrativa: leitura só com loyalty.view; escrita só com loyalty.manage.
create or replace function public.get_loyalty_advanced_settings_safe(p_store_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_program jsonb; v_tiers jsonb; v_point_rules jsonb; v_benefit_rules jsonb;
  v_rewards jsonb; v_categories jsonb; v_overview jsonb;
begin
  if p_store_id is null then return jsonb_build_object('ok',false,'error','missing_store_id'); end if;
  if auth.uid() is null or not (
    public.app_is_store_owner(p_store_id) or public.user_has_store_permission_v2(p_store_id,'loyalty.view') or public.user_has_store_permission_v2(p_store_id,'loyalty.manage')
  ) then return jsonb_build_object('ok',false,'error','access_denied'); end if;

  select to_jsonb(fp) into v_program from public.fidelity_programs fp where fp.store_id=p_store_id order by fp.updated_at desc limit 1;
  select coalesce(jsonb_agg(to_jsonb(ft) order by ft.min_points,ft.position),'[]'::jsonb) into v_tiers from public.fidelity_tiers ft where ft.store_id=p_store_id;
  select coalesce(jsonb_agg(to_jsonb(lpr) order by lpr.priority,lpr.created_at),'[]'::jsonb) into v_point_rules from public.loyalty_point_rules lpr where lpr.store_id=p_store_id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',br.id,'store_id',br.store_id,'code',br.code,'name',br.name,'description',br.description,
    'benefit_type',br.benefit_type,'target_type',br.target_type,'target_tier_id',br.target_tier_id,'target_tier_name',ft.name,
    'target_customer_id',br.target_customer_id,'target_customer_name',c.full_name,'target_customer_phone',c.phone,
    'target_tag',br.target_tag,'discount_percent',br.discount_percent,'discount_amount',br.discount_amount,'bonus_points',br.bonus_points,
    'free_delivery',br.free_delivery,'minimum_order_value',br.minimum_order_value,'max_uses_total',br.max_uses_total,
    'max_uses_per_customer',br.max_uses_per_customer,'active',br.active,'starts_at',br.starts_at,'ends_at',br.ends_at,
    'conditions',br.conditions,'metadata',br.metadata,'created_at',br.created_at,'updated_at',br.updated_at
  ) order by br.created_at desc),'[]'::jsonb) into v_benefit_rules
  from public.customer_benefit_rules br
  left join public.fidelity_tiers ft on ft.id=br.target_tier_id
  left join public.customers c on c.id=br.target_customer_id
  where br.store_id=p_store_id;

  select coalesce(jsonb_agg(to_jsonb(fr) order by fr.created_at desc),'[]'::jsonb) into v_rewards
  from public.fidelity_rewards fr join public.fidelity_programs fp on fp.id=fr.program_id
  where fp.store_id=p_store_id;

  select coalesce(jsonb_agg(jsonb_build_object('id',cat.id,'name',cat.name,'loyalty_eligible',coalesce(cat.loyalty_eligible,true),'loyalty_multiplier',coalesce(cat.loyalty_multiplier,1)) order by cat.name),'[]'::jsonb)
  into v_categories from public.categories cat where cat.store_id=p_store_id;

  select jsonb_build_object(
    'participants',count(*) filter (where coalesce(c.loyalty_opt_in,false) and c.status not in ('merged','anonymized','deleted_requested','blocked')),
    'points_in_circulation',coalesce(sum(c.loyalty_points) filter (where coalesce(c.loyalty_opt_in,false)),0),
    'active_blocks',(select count(*) from public.fidelity_membership_blocks b where b.store_id=p_store_id and b.unblocked_at is null),
    'transactions_30d',(select count(*) from public.loyalty_transactions lt join public.customers c2 on c2.id=lt.customer_id where c2.store_id=p_store_id and lt.created_at>=now()-interval '30 days')
  ) into v_overview from public.customers c where c.store_id=p_store_id;

  return jsonb_build_object('ok',true,'program',coalesce(v_program,'null'::jsonb),'tiers',v_tiers,'point_rules',v_point_rules,
    'benefit_rules',v_benefit_rules,'rewards',v_rewards,'category_rules',v_categories,'overview',v_overview);
end;
$function$;
revoke all on function public.get_loyalty_advanced_settings_safe(uuid) from public,anon;
grant execute on function public.get_loyalty_advanced_settings_safe(uuid) to authenticated,service_role;

create or replace function public.update_loyalty_program_safe(p_store_id uuid,p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_program public.fidelity_programs%rowtype;
begin
  if p_store_id is null or p_patch is null then return jsonb_build_object('ok',false,'error','missing_parameters'); end if;
  if auth.uid() is null or not (public.app_is_store_owner(p_store_id) or public.user_has_store_permission_v2(p_store_id,'loyalty.manage')) then
    return jsonb_build_object('ok',false,'error','access_denied');
  end if;
  select * into v_program from public.fidelity_programs where store_id=p_store_id order by updated_at desc limit 1 for update;
  if not found then return jsonb_build_object('ok',false,'error','loyalty_program_not_found'); end if;

  update public.fidelity_programs set
    name=case when p_patch?'name' then coalesce(nullif(trim(p_patch->>'name'),''),name) else name end,
    is_active=case when p_patch?'is_active' then coalesce((p_patch->>'is_active')::boolean,is_active) else is_active end,
    points_per_currency=case when p_patch?'points_per_currency' then greatest(coalesce((p_patch->>'points_per_currency')::numeric,0),0) else points_per_currency end,
    min_order_value=case when p_patch?'min_order_value' then greatest(coalesce((p_patch->>'min_order_value')::numeric,0),0) else min_order_value end,
    enable_join_bonus=case when p_patch?'enable_join_bonus' then coalesce((p_patch->>'enable_join_bonus')::boolean,false) else enable_join_bonus end,
    join_bonus_points=case when p_patch?'join_bonus_points' then greatest(coalesce((p_patch->>'join_bonus_points')::integer,0),0) else join_bonus_points end,
    enable_birthday_bonus=case when p_patch?'enable_birthday_bonus' then coalesce((p_patch->>'enable_birthday_bonus')::boolean,false) else enable_birthday_bonus end,
    birthday_bonus_points=case when p_patch?'birthday_bonus_points' then greatest(coalesce((p_patch->>'birthday_bonus_points')::integer,0),0) else birthday_bonus_points end,
    enable_cashback=case when p_patch?'enable_cashback' then coalesce((p_patch->>'enable_cashback')::boolean,false) else enable_cashback end,
    points_validity_months=case when p_patch?'points_validity_months' then greatest(coalesce((p_patch->>'points_validity_months')::integer,0),0) else points_validity_months end,
    min_points_redemption=case when p_patch?'min_points_redemption' then greatest(coalesce((p_patch->>'min_points_redemption')::integer,0),0) else min_points_redemption end,
    enable_stamps=case when p_patch?'enable_stamps' then coalesce((p_patch->>'enable_stamps')::boolean,false) else enable_stamps end,
    min_order_for_stamp=case when p_patch?'min_order_for_stamp' then greatest(coalesce((p_patch->>'min_order_for_stamp')::numeric,0),0) else min_order_for_stamp end,
    stamps_target=case when p_patch?'stamps_target' then greatest(coalesce((p_patch->>'stamps_target')::integer,1),1) else stamps_target end,
    points_per_stamp_block=case when p_patch?'points_per_stamp_block' then greatest(coalesce((p_patch->>'points_per_stamp_block')::integer,0),0) else points_per_stamp_block end,
    warn_voucher_expiry_1=case when p_patch?'warn_voucher_expiry_1' then nullif(p_patch->>'warn_voucher_expiry_1','')::integer else warn_voucher_expiry_1 end,
    warn_voucher_expiry_2=case when p_patch?'warn_voucher_expiry_2' then nullif(p_patch->>'warn_voucher_expiry_2','')::integer else warn_voucher_expiry_2 end,
    warn_voucher_expiry_3=case when p_patch?'warn_voucher_expiry_3' then nullif(p_patch->>'warn_voucher_expiry_3','')::integer else warn_voucher_expiry_3 end,
    program_terms=case when p_patch?'program_terms' then p_patch->>'program_terms' else program_terms end,
    voucher_terms=case when p_patch?'voucher_terms' then p_patch->>'voucher_terms' else voucher_terms end,
    reentry_bonus_mode=case when p_patch?'reentry_bonus_mode' then coalesce(nullif(p_patch->>'reentry_bonus_mode',''),reentry_bonus_mode) else reentry_bonus_mode end,
    reentry_bonus_percentage=case when p_patch?'reentry_bonus_percentage' then coalesce((p_patch->>'reentry_bonus_percentage')::numeric,reentry_bonus_percentage) else reentry_bonus_percentage end,
    reentry_bonus_fixed_points=case when p_patch?'reentry_bonus_fixed_points' then coalesce((p_patch->>'reentry_bonus_fixed_points')::integer,reentry_bonus_fixed_points) else reentry_bonus_fixed_points end,
    reentry_bonus_cooldown_days=case when p_patch?'reentry_bonus_cooldown_days' then coalesce((p_patch->>'reentry_bonus_cooldown_days')::integer,reentry_bonus_cooldown_days) else reentry_bonus_cooldown_days end,
    reentry_bonus_max_awards=case when p_patch?'reentry_bonus_max_awards' then nullif(p_patch->>'reentry_bonus_max_awards','')::integer else reentry_bonus_max_awards end,
    loyalty_audit_retention_months=case when p_patch?'loyalty_audit_retention_months' then coalesce((p_patch->>'loyalty_audit_retention_months')::integer,loyalty_audit_retention_months) else loyalty_audit_retention_months end,
    updated_at=clock_timestamp()
  where id=v_program.id
  returning * into v_program;
  return jsonb_build_object('ok',true,'program',to_jsonb(v_program));
exception when check_violation or invalid_text_representation then
  return jsonb_build_object('ok',false,'error','invalid_loyalty_configuration','message',sqlerrm);
end;
$function$;
revoke all on function public.update_loyalty_program_safe(uuid,jsonb) from public,anon;
grant execute on function public.update_loyalty_program_safe(uuid,jsonb) to authenticated,service_role;

create or replace function public.upsert_loyalty_tier_safe(
  p_store_id uuid,p_tier_id uuid,p_name text,p_min_points integer,p_multiplier numeric,p_color text,p_position integer
)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp'
as $function$
declare v_id uuid; begin
  if auth.uid() is null or not (public.app_is_store_owner(p_store_id) or public.user_has_store_permission_v2(p_store_id,'loyalty.manage')) then return jsonb_build_object('ok',false,'error','access_denied'); end if;
  if length(trim(coalesce(p_name,'')))<1 or coalesce(p_min_points,0)<0 or coalesce(p_multiplier,0)<=0 then return jsonb_build_object('ok',false,'error','invalid_tier'); end if;
  if p_tier_id is null then
    insert into public.fidelity_tiers(store_id,name,min_points,multiplier,color,position,created_at,updated_at)
    values(p_store_id,trim(p_name),p_min_points,p_multiplier,coalesce(nullif(trim(p_color),''),'#19A999'),coalesce(p_position,0),now(),now()) returning id into v_id;
  else
    update public.fidelity_tiers set name=trim(p_name),min_points=p_min_points,multiplier=p_multiplier,color=coalesce(nullif(trim(p_color),''),color),position=coalesce(p_position,position),updated_at=now()
    where id=p_tier_id and store_id=p_store_id returning id into v_id;
    if v_id is null then return jsonb_build_object('ok',false,'error','tier_not_found'); end if;
  end if;
  return jsonb_build_object('ok',true,'tier_id',v_id);
end;$function$;
revoke all on function public.upsert_loyalty_tier_safe(uuid,uuid,text,integer,numeric,text,integer) from public,anon;
grant execute on function public.upsert_loyalty_tier_safe(uuid,uuid,text,integer,numeric,text,integer) to authenticated,service_role;

create or replace function public.delete_loyalty_tier_safe(p_store_id uuid,p_tier_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp'
as $function$
begin
  if auth.uid() is null or not (public.app_is_store_owner(p_store_id) or public.user_has_store_permission_v2(p_store_id,'loyalty.manage')) then return jsonb_build_object('ok',false,'error','access_denied'); end if;
  if exists(select 1 from public.customers where store_id=p_store_id and current_tier_id=p_tier_id) or exists(select 1 from public.customer_benefit_rules where store_id=p_store_id and target_tier_id=p_tier_id) then
    return jsonb_build_object('ok',false,'error','tier_in_use','message','Este nível está em uso por clientes ou benefícios.');
  end if;
  delete from public.fidelity_tiers where id=p_tier_id and store_id=p_store_id;
  if not found then return jsonb_build_object('ok',false,'error','tier_not_found'); end if;
  return jsonb_build_object('ok',true);
end;$function$;
revoke all on function public.delete_loyalty_tier_safe(uuid,uuid) from public,anon;
grant execute on function public.delete_loyalty_tier_safe(uuid,uuid) to authenticated,service_role;

create or replace function public.update_loyalty_category_rule_safe(p_store_id uuid,p_category_id uuid,p_eligible boolean,p_multiplier numeric)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp'
as $function$
begin
  if auth.uid() is null or not (public.app_is_store_owner(p_store_id) or public.user_has_store_permission_v2(p_store_id,'loyalty.manage')) then return jsonb_build_object('ok',false,'error','access_denied'); end if;
  if coalesce(p_multiplier,0)<=0 then return jsonb_build_object('ok',false,'error','invalid_multiplier'); end if;
  update public.categories set loyalty_eligible=coalesce(p_eligible,true),loyalty_multiplier=p_multiplier where id=p_category_id and store_id=p_store_id;
  if not found then return jsonb_build_object('ok',false,'error','category_not_found'); end if;
  return jsonb_build_object('ok',true);
end;$function$;
revoke all on function public.update_loyalty_category_rule_safe(uuid,uuid,boolean,numeric) from public,anon;
grant execute on function public.update_loyalty_category_rule_safe(uuid,uuid,boolean,numeric) to authenticated,service_role;

create or replace function public.get_loyalty_customers_safe(p_store_id uuid,p_search text default null,p_limit integer default 50)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_limit integer:=least(greatest(coalesce(p_limit,50),1),100); v_search text:=nullif(trim(coalesce(p_search,'')),''); v_rows jsonb;
begin
  if p_store_id is null or auth.uid() is null or not (public.app_is_store_owner(p_store_id) or public.user_has_store_permission_v2(p_store_id,'loyalty.view') or public.user_has_store_permission_v2(p_store_id,'loyalty.manage')) then return jsonb_build_object('ok',false,'error','access_denied'); end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.loyalty_points desc,x.full_name nulls last),'[]'::jsonb) into v_rows
  from (
    select c.id,c.full_name,c.nickname,c.phone,c.phone_e164,c.status,c.loyalty_opt_in,c.loyalty_points,c.loyalty_tier,c.current_tier_id,c.last_point_activity_at,c.total_orders,c.total_spent,c.source,c.person_type,c.email_verified,
      case when length(regexp_replace(coalesce(c.cpf,''),'\D','','g'))=11 then right(regexp_replace(c.cpf,'\D','','g'),4) else null end cpf_last4,
      a.first_joined_at,a.last_joined_at,a.join_count
    from public.customers c
    left join public.loyalty_participation_audit a on a.store_id=c.store_id and a.customer_id=c.id
    where c.store_id=p_store_id and c.loyalty_opt_in=true and c.status not in ('merged','anonymized','deleted_requested','blocked') and coalesce((c.customer_metadata->>'operational_customer')::boolean,false)=false
      and (v_search is null or coalesce(c.full_name,'') ilike '%'||v_search||'%' or coalesce(c.nickname,'') ilike '%'||v_search||'%' or coalesce(c.phone,'') ilike '%'||regexp_replace(v_search,'\D','','g')||'%')
    order by c.loyalty_points desc,c.full_name nulls last limit v_limit
  ) x;
  return jsonb_build_object('ok',true,'customers',v_rows,'count',jsonb_array_length(v_rows));
end;$function$;
revoke all on function public.get_loyalty_customers_safe(uuid,text,integer) from public,anon;
grant execute on function public.get_loyalty_customers_safe(uuid,text,integer) to authenticated,service_role;

create or replace function public.get_admin_loyalty_transactions_safe(p_store_id uuid,p_customer_id uuid default null,p_limit integer default 100)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_rows jsonb; v_limit integer:=least(greatest(coalesce(p_limit,100),1),250); begin
  if auth.uid() is null or not (public.app_is_store_owner(p_store_id) or public.user_has_store_permission_v2(p_store_id,'loyalty.view') or public.user_has_store_permission_v2(p_store_id,'loyalty.manage')) then return jsonb_build_object('ok',false,'error','access_denied'); end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into v_rows from (
    select lt.id,lt.customer_id,c.full_name customer_name,c.nickname customer_nickname,c.phone customer_phone,lt.type,lt.points,lt.description,lt.order_id,o.order_code,lt.related_transaction_id,lt.reward_id,lt.created_by,lt.created_at
    from public.loyalty_transactions lt join public.customers c on c.id=lt.customer_id and c.store_id=p_store_id
    left join public.orders o on o.id=lt.order_id and o.store_id=p_store_id
    where (p_customer_id is null or lt.customer_id=p_customer_id)
    order by lt.created_at desc limit v_limit
  ) x;
  return jsonb_build_object('ok',true,'transactions',v_rows);
end;$function$;
revoke all on function public.get_admin_loyalty_transactions_safe(uuid,uuid,integer) from public,anon;
grant execute on function public.get_admin_loyalty_transactions_safe(uuid,uuid,integer) to authenticated,service_role;

create or replace function public.get_loyalty_blocks_and_reentry_safe(p_store_id uuid,p_limit integer default 100)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_blocks jsonb; v_events jsonb; v_program jsonb; v_limit integer:=least(greatest(coalesce(p_limit,100),1),250); begin
  if auth.uid() is null or not (public.app_is_store_owner(p_store_id) or public.user_has_store_permission_v2(p_store_id,'loyalty.view') or public.user_has_store_permission_v2(p_store_id,'loyalty.manage')) then return jsonb_build_object('ok',false,'error','access_denied'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',b.id,'customer_id',b.customer_id,'customer_name',c.full_name,'cpf_last4',b.cpf_last4,'reason',b.reason,'blocked_at',b.blocked_at,'unblocked_at',b.unblocked_at) order by b.blocked_at desc),'[]'::jsonb)
  into v_blocks from public.fidelity_membership_blocks b left join public.customers c on c.id=b.customer_id and c.store_id=b.store_id where b.store_id=p_store_id;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.occurred_at desc),'[]'::jsonb) into v_events from (
    select e.id,e.customer_id,c.full_name customer_name,e.cpf_last4,e.event_type,e.join_sequence,e.bonus_points,e.applied_rule,e.reason,e.source,e.occurred_at,e.retention_until
    from public.loyalty_membership_audit_events e left join public.customers c on c.id=e.customer_id and c.store_id=e.store_id
    where e.store_id=p_store_id order by e.occurred_at desc limit v_limit
  ) x;
  select jsonb_build_object('reentry_bonus_mode',fp.reentry_bonus_mode,'reentry_bonus_percentage',fp.reentry_bonus_percentage,'reentry_bonus_fixed_points',fp.reentry_bonus_fixed_points,'reentry_bonus_cooldown_days',fp.reentry_bonus_cooldown_days,'reentry_bonus_max_awards',fp.reentry_bonus_max_awards,'loyalty_audit_retention_months',fp.loyalty_audit_retention_months)
  into v_program from public.fidelity_programs fp where fp.store_id=p_store_id order by fp.updated_at desc limit 1;
  return jsonb_build_object('ok',true,'blocks',v_blocks,'events',v_events,'reentry_policy',coalesce(v_program,'{}'::jsonb),'audit_purpose','Prevenção de abuso de bônus de reentrada, segurança e auditoria do programa.');
end;$function$;
revoke all on function public.get_loyalty_blocks_and_reentry_safe(uuid,integer) from public,anon;
grant execute on function public.get_loyalty_blocks_and_reentry_safe(uuid,integer) to authenticated,service_role;

create or replace function public.get_admin_customer_loyalty_membership_safe(p_store_id uuid,p_customer_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_block record; begin
  if auth.uid() is null or not (public.app_is_store_owner(p_store_id) or public.user_has_store_permission_v2(p_store_id,'loyalty.view') or public.user_has_store_permission_v2(p_store_id,'loyalty.manage')) then return jsonb_build_object('ok',false,'error','access_denied'); end if;
  select b.id,b.reason,b.blocked_at,b.cpf_last4 into v_block from public.fidelity_membership_blocks b where b.store_id=p_store_id and b.customer_id=p_customer_id and b.unblocked_at is null order by b.blocked_at desc limit 1;
  return jsonb_build_object('ok',true,'blocked',v_block.id is not null,'reason',v_block.reason,'blocked_at',v_block.blocked_at,'cpf_last4',v_block.cpf_last4);
end;$function$;
revoke all on function public.get_admin_customer_loyalty_membership_safe(uuid,uuid) from public,anon;
grant execute on function public.get_admin_customer_loyalty_membership_safe(uuid,uuid) to authenticated,service_role;

create or replace function public.admin_set_customer_loyalty_membership_safe(p_store_id uuid,p_customer_id uuid,p_action text,p_reason text default null)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_action text:=lower(trim(coalesce(p_action,''))); v_customer public.customers%rowtype; v_hash text; v_user uuid:=auth.uid(); v_result jsonb:='{}'::jsonb; begin
  if p_store_id is null or p_customer_id is null then return jsonb_build_object('ok',false,'error','missing_parameters'); end if;
  if v_user is null or not (public.app_is_store_owner(p_store_id) or public.user_has_store_permission_v2(p_store_id,'loyalty.manage')) then return jsonb_build_object('ok',false,'error','access_denied'); end if;
  select * into v_customer from public.customers where id=p_customer_id and store_id=p_store_id for update;
  if not found then return jsonb_build_object('ok',false,'error','customer_not_found'); end if;
  if v_action='remove' then
    perform public.record_loyalty_exit_audit_internal(p_store_id,p_customer_id,'admin_remove',p_reason);
    v_result:=public.purge_customer_loyalty_data_internal(p_store_id,p_customer_id);
    return coalesce(v_result,'{}'::jsonb)||jsonb_build_object('ok',true,'membership','removed','can_rejoin',true);
  end if;
  if v_action='ban' then
    if length(regexp_replace(coalesce(v_customer.cpf,''),'\D','','g'))<>11 then return jsonb_build_object('ok',false,'error','cpf_required_for_ban'); end if;
    if length(trim(coalesce(p_reason,'')))<3 then return jsonb_build_object('ok',false,'error','reason_required'); end if;
    v_hash:=public.fidelity_cpf_hash(p_store_id,v_customer.cpf);
    perform public.record_loyalty_exit_audit_internal(p_store_id,p_customer_id,'ban',p_reason);
    v_result:=public.purge_customer_loyalty_data_internal(p_store_id,p_customer_id);
    insert into public.fidelity_membership_blocks(store_id,customer_id,cpf_hash,cpf_last4,reason,blocked_by,metadata)
    values(p_store_id,p_customer_id,v_hash,right(regexp_replace(v_customer.cpf,'\D','','g'),4),trim(p_reason),v_user,jsonb_build_object('source','admin_loyalty_membership'))
    on conflict (store_id,cpf_hash) where unblocked_at is null do update set customer_id=excluded.customer_id,reason=excluded.reason,blocked_by=excluded.blocked_by,blocked_at=clock_timestamp(),metadata=excluded.metadata;
    return coalesce(v_result,'{}'::jsonb)||jsonb_build_object('ok',true,'membership','banned','can_rejoin',false);
  end if;
  if v_action='unban' then
    if length(regexp_replace(coalesce(v_customer.cpf,''),'\D','','g'))=11 then
      v_hash:=public.fidelity_cpf_hash(p_store_id,v_customer.cpf);
      update public.fidelity_membership_blocks set unblocked_at=clock_timestamp(),unblocked_by=v_user where store_id=p_store_id and unblocked_at is null and (customer_id=p_customer_id or cpf_hash=v_hash);
    else
      update public.fidelity_membership_blocks set unblocked_at=clock_timestamp(),unblocked_by=v_user where store_id=p_store_id and unblocked_at is null and customer_id=p_customer_id;
    end if;
    perform public.record_loyalty_exit_audit_internal(p_store_id,p_customer_id,'unban',p_reason);
    return jsonb_build_object('ok',true,'membership','unbanned','can_rejoin',true);
  end if;
  return jsonb_build_object('ok',false,'error','invalid_action');
end;$function$;
revoke all on function public.admin_set_customer_loyalty_membership_safe(uuid,uuid,text,text) from public,anon;
grant execute on function public.admin_set_customer_loyalty_membership_safe(uuid,uuid,text,text) to authenticated,service_role;

create or replace function public.upsert_customer_benefit_rule_safe(
 p_store_id uuid,p_rule_id uuid default null,p_code text default null,p_name text default null,p_description text default null,
 p_benefit_type text default 'discount_percent',p_target_type text default 'all',p_target_tier_id uuid default null,p_target_customer_id uuid default null,p_target_tag text default null,
 p_discount_percent numeric default null,p_discount_amount numeric default null,p_bonus_points integer default null,p_free_delivery boolean default false,p_minimum_order_value numeric default 0,
 p_max_uses_total integer default null,p_max_uses_per_customer integer default null,p_active boolean default true,p_starts_at timestamptz default null,p_ends_at timestamptz default null,
 p_conditions jsonb default '{}'::jsonb,p_metadata jsonb default '{}'::jsonb
)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp'
as $function$
begin
  if auth.uid() is null or not (public.app_is_store_owner(p_store_id) or public.user_has_store_permission_v2(p_store_id,'loyalty.manage')) then return jsonb_build_object('ok',false,'error','access_denied'); end if;
  return public.upsert_customer_benefit_rule_safe_internal_0d(p_store_id,p_rule_id,p_code,p_name,p_description,p_benefit_type,p_target_type,p_target_tier_id,p_target_customer_id,p_target_tag,p_discount_percent,p_discount_amount,p_bonus_points,p_free_delivery,p_minimum_order_value,p_max_uses_total,p_max_uses_per_customer,p_active,p_starts_at,p_ends_at,p_conditions,p_metadata);
end;$function$;
revoke all on function public.upsert_customer_benefit_rule_safe(uuid,uuid,text,text,text,text,text,uuid,uuid,text,numeric,numeric,integer,boolean,numeric,integer,integer,boolean,timestamptz,timestamptz,jsonb,jsonb) from public,anon;
grant execute on function public.upsert_customer_benefit_rule_safe(uuid,uuid,text,text,text,text,text,uuid,uuid,text,numeric,numeric,integer,boolean,numeric,integer,integer,boolean,timestamptz,timestamptz,jsonb,jsonb) to authenticated,service_role;

create or replace function public.upsert_loyalty_reward_safe(p_store_id uuid,p_reward_id uuid default null,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp'
as $function$
declare v_program_id uuid; v_id uuid; v_product_id uuid; begin
  if auth.uid() is null or not (public.app_is_store_owner(p_store_id) or public.user_has_store_permission_v2(p_store_id,'loyalty.manage')) then return jsonb_build_object('ok',false,'error','access_denied'); end if;
  select id into v_program_id from public.fidelity_programs where store_id=p_store_id order by updated_at desc limit 1;
  if v_program_id is null then return jsonb_build_object('ok',false,'error','loyalty_program_not_found'); end if;
  if p_reward_id is null and length(trim(coalesce(p_payload->>'title','')))=0 then return jsonb_build_object('ok',false,'error','reward_title_required'); end if;
  v_product_id:=nullif(p_payload->>'product_id','')::uuid;
  if v_product_id is not null and not exists(select 1 from public.products where id=v_product_id and store_id=p_store_id) then return jsonb_build_object('ok',false,'error','product_not_found'); end if;
  if p_reward_id is null then
    insert into public.fidelity_rewards(program_id,title,description,points_cost,type,discount_amount,max_redemptions_per_customer,is_active,stock_quantity,voucher_validity_days,image_url,additional_cash_cost,offer_valid_until,product_id,product_quantity,discount_percentage,max_discount_value,min_order_value)
    values(v_program_id,trim(coalesce(p_payload->>'title','')),nullif(p_payload->>'description',''),greatest(coalesce((p_payload->>'points_cost')::integer,0),0),coalesce(nullif(p_payload->>'type',''),'product'),nullif(p_payload->>'discount_amount','')::numeric,nullif(p_payload->>'max_redemptions_per_customer','')::integer,coalesce((p_payload->>'is_active')::boolean,true),nullif(p_payload->>'stock_quantity','')::integer,coalesce(nullif(p_payload->>'voucher_validity_days','')::integer,15),nullif(p_payload->>'image_url',''),coalesce(nullif(p_payload->>'additional_cash_cost','')::numeric,0),nullif(p_payload->>'offer_valid_until','')::timestamptz,v_product_id,coalesce(nullif(p_payload->>'product_quantity','')::integer,1),nullif(p_payload->>'discount_percentage','')::numeric,nullif(p_payload->>'max_discount_value','')::numeric,nullif(p_payload->>'min_order_value','')::numeric)
    returning id into v_id;
  else
    update public.fidelity_rewards set
      title=case when p_payload?'title' then trim(coalesce(p_payload->>'title',title)) else title end,
      description=case when p_payload?'description' then nullif(p_payload->>'description','') else description end,
      points_cost=case when p_payload?'points_cost' then greatest(coalesce((p_payload->>'points_cost')::integer,0),0) else points_cost end,
      type=case when p_payload?'type' then coalesce(nullif(p_payload->>'type',''),type) else type end,
      discount_amount=case when p_payload?'discount_amount' then nullif(p_payload->>'discount_amount','')::numeric else discount_amount end,
      max_redemptions_per_customer=case when p_payload?'max_redemptions_per_customer' then nullif(p_payload->>'max_redemptions_per_customer','')::integer else max_redemptions_per_customer end,
      is_active=case when p_payload?'is_active' then coalesce((p_payload->>'is_active')::boolean,is_active) else is_active end,
      stock_quantity=case when p_payload?'stock_quantity' then nullif(p_payload->>'stock_quantity','')::integer else stock_quantity end,
      voucher_validity_days=case when p_payload?'voucher_validity_days' then coalesce(nullif(p_payload->>'voucher_validity_days','')::integer,voucher_validity_days) else voucher_validity_days end,
      image_url=case when p_payload?'image_url' then nullif(p_payload->>'image_url','') else image_url end,
      additional_cash_cost=case when p_payload?'additional_cash_cost' then coalesce(nullif(p_payload->>'additional_cash_cost','')::numeric,0) else additional_cash_cost end,
      offer_valid_until=case when p_payload?'offer_valid_until' then nullif(p_payload->>'offer_valid_until','')::timestamptz else offer_valid_until end,
      product_id=case when p_payload?'product_id' then v_product_id else product_id end,
      product_quantity=case when p_payload?'product_quantity' then coalesce(nullif(p_payload->>'product_quantity','')::integer,1) else product_quantity end,
      discount_percentage=case when p_payload?'discount_percentage' then nullif(p_payload->>'discount_percentage','')::numeric else discount_percentage end,
      max_discount_value=case when p_payload?'max_discount_value' then nullif(p_payload->>'max_discount_value','')::numeric else max_discount_value end,
      min_order_value=case when p_payload?'min_order_value' then nullif(p_payload->>'min_order_value','')::numeric else min_order_value end
    where id=p_reward_id and program_id=v_program_id returning id into v_id;
    if v_id is null then return jsonb_build_object('ok',false,'error','reward_not_found'); end if;
  end if;
  return jsonb_build_object('ok',true,'reward_id',v_id);
exception when invalid_text_representation or check_violation then return jsonb_build_object('ok',false,'error','invalid_reward','message',sqlerrm);
end;$function$;
revoke all on function public.upsert_loyalty_reward_safe(uuid,uuid,jsonb) from public,anon;
grant execute on function public.upsert_loyalty_reward_safe(uuid,uuid,jsonb) to authenticated,service_role;

create or replace function public.delete_loyalty_reward_safe(p_store_id uuid,p_reward_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp'
as $function$
declare v_program_id uuid; begin
  if auth.uid() is null or not (public.app_is_store_owner(p_store_id) or public.user_has_store_permission_v2(p_store_id,'loyalty.manage')) then return jsonb_build_object('ok',false,'error','access_denied'); end if;
  select id into v_program_id from public.fidelity_programs where store_id=p_store_id order by updated_at desc limit 1;
  if exists(select 1 from public.fidelity_vouchers where store_id=p_store_id and reward_id=p_reward_id) then return jsonb_build_object('ok',false,'error','reward_in_use','message','O prêmio possui vouchers vinculados. Desative-o em vez de excluir.'); end if;
  delete from public.fidelity_rewards where id=p_reward_id and program_id=v_program_id;
  if not found then return jsonb_build_object('ok',false,'error','reward_not_found'); end if;
  return jsonb_build_object('ok',true);
end;$function$;
revoke all on function public.delete_loyalty_reward_safe(uuid,uuid) from public,anon;
grant execute on function public.delete_loyalty_reward_safe(uuid,uuid) to authenticated,service_role;

create or replace function public.get_loyalty_reward_products_safe(p_store_id uuid,p_limit integer default 250)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_rows jsonb; begin
  if auth.uid() is null or not (public.app_is_store_owner(p_store_id) or public.user_has_store_permission_v2(p_store_id,'loyalty.view') or public.user_has_store_permission_v2(p_store_id,'loyalty.manage')) then return jsonb_build_object('ok',false,'error','access_denied'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'price',p.price) order by p.name),'[]'::jsonb) into v_rows
  from (select * from public.products where store_id=p_store_id and coalesce(active,true)=true order by name limit least(greatest(coalesce(p_limit,250),1),500)) p;
  return jsonb_build_object('ok',true,'products',v_rows);
end;$function$;
revoke all on function public.get_loyalty_reward_products_safe(uuid,integer) from public,anon;
grant execute on function public.get_loyalty_reward_products_safe(uuid,integer) to authenticated,service_role;