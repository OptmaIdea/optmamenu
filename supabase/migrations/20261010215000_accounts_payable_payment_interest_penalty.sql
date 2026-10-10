insert into public.cashbook_account_plan
(code,display_code,name,kind,description,affects_cash_drawer,affects_financial_result,is_transfer,active,sort_order,parent_code,level,path,is_group,is_postable,nature,analysis_enabled,metadata)
values
('late_payment_interest','2.6.4','Juros por atraso em pagamentos','expense','Encargos por atraso na quitação de obrigações. Não são juros de empréstimo.',false,true,false,true,2640,'grp_expense_financial',3,'2/2.6/2.6.4',false,true,'debit',true,'{"source":"accounts_payable_payment"}'::jsonb),
('late_payment_penalty','2.6.5','Multas por atraso em pagamentos','expense','Multas por atraso na quitação de obrigações.',false,true,false,true,2650,'grp_expense_financial',3,'2/2.6/2.6.5',false,true,'debit',true,'{"source":"accounts_payable_payment"}'::jsonb)
on conflict (code) do nothing;

create or replace function public.register_accounts_payable_payment_with_charges_safe(
 p_installment_id uuid,p_amount numeric,p_financial_account_id uuid,p_payment_method_code text,
 p_paid_at timestamptz default now(),p_reference text default null,p_notes text default null,
 p_interest numeric default 0,p_penalty numeric default 0
) returns jsonb language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare v_result jsonb; v_payment public.accounts_payable_payments%rowtype;
v_account public.store_financial_accounts%rowtype; v_amount numeric; v_fee record;
begin
 if p_interest is null or p_penalty is null or p_interest<0 or p_penalty<0
    or round(p_interest,2)<>p_interest or round(p_penalty,2)<>p_penalty then
   raise exception 'Multa e juros devem ser positivos ou zero, com até duas casas decimais.';
 end if;
 -- The existing safe RPC retains all permission, installment, and account checks.
 v_result:=public.register_accounts_payable_payment_safe(
   p_installment_id,p_amount,p_financial_account_id,p_payment_method_code,
   p_paid_at,p_reference,p_notes
 );
 if coalesce(p_interest,0)=0 and coalesce(p_penalty,0)=0 then return v_result; end if;
 select * into strict v_payment from public.accounts_payable_payments
 where installment_id=p_installment_id and financial_account_id=p_financial_account_id
   and created_by=auth.uid() and amount=round(p_amount,2) and status='confirmed'
 order by created_at desc,id desc limit 1;
 select * into strict v_account from public.store_financial_accounts
 where id=p_financial_account_id and store_id=v_payment.store_id and active=true;
 for v_fee in select 'late_payment_interest'::text as code,round(p_interest,2) as amount,'Juros por atraso'::text as label
              union all select 'late_payment_penalty',round(p_penalty,2),'Multa por atraso'
 loop
   if v_fee.amount>0 then
     insert into public.cashbook_entries
       (store_id,entry_code,entry_date,occurred_at,type,direction,amount,description,notes,
        payment_method,payment_method_code,source,source_id,status,affects_balance,metadata,
        created_by,source_financial_account_id,is_transfer,affects_cash_drawer,
        affects_financial_result,account_plan_code)
     values
       (v_payment.store_id,'APF-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,20)),
        timezone('America/Sao_Paulo',coalesce(p_paid_at,now()))::date,coalesce(p_paid_at,now()),
        'manual_expense','out',v_fee.amount,v_fee.label||' · parcela '||v_payment.installment_id::text,
        nullif(trim(coalesce(p_notes,'')),''),
        p_payment_method_code,p_payment_method_code,'accounts_payable_charges',v_payment.id,
        'confirmed',true,
        jsonb_build_object('accounts_payable_id',v_payment.accounts_payable_id,
                           'installment_id',v_payment.installment_id,
                           'payment_id',v_payment.id,'account_plan_code',v_fee.code,
                           'financial_charge',true,'source_financial_account_code',v_account.code),
        auth.uid(),p_financial_account_id,false,v_account.account_type='cash_drawer',true,v_fee.code);
   end if;
 end loop;
 perform public._accounts_payable_add_event(
    v_payment.store_id,v_payment.accounts_payable_id,'payment_charges_registered',
    'Encargos da liquidação registrados',
    'Juros: '||round(p_interest,2)::text||' · Multa: '||round(p_penalty,2)::text,
    null,jsonb_build_object('payment_id',v_payment.id,'interest',p_interest,'penalty',p_penalty),
    '{}'::jsonb
 );
 return public.get_accounts_payable_detail_safe(v_payment.accounts_payable_id);
end $$;
revoke all on function public.register_accounts_payable_payment_with_charges_safe(uuid,numeric,uuid,text,timestamptz,text,text,numeric,numeric) from public;
grant execute on function public.register_accounts_payable_payment_with_charges_safe(uuid,numeric,uuid,text,timestamptz,text,text,numeric,numeric) to authenticated;