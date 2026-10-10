
update public.store_financial_accounts
set name='Caixa Loja Centro',is_default=true,is_sales_clearing_default=true,sort_order=10,active=true,
 metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('workspace_role','primary','primary_general_account',true,'cash_balance_visible',true,'simplified_financial_workspace',true),
 updated_at=now()
where id='970af23c-6c8a-478d-83b1-7415f0deac32'::uuid and store_id='0abba741-0f77-4783-8cf8-58811cf7343b'::uuid;

update public.store_financial_accounts
set name='Retaguarda do caixa',is_default=false,is_sales_clearing_default=false,sort_order=30,active=true,
 metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('workspace_role','cash_backoffice','sangria_destination',true,'simplified_financial_workspace',true),
 updated_at=now()
where id='558c94f0-3080-4236-a975-83e90cfaf71d'::uuid and store_id='0abba741-0f77-4783-8cf8-58811cf7343b'::uuid;

update public.store_financial_accounts
set name='OptmaPay',is_default=true,is_sales_clearing_default=false,sort_order=20,active=true,
 metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
 'workspace_role','bank','external_provider','optmapay','external_account_id','afce3a88-8309-4feb-8fa7-8b07d9f22150',
 'overdraft_limit',5000.00,'allow_negative_balance',true,'opening_balance_reconstructed',14798.71,
 'opening_balance_reference_at','2026-09-27T21:21:51.176201-03:00','simplified_financial_workspace',true),
 updated_at=now()
where id='9dfcc39b-67ec-46ce-9eb3-79339e9da943'::uuid and store_id='0abba741-0f77-4783-8cf8-58811cf7343b'::uuid;

update public.store_financial_accounts
set name='Compensação OptmaPay (interno)',is_default=false,is_sales_clearing_default=false,sort_order=900,active=true,
 metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('hidden_from_workspace',true,'internal_clearing',true,'workspace_role','internal','provider_code','optma_sandbox'),
 updated_at=now()
where id='921d8cc1-b29d-4d97-99b2-4c33bb6b427b'::uuid and store_id='0abba741-0f77-4783-8cf8-58811cf7343b'::uuid;

select public.set_financial_account_routing_safe(
 '0abba741-0f77-4783-8cf8-58811cf7343b'::uuid,
 '970af23c-6c8a-478d-83b1-7415f0deac32'::uuid,
 array(select code from public.store_payment_methods where store_id='0abba741-0f77-4783-8cf8-58811cf7343b'::uuid),true);

select public.set_financial_account_routing_safe(
 '0abba741-0f77-4783-8cf8-58811cf7343b'::uuid,
 '558c94f0-3080-4236-a975-83e90cfaf71d'::uuid,array['cash']::text[],false);

select public.set_financial_account_routing_safe(
 '0abba741-0f77-4783-8cf8-58811cf7343b'::uuid,
 '9dfcc39b-67ec-46ce-9eb3-79339e9da943'::uuid,
 array['pix','pix_manual_qr','debit_card','credit_card','payment_link','boleto','bank_transfer','account_debit']::text[],false);

select public.set_financial_account_routing_safe(
 '0abba741-0f77-4783-8cf8-58811cf7343b'::uuid,
 '921d8cc1-b29d-4d97-99b2-4c33bb6b427b'::uuid,array['debit_card','credit_card']::text[],false);

update public.store_payment_methods
set preferred_financial_account_id='970af23c-6c8a-478d-83b1-7415f0deac32'::uuid,updated_at=now()
where store_id='0abba741-0f77-4783-8cf8-58811cf7343b'::uuid and affects_cashbook=true and code<>'debit_card_debito_infinitepay';

update public.store_payment_methods
set active=false,public_enabled=false,preferred_financial_account_id=null,
 metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('legacy_removed',true,'legacy_removed_at',now(),'legacy_reason','Consolidação das contas financeiras'),
 updated_at=now()
where store_id='0abba741-0f77-4783-8cf8-58811cf7343b'::uuid and code='debit_card_debito_infinitepay';

