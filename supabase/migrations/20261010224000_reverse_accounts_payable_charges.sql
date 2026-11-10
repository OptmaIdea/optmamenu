CREATE OR REPLACE FUNCTION public.reverse_accounts_payable_payment_safe(p_payment_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ declare v_pay public.accounts_payable_payments%rowtype; v_p public.accounts_payable%rowtype; v_entry_id uuid; v_charge public.cashbook_entries%rowtype; begin if auth.uid() is null then raise exception 'Sessão inválida.'; end if; if nullif(btrim(p_reason),'') is null then raise exception 'Informe o motivo do estorno.'; end if; select * into v_pay from public.accounts_payable_payments where id=p_payment_id for update; if v_pay.id is null then raise exception 'Pagamento não encontrado.'; end if; select * into v_p from public.accounts_payable where id=v_pay.accounts_payable_id for update; if not (public.app_is_store_owner(v_p.store_id) or public.user_has_store_permission(v_p.store_id,'accounts_payable.reverse_payment')) then raise exception 'Sem permissão para estornar pagamento.'; end if; if v_pay.status='reversed' then raise exception 'Pagamento já estornado.'; end if; insert into public.cashbook_entries(store_id,entry_code,entry_date,occurred_at,type,direction,amount,description,notes,payment_method,payment_method_code,source,source_id,status,affects_balance,metadata,created_by,destination_financial_account_id,is_transfer) values(v_p.store_id,'APE-'||to_char(timezone('America/Sao_Paulo',now()),'YYYYMMDD-HH24MISS')||'-'||upper(substr(replace(v_pay.id::text,'-',''),1,6)),timezone('America/Sao_Paulo',now())::date,now(),'adjustment','in',v_pay.amount,'Estorno de pagamento '||v_p.payable_code,btrim(p_reason),v_pay.payment_method_code,v_pay.payment_method_code,'accounts_payable_reversal',v_pay.id,'confirmed',true,jsonb_build_object('accounts_payable_id',v_p.id,'payment_id',v_pay.id,'reversal_reason',btrim(p_reason)),auth.uid(),v_pay.financial_account_id,false) returning id into v_entry_id; update public.accounts_payable_payments set status='reversed',reversed_by=auth.uid(),reversed_at=now(),reversal_reason=btrim(p_reason),reversal_cashbook_entry_id=v_entry_id where id=v_pay.id; for v_charge in
  select * from public.cashbook_entries
  where source='accounts_payable_charges' and source_id=v_pay.id and status='confirmed'
 loop
  insert into public.cashbook_entries
    (store_id,entry_code,entry_date,occurred_at,type,direction,amount,description,notes,
     payment_method,payment_method_code,source,source_id,status,affects_balance,metadata,
     created_by,destination_financial_account_id,is_transfer,affects_cash_drawer,
     affects_financial_result,account_plan_code)
  values
    (v_p.store_id,'APFR-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,20)),
     timezone('America/Sao_Paulo',now())::date,now(),'adjustment','in',v_charge.amount,
     'Estorno de '||v_charge.description,btrim(p_reason),v_pay.payment_method_code,
     v_pay.payment_method_code,'accounts_payable_charges_reversal',v_pay.id,
     'confirmed',true,jsonb_build_object('original_charge_entry_id',v_charge.id,
      'payment_id',v_pay.id,'accounts_payable_id',v_p.id,'reversal_reason',btrim(p_reason),
      'account_plan_code',v_charge.account_plan_code),auth.uid(),v_pay.financial_account_id,
     false,v_charge.affects_cash_drawer,true,v_charge.account_plan_code);
 end loop;
 perform public._recalculate_accounts_payable(v_p.id); perform public._accounts_payable_add_event(v_p.store_id,v_p.id,'payment_reversed','Pagamento estornado',btrim(p_reason),to_jsonb(v_pay),jsonb_build_object('status','reversed','reversal_cashbook_entry_id',v_entry_id),'{}'::jsonb); return public.get_accounts_payable_detail_safe(v_p.id); end $function$;