do $reassign$
declare v_old uuid; v_ids uuid[]; v_result jsonb;
begin
 foreach v_old in array array[
 '931885dc-15f5-473d-acb1-15801c8a9e87'::uuid,
 'bc93ea57-daf4-4070-8b30-41540c0646b4'::uuid,
 '8c5f6e25-023c-43a0-be3e-70969eb550b9'::uuid,
 '94af6845-7040-409c-a67c-8cd86a6b48d5'::uuid,
 '1a9746a2-23c1-4266-9dd7-4b84cca5da54'::uuid,
 'b5764b15-f5c6-4097-b252-fc6e5426405e'::uuid,
 '0cd8b86d-1424-4894-88a4-65067a1c0305'::uuid,
 '9e2960c8-2d4f-44b5-873e-1cf9a35b930b'::uuid
 ] loop
   select array_agg(id order by occurred_at,id) into v_ids
   from public.cashbook_entries
   where store_id='0abba741-0f77-4783-8cf8-58811cf7343b'::uuid
     and status='confirmed' and affects_balance=true
     and (source_financial_account_id=v_old or destination_financial_account_id=v_old);
   if coalesce(cardinality(v_ids),0)>0 then
     v_result:=public.reassign_financial_account_movements_bulk_safe(
       '0abba741-0f77-4783-8cf8-58811cf7343b'::uuid,v_old,'970af23c-6c8a-478d-83b1-7415f0deac32'::uuid,v_ids,
       'Consolidação financeira da Gelinhares em Caixa Loja Centro');
     if coalesce((v_result->>'ok')::boolean,false) is not true then raise exception 'Falha: %',v_result; end if;
   end if;
 end loop;
end;
$reassign$;

update public.store_financial_accounts
set active=false,is_default=false,is_sales_clearing_default=false,
 metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('hidden_from_workspace',true,'legacy_consolidated',true,'consolidated_into','970af23c-6c8a-478d-83b1-7415f0deac32','consolidated_at',now()),
 updated_at=now()
where store_id='0abba741-0f77-4783-8cf8-58811cf7343b'::uuid and id in (
 '931885dc-15f5-473d-acb1-15801c8a9e87'::uuid,'bc93ea57-daf4-4070-8b30-41540c0646b4'::uuid,
 '8c5f6e25-023c-43a0-be3e-70969eb550b9'::uuid,'94af6845-7040-409c-a67c-8cd86a6b48d5'::uuid,
 '1a9746a2-23c1-4266-9dd7-4b84cca5da54'::uuid,'b5764b15-f5c6-4097-b252-fc6e5426405e'::uuid,
 '0cd8b86d-1424-4894-88a4-65067a1c0305'::uuid,'9e2960c8-2d4f-44b5-873e-1cf9a35b930b'::uuid);

insert into public.cashbook_account_plan(
 code,name,kind,description,affects_cash_drawer,affects_financial_result,is_transfer,active,sort_order,metadata,
 display_code,parent_code,level,path,is_group,is_postable,nature,analysis_enabled
) values (
 'bank_account_fees','Tarifas e manutenção bancária','expense',
 'Tarifas de manutenção, encargos e custos cobrados diretamente pelas contas bancárias.',
 false,true,false,true,2630,jsonb_build_object('system_account',true,'financial_expense',true),
 '2.6.3','grp_expense_financial',3,'2/2.6/2.6.3',false,true,'debit',true
)
on conflict(code) do update set name=excluded.name,description=excluded.description,active=true,sort_order=excluded.sort_order,
 display_code=excluded.display_code,parent_code=excluded.parent_code,level=excluded.level,path=excluded.path,
 is_group=false,is_postable=true,nature='debit',affects_financial_result=true,is_transfer=false,updated_at=now();

insert into public.cashbook_entries(
 store_id,entry_code,entry_date,occurred_at,type,direction,amount,description,payment_method,payment_method_code,
 source,source_id,status,affects_balance,account_plan_code,destination_financial_account_id,is_transfer,
 affects_cash_drawer,affects_financial_result,metadata,created_by
)
select '0abba741-0f77-4783-8cf8-58811cf7343b'::uuid,public.generate_cashbook_entry_code(),'2026-09-27'::date,
 '2026-09-27 21:21:51.176201-03'::timestamptz,'adjustment','in',14798.71,'Saldo acumulado inicial — OptmaPay',
 'Transferência bancária','bank_transfer','financial_account_opening_balance',null,'confirmed',true,'positive_adjustment',
 '9dfcc39b-67ec-46ce-9eb3-79339e9da943'::uuid,false,false,false,
 jsonb_build_object('opening_balance',true,'reconstructed_from_external_account',true,'external_provider','optmapay',
 'external_account_id','afce3a88-8309-4feb-8fa7-8b07d9f22150','external_balance_at_account_creation',14798.71,
 'reconstruction_reference_at','2026-09-27T21:21:51.176201-03:00'),null
where not exists (
 select 1 from public.cashbook_entries where store_id='0abba741-0f77-4783-8cf8-58811cf7343b'::uuid
 and destination_financial_account_id='9dfcc39b-67ec-46ce-9eb3-79339e9da943'::uuid and metadata->>'opening_balance'='true');

insert into public.cashbook_entries(
 store_id,entry_code,entry_date,occurred_at,type,direction,amount,description,payment_method,payment_method_code,
 source,source_id,status,affects_balance,account_plan_code,source_financial_account_id,is_transfer,
 affects_cash_drawer,affects_financial_result,metadata,created_by
)
select '0abba741-0f77-4783-8cf8-58811cf7343b'::uuid,public.generate_cashbook_entry_code(),'2026-10-01'::date,
 '2026-10-01 00:05:00-03'::timestamptz,'manual_expense','out',12.99,'Tarifa mensal OptmaPay — outubro/2026',
 'Transferência bancária','bank_transfer','optmapay_account_fee_sync',null,'confirmed',true,'bank_account_fees',
 '9dfcc39b-67ec-46ce-9eb3-79339e9da943'::uuid,false,false,true,
 jsonb_build_object('external_provider','optmapay','external_account_id','afce3a88-8309-4feb-8fa7-8b07d9f22150',
 'external_reference','ACCOUNT-CHARGE:pj_monthly_maintenance:2026-10-01','charge_code','pj_monthly_maintenance','sandbox_simulation',true),null
where not exists (
 select 1 from public.cashbook_entries where store_id='0abba741-0f77-4783-8cf8-58811cf7343b'::uuid
 and metadata->>'external_reference'='ACCOUNT-CHARGE:pj_monthly_maintenance:2026-10-01');

CREATE OR REPLACE FUNCTION public.get_financial_account_balances_safe(p_store_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
declare
  v_items jsonb := '[]'::jsonb;
  v_unallocated jsonb := '{}'::jsonb;
  v_payment_methods jsonb := '[]'::jsonb;
  v_book_balance numeric := 0;
  v_allocated_balance numeric := 0;
  v_can_manage boolean := false;
begin
  if p_store_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_store_id');
  end if;

  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    if auth.uid() is null or not (
      public.app_is_store_owner(p_store_id)
      or public.user_has_store_permission_v2(p_store_id, 'financial.accounts.view')
      or public.user_has_store_permission_v2(p_store_id, 'cashbook.view')
    ) then
      return jsonb_build_object('ok', false, 'error', 'access_denied');
    end if;
  end if;

  v_can_manage := case
    when coalesce(auth.role(), '') not in ('anon', 'authenticated') then true
    else public.app_is_store_owner(p_store_id)
      or public.user_has_store_permission_v2(p_store_id, 'financial.accounts.manage')
      or public.user_has_store_permission_v2(p_store_id, 'financial.manage')
      or public.user_has_store_permission_v2(p_store_id, 'cashbook.create')
  end;

  select coalesce(jsonb_agg(jsonb_build_object(
    'code', pm.code,
    'base_code', coalesce(pm.base_code, pm.code),
    'name', pm.name,
    'affects_cashbook', pm.affects_cashbook,
    'preferred_financial_account_id', pm.preferred_financial_account_id
  ) order by pm.sort_order, pm.name), '[]'::jsonb)
  into v_payment_methods
  from public.store_payment_methods pm
  where pm.store_id = p_store_id
    and pm.active = true
    and pm.code <> 'pending'
    and pm.affects_cashbook = true;

  with eligible as (
    select e.*
    from public.cashbook_entries e
    where e.store_id = p_store_id
      and e.status = 'confirmed'
      and e.affects_balance = true
  ), movements as (
    select e.source_financial_account_id as account_id,
           coalesce(nullif(e.payment_method_code, ''), nullif(e.payment_method, ''), 'other') as payment_method_code,
           -e.amount::numeric as signed_amount,
           0::numeric as inflow,
           e.amount::numeric as outflow,
           e.occurred_at
    from eligible e
    where e.source_financial_account_id is not null
    union all
    select e.destination_financial_account_id as account_id,
           coalesce(nullif(e.payment_method_code, ''), nullif(e.payment_method, ''), 'other') as payment_method_code,
           e.amount::numeric as signed_amount,
           e.amount::numeric as inflow,
           0::numeric as outflow,
           e.occurred_at
    from eligible e
    where e.destination_financial_account_id is not null
  ), method_totals as (
    select m.account_id, m.payment_method_code,
           sum(m.signed_amount)::numeric as balance,
           sum(m.inflow)::numeric as inflows,
           sum(m.outflow)::numeric as outflows,
           count(*)::bigint as movement_count
    from movements m
    group by m.account_id, m.payment_method_code
  ), per_account as (
    select a.id, a.store_id, a.code, a.name, a.account_type, a.description,
           a.active, a.is_default, a.is_sales_clearing_default, a.sort_order,
           a.created_at, a.updated_at, a.metadata,
           coalesce(sum(m.signed_amount), 0)::numeric as balance,
           coalesce(sum(m.inflow), 0)::numeric as inflows,
           coalesce(sum(m.outflow), 0)::numeric as outflows,
           count(m.account_id)::bigint as movement_count,
           max(m.occurred_at) as last_movement_at,
           coalesce((
             select jsonb_agg(apm.payment_method_code order by pm.sort_order, apm.payment_method_code)
             from public.store_financial_account_payment_methods apm
             left join public.store_payment_methods pm
               on pm.store_id = apm.store_id and pm.code = apm.payment_method_code
             where apm.store_id = p_store_id
               and apm.account_id = a.id
               and apm.active = true
           ), '[]'::jsonb) as accepted_payment_methods,
           coalesce((
             select jsonb_agg(jsonb_build_object(
               'payment_method_code', mt.payment_method_code,
               'balance', mt.balance,
               'inflows', mt.inflows,
               'outflows', mt.outflows,
               'movement_count', mt.movement_count
             ) order by mt.payment_method_code)
             from method_totals mt
             where mt.account_id = a.id
           ), '[]'::jsonb) as payment_breakdown
    from public.store_financial_accounts a
    left join movements m on m.account_id = a.id
    where a.store_id = p_store_id
    group by a.id
  )
  select coalesce(jsonb_agg(to_jsonb(pa) order by pa.active desc, pa.sort_order, pa.name), '[]'::jsonb),
         coalesce(sum(pa.balance), 0)
  into v_items, v_allocated_balance
  from per_account pa;

  select coalesce(sum(
    case
      when e.is_transfer then 0
      when e.direction = 'in' then e.amount
      when e.direction = 'out' then -e.amount
      else 0
    end
  ), 0)::numeric
  into v_book_balance
  from public.cashbook_entries e
  where e.store_id = p_store_id
    and e.status = 'confirmed'
    and e.affects_balance = true;

  select jsonb_build_object(
    'count', count(*)::bigint,
    'inflows', coalesce(sum(case when e.direction = 'in' then e.amount else 0 end), 0)::numeric,
    'outflows', coalesce(sum(case when e.direction = 'out' then e.amount else 0 end), 0)::numeric,
    'balance', coalesce(sum(case when e.direction = 'in' then e.amount when e.direction = 'out' then -e.amount else 0 end), 0)::numeric
  )
  into v_unallocated
  from public.cashbook_entries e
  where e.store_id = p_store_id
    and e.status = 'confirmed'
    and e.affects_balance = true
    and (
      (coalesce(e.is_transfer, false) = false and e.direction = 'in' and e.destination_financial_account_id is null)
      or (coalesce(e.is_transfer, false) = false and e.direction = 'out' and e.source_financial_account_id is null)
      or (coalesce(e.is_transfer, false) = true and (e.source_financial_account_id is null or e.destination_financial_account_id is null))
    );

  return jsonb_build_object(
    'ok', true,
    'can_manage', v_can_manage,
    'accounts', v_items,
    'payment_methods', v_payment_methods,
    'summary', jsonb_build_object(
      'book_balance', v_book_balance,
      'allocated_balance', v_allocated_balance,
      'unallocated_balance', v_book_balance - v_allocated_balance
    ),
    'unallocated', v_unallocated
  );
end;
$function$;
