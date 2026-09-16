-- Bloco 1 — RPCs seguras e integração Cotação -> Compra -> Contas a Pagar.

create or replace function public._purchase_payment_term_snapshot(p_term_id uuid)
returns jsonb language sql stable security definer set search_path='public' as $$
 select case when t.id is null then null else jsonb_build_object(
   'id',t.id,'code',t.code,'name',t.name,'payment_mode',t.payment_mode,
   'installment_count',t.installment_count,'offset_days',to_jsonb(t.offset_days),
   'payment_method_code',t.payment_method_code
 ) end
 from public.purchase_payment_terms t where t.id=p_term_id;
$$;
revoke all on function public._purchase_payment_term_snapshot(uuid) from public,anon,authenticated;

create or replace function public._suggest_supplier_payment_term(p_store_id uuid,p_supplier_id uuid)
returns jsonb language plpgsql stable security definer set search_path='public' as $$
declare v_term_id uuid; v_source text; v_term public.purchase_payment_terms%rowtype;
begin
 if p_store_id is null or p_supplier_id is null then return null; end if;
 select pd.payment_term_id into v_term_id
 from public.purchase_documents pd
 join public.purchase_payment_terms t on t.id=pd.payment_term_id and t.store_id=pd.store_id and t.active
 where pd.store_id=p_store_id and pd.supplier_id=p_supplier_id and pd.payment_term_id is not null and pd.status not in ('cancelled','canceled')
 order by coalesce(pd.issue_date,pd.created_at::date) desc,pd.created_at desc limit 1;
 if v_term_id is not null then
   v_source:='recent_purchase';
 else
   select s.preferred_purchase_payment_term_id into v_term_id
   from public.suppliers s
   join public.purchase_payment_terms t on t.id=s.preferred_purchase_payment_term_id and t.store_id=s.store_id and t.active
   where s.id=p_supplier_id and s.store_id=p_store_id;
   if v_term_id is not null then v_source:='supplier_default'; end if;
 end if;
 if v_term_id is null then
   select t.id into v_term_id from public.purchase_payment_terms t
   where t.store_id=p_store_id and t.active and t.is_default order by t.created_at limit 1;
   if v_term_id is not null then v_source:='store_default'; end if;
 end if;
 if v_term_id is null then return null; end if;
 select * into v_term from public.purchase_payment_terms where id=v_term_id and store_id=p_store_id;
 return jsonb_build_object('payment_term_id',v_term.id,'source',v_source,'snapshot',public._purchase_payment_term_snapshot(v_term.id),'payment_method_code',v_term.payment_method_code);
end $$;
revoke all on function public._suggest_supplier_payment_term(uuid,uuid) from public,anon,authenticated;

create or replace function public._accounts_payable_add_event(
 p_store_id uuid,p_payable_id uuid,p_event_type text,p_title text,p_description text default null,
 p_old_data jsonb default null,p_new_data jsonb default null,p_metadata jsonb default '{}'::jsonb
)
returns void language plpgsql security definer set search_path='public' as $$
begin
 insert into public.accounts_payable_events(store_id,accounts_payable_id,event_type,title,description,old_data,new_data,metadata,created_by)
 values(p_store_id,p_payable_id,p_event_type,p_title,p_description,p_old_data,p_new_data,coalesce(p_metadata,'{}'::jsonb),auth.uid());
end $$;
revoke all on function public._accounts_payable_add_event(uuid,uuid,text,text,text,jsonb,jsonb,jsonb) from public,anon,authenticated;

create or replace function public._recalculate_accounts_payable(p_payable_id uuid)
returns void language plpgsql security definer set search_path='public' as $$
declare
 v_payable public.accounts_payable%rowtype;
 v_signed_adjustment numeric(14,2); v_paid numeric(14,2); v_new_net numeric(14,2);
 v_remaining_decrease numeric(14,2); v_inst record; v_reduce numeric(14,2); v_last_installment_id uuid; v_status text;
begin
 select * into v_payable from public.accounts_payable where id=p_payable_id for update;
 if v_payable.id is null then raise exception 'Conta a pagar não encontrada.'; end if;
 select coalesce(sum(case when direction='increase' then amount else -amount end),0)::numeric(14,2)
   into v_signed_adjustment from public.accounts_payable_adjustments where accounts_payable_id=p_payable_id and status='active';
 select coalesce(sum(amount),0)::numeric(14,2)
   into v_paid from public.accounts_payable_payments where accounts_payable_id=p_payable_id and status='confirmed';
 v_new_net:=round(v_payable.original_amount+v_signed_adjustment,2);
 if v_new_net<0 then raise exception 'Ajustes não podem tornar a obrigação financeira negativa.'; end if;
 if v_paid>v_new_net then raise exception 'O valor líquido após ajustes não pode ser inferior ao total já pago.'; end if;

 update public.accounts_payable_installments set paid_amount=0,net_amount=original_amount,updated_at=now()
 where accounts_payable_id=p_payable_id and status<>'cancelled';
 update public.accounts_payable_installments i set paid_amount=p.paid,updated_at=now()
 from (select installment_id,sum(amount)::numeric(14,2) paid from public.accounts_payable_payments where accounts_payable_id=p_payable_id and status='confirmed' group by installment_id) p
 where i.id=p.installment_id;

 if v_signed_adjustment<0 then
   v_remaining_decrease:=-v_signed_adjustment;
   for v_inst in select id,original_amount,paid_amount from public.accounts_payable_installments where accounts_payable_id=p_payable_id and status<>'cancelled' order by installment_number desc loop
     exit when v_remaining_decrease<=0;
     v_reduce:=least(v_remaining_decrease,greatest(v_inst.original_amount-v_inst.paid_amount,0));
     if v_reduce>0 then
       update public.accounts_payable_installments set net_amount=original_amount-v_reduce,updated_at=now() where id=v_inst.id;
       v_remaining_decrease:=v_remaining_decrease-v_reduce;
     end if;
   end loop;
   if v_remaining_decrease>0 then raise exception 'Não há saldo não pago suficiente para aplicar o abatimento informado.'; end if;
 elsif v_signed_adjustment>0 then
   select id into v_last_installment_id from public.accounts_payable_installments where accounts_payable_id=p_payable_id and status<>'cancelled' order by installment_number desc limit 1;
   update public.accounts_payable_installments set net_amount=original_amount+v_signed_adjustment,updated_at=now() where id=v_last_installment_id;
 end if;

 update public.accounts_payable_installments set status=case
   when status='cancelled' then 'cancelled'
   when paid_amount>=net_amount then 'paid'
   when paid_amount>0 then 'partially_paid'
   else 'pending' end,updated_at=now()
 where accounts_payable_id=p_payable_id;

 if v_payable.status='cancelled' then v_status:='cancelled';
 elsif v_new_net=0 or v_paid>=v_new_net then v_status:='paid';
 elsif v_paid>0 then v_status:='partially_paid';
 elsif v_payable.status='draft' then v_status:='draft';
 else v_status:='open'; end if;

 update public.accounts_payable set net_amount=v_new_net,paid_amount=v_paid,status=v_status,updated_at=now() where id=p_payable_id;
 update public.purchase_documents pd set financial_gross_amount=v_payable.original_amount,financial_adjustment_amount=v_new_net-v_payable.original_amount,financial_net_amount=v_new_net,financial_status=v_status
 where pd.id=v_payable.purchase_document_id and pd.store_id=v_payable.store_id;
end $$;
revoke all on function public._recalculate_accounts_payable(uuid) from public,anon,authenticated;

create or replace function public._upsert_purchase_payable_from_document(p_document_id uuid)
returns uuid language plpgsql security definer set search_path='public' as $$
declare
  v_doc public.purchase_documents%rowtype; v_term public.purchase_payment_terms%rowtype; v_payable public.accounts_payable%rowtype;
  v_payable_id uuid; v_snapshot jsonb; v_offsets integer[]; v_count integer; v_i integer;
  v_total numeric(14,2); v_base numeric(14,2); v_piece numeric(14,2); v_acc numeric(14,2):=0; v_due date;
  v_status text; v_has_activity boolean:=false; v_needs_rebuild boolean:=false;
begin
  select * into v_doc from public.purchase_documents where id=p_document_id for update;
  if v_doc.id is null or v_doc.payment_term_id is null then return null; end if;
  if v_doc.status in ('cancelled','canceled') then return null; end if;
  select * into v_term from public.purchase_payment_terms where id=v_doc.payment_term_id and store_id=v_doc.store_id;
  if v_term.id is null then raise exception 'Condição de pagamento inválida para a loja da compra.'; end if;

  v_snapshot:=coalesce(v_doc.payment_term_snapshot,public._purchase_payment_term_snapshot(v_term.id));
  v_offsets:=array(select jsonb_array_elements_text(v_snapshot->'offset_days')::integer);
  v_count:=coalesce((v_snapshot->>'installment_count')::integer,cardinality(v_offsets));
  if v_count is null or v_count<=0 or cardinality(v_offsets)<>v_count or not public._purchase_term_offsets_valid(v_offsets) then raise exception 'A condição de pagamento possui agenda inválida.'; end if;
  v_total:=round(coalesce(v_doc.total_amount,0),2); if v_total<=0 then return null; end if;
  v_status:=case when v_doc.status='draft' then 'draft' else 'open' end;
  select * into v_payable from public.accounts_payable where store_id=v_doc.store_id and purchase_document_id=v_doc.id for update;

  if v_payable.id is null then
    v_needs_rebuild:=true;
    insert into public.accounts_payable(payable_code,store_id,supplier_id,purchase_document_id,document_number,description,original_amount,net_amount,status,payment_term_id,payment_term_snapshot,payment_method_code,preferred_financial_account_id,issue_date,notes,created_by)
    values('AP-'||to_char(timezone('America/Sao_Paulo',now()),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),v_doc.store_id,v_doc.supplier_id,v_doc.id,coalesce(v_doc.invoice_number,v_doc.document_code),'Compra '||coalesce(v_doc.document_code,v_doc.invoice_number,v_doc.id::text),v_total,v_total,v_status,v_term.id,v_snapshot,coalesce(v_doc.payment_method_code,v_term.payment_method_code),v_doc.preferred_financial_account_id,coalesce(v_doc.issue_date,current_date),v_doc.financial_notes,auth.uid()) returning id into v_payable_id;
    perform public._accounts_payable_add_event(v_doc.store_id,v_payable_id,'payable_created','Conta a pagar criada','Obrigação financeira criada a partir da compra '||coalesce(v_doc.document_code,v_doc.id::text)||'.',null,jsonb_build_object('original_amount',v_total,'payment_term',v_snapshot,'status',v_status),jsonb_build_object('purchase_document_id',v_doc.id));
  else
    v_payable_id:=v_payable.id;
    select exists(select 1 from public.accounts_payable_payments p where p.accounts_payable_id=v_payable.id and p.status='confirmed') or exists(select 1 from public.accounts_payable_adjustments a where a.accounts_payable_id=v_payable.id and a.status='active') into v_has_activity;
    v_needs_rebuild := v_payable.original_amount is distinct from v_total
      or v_payable.payment_term_id is distinct from v_term.id
      or v_payable.payment_method_code is distinct from coalesce(v_doc.payment_method_code,v_term.payment_method_code)
      or v_payable.preferred_financial_account_id is distinct from v_doc.preferred_financial_account_id
      or not exists(select 1 from public.accounts_payable_installments i where i.accounts_payable_id=v_payable.id);
    if v_has_activity and v_needs_rebuild then raise exception 'A obrigação financeira já possui pagamentos ou ajustes e não pode ter valor/condição reestruturados.'; end if;
    if not v_has_activity and v_needs_rebuild then
      update public.accounts_payable set supplier_id=v_doc.supplier_id,document_number=coalesce(v_doc.invoice_number,v_doc.document_code),description='Compra '||coalesce(v_doc.document_code,v_doc.invoice_number,v_doc.id::text),original_amount=v_total,net_amount=v_total,paid_amount=0,status=v_status,payment_term_id=v_term.id,payment_term_snapshot=v_snapshot,payment_method_code=coalesce(v_doc.payment_method_code,v_term.payment_method_code),preferred_financial_account_id=v_doc.preferred_financial_account_id,issue_date=coalesce(v_doc.issue_date,current_date),notes=v_doc.financial_notes,updated_at=now() where id=v_payable_id;
      delete from public.accounts_payable_installments where accounts_payable_id=v_payable_id;
    else
      update public.accounts_payable set status=case when status in ('paid','partially_paid') then status else v_status end,document_number=coalesce(v_doc.invoice_number,v_doc.document_code),description='Compra '||coalesce(v_doc.document_code,v_doc.invoice_number,v_doc.id::text),notes=v_doc.financial_notes,updated_at=now() where id=v_payable_id;
    end if;
  end if;

  if v_needs_rebuild then
    v_base:=round(v_total/v_count,2);
    for v_i in 1..v_count loop
      if v_i<v_count then v_piece:=v_base; v_acc:=v_acc+v_piece; else v_piece:=v_total-v_acc; end if;
      v_due:=coalesce(v_doc.issue_date,current_date)+v_offsets[v_i];
      insert into public.accounts_payable_installments(store_id,accounts_payable_id,installment_number,due_date,original_amount,net_amount,status,payment_method_code,preferred_financial_account_id)
      values(v_doc.store_id,v_payable_id,v_i,v_due,v_piece,v_piece,'pending',coalesce(v_doc.payment_method_code,v_term.payment_method_code),v_doc.preferred_financial_account_id);
    end loop;
  end if;

  update public.purchase_documents set payment_term_snapshot=v_snapshot,payment_mode=v_term.payment_mode,financial_gross_amount=v_total,financial_status=v_status where id=v_doc.id;
  perform public._recalculate_accounts_payable(v_payable_id);
  return v_payable_id;
end $$;
revoke all on function public._upsert_purchase_payable_from_document(uuid) from public,anon,authenticated;

create or replace function public.get_accounts_payable_detail_safe(p_payable_id uuid)
returns jsonb language plpgsql stable security definer set search_path='public' as $$
declare v_p public.accounts_payable%rowtype;
begin
 select * into v_p from public.accounts_payable where id=p_payable_id;
 if v_p.id is null then return null; end if;
 if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
 if not (public.app_is_store_owner(v_p.store_id) or public.user_has_store_permission(v_p.store_id,'accounts_payable.view') or public.user_has_store_permission(v_p.store_id,'accounts_payable.manage') or public.user_has_store_permission(v_p.store_id,'accounts_payable.pay') or public.user_has_store_permission(v_p.store_id,'accounts_payable.reverse_payment')) then raise exception 'Sem permissão para consultar conta a pagar.'; end if;
 return jsonb_build_object('payable',to_jsonb(v_p),'installments',coalesce((select jsonb_agg(to_jsonb(i) order by i.installment_number) from public.accounts_payable_installments i where i.accounts_payable_id=v_p.id),'[]'::jsonb),'adjustments',coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at) from public.accounts_payable_adjustments a where a.accounts_payable_id=v_p.id),'[]'::jsonb),'payments',coalesce((select jsonb_agg(to_jsonb(p) order by p.paid_at) from public.accounts_payable_payments p where p.accounts_payable_id=v_p.id),'[]'::jsonb),'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at) from public.accounts_payable_events e where e.accounts_payable_id=v_p.id),'[]'::jsonb));
end $$;

create or replace function public.list_accounts_payable_safe(p_store_id uuid,p_status text default null,p_supplier_id uuid default null,p_due_from date default null,p_due_to date default null,p_limit integer default 200,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='public' as $$
begin
 if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
 if not (public.app_is_store_owner(p_store_id) or public.user_has_store_permission(p_store_id,'accounts_payable.view') or public.user_has_store_permission(p_store_id,'accounts_payable.manage') or public.user_has_store_permission(p_store_id,'accounts_payable.pay')) then raise exception 'Sem permissão para consultar contas a pagar.'; end if;
 return jsonb_build_object(
   'items',coalesce((select jsonb_agg(x.row_data order by x.next_due_date nulls last,x.payable_code) from (
     select jsonb_build_object('id',p.id,'payable_code',p.payable_code,'supplier_id',p.supplier_id,'supplier_name',s.name,'purchase_document_id',p.purchase_document_id,'document_number',p.document_number,'description',p.description,'original_amount',p.original_amount,'adjustment_amount',p.adjustment_amount,'net_amount',p.net_amount,'paid_amount',p.paid_amount,'open_amount',p.open_amount,'status',p.status,'payment_term_id',p.payment_term_id,'payment_term_snapshot',p.payment_term_snapshot,'payment_method_code',p.payment_method_code,'preferred_financial_account_id',p.preferred_financial_account_id,'issue_date',p.issue_date,'next_due_date',min(i.due_date) filter(where i.status in ('pending','partially_paid'))) row_data,
       p.payable_code,min(i.due_date) filter(where i.status in ('pending','partially_paid')) next_due_date
     from public.accounts_payable p join public.suppliers s on s.id=p.supplier_id and s.store_id=p.store_id left join public.accounts_payable_installments i on i.accounts_payable_id=p.id
     where p.store_id=p_store_id and (p_status is null or p.status=p_status) and (p_supplier_id is null or p.supplier_id=p_supplier_id)
       and (p_due_from is null or exists(select 1 from public.accounts_payable_installments ix where ix.accounts_payable_id=p.id and ix.due_date>=p_due_from and ix.status in ('pending','partially_paid')))
       and (p_due_to is null or exists(select 1 from public.accounts_payable_installments ix where ix.accounts_payable_id=p.id and ix.due_date<=p_due_to and ix.status in ('pending','partially_paid')))
     group by p.id,s.name order by next_due_date nulls last,p.payable_code
     limit greatest(1,least(coalesce(p_limit,200),500)) offset greatest(coalesce(p_offset,0),0)
   ) x),'[]'::jsonb),
   'total',(select count(*) from public.accounts_payable p where p.store_id=p_store_id and (p_status is null or p.status=p_status) and (p_supplier_id is null or p.supplier_id=p_supplier_id))
 );
end $$;

create or replace function public.list_purchase_payment_terms_safe(p_store_id uuid,p_include_inactive boolean default false)
returns jsonb language plpgsql stable security definer set search_path='public' as $$
begin
 if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
 if not (public.app_is_store_owner(p_store_id) or public.user_has_store_permission(p_store_id,'accounts_payable.view') or public.user_has_store_permission(p_store_id,'accounts_payable.manage') or public.user_has_store_permission(p_store_id,'purchases.view') or public.user_has_store_permission(p_store_id,'purchases.create') or public.user_has_store_permission(p_store_id,'quotes.view') or public.user_has_store_permission(p_store_id,'quotes.manage')) then raise exception 'Sem permissão para consultar condições de pagamento.'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'code',t.code,'name',t.name,'payment_mode',t.payment_mode,'installment_count',t.installment_count,'offset_days',t.offset_days,'payment_method_code',t.payment_method_code,'active',t.active,'is_default',t.is_default,'is_system_preset',t.is_system_preset) order by t.active desc,t.is_default desc,t.name) from public.purchase_payment_terms t where t.store_id=p_store_id and (p_include_inactive or t.active)),'[]'::jsonb);
end $$;

create or replace function public.upsert_purchase_payment_term_safe(p_store_id uuid,p_term_id uuid,p_name text,p_code text,p_payment_mode text,p_offset_days integer[],p_payment_method_code text default null,p_is_default boolean default false,p_active boolean default true,p_metadata jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='public' as $$
declare v_id uuid; v_code text;
begin
 if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
 if not (public.app_is_store_owner(p_store_id) or public.user_has_store_permission(p_store_id,'accounts_payable.manage')) then raise exception 'Sem permissão para gerenciar condições de pagamento.'; end if;
 if nullif(btrim(p_name),'') is null then raise exception 'Informe o nome da condição.'; end if;
 if p_payment_mode not in ('cash','term') then raise exception 'Modo de pagamento inválido.'; end if;
 if not public._purchase_term_offsets_valid(p_offset_days) then raise exception 'Os vencimentos devem ser não negativos e crescentes.'; end if;
 if p_payment_mode='cash' and p_offset_days<>array[0]::integer[] then raise exception 'Condição à vista deve vencer no dia 0.'; end if;
 if p_payment_method_code is not null and not exists(select 1 from public.store_payment_methods m where m.store_id=p_store_id and m.code=p_payment_method_code and m.active) then raise exception 'Forma de pagamento inválida ou inativa.'; end if;
 v_code:=coalesce(nullif(btrim(p_code),''),trim(both '_' from regexp_replace(lower(btrim(p_name)),'[^a-z0-9]+','_','g')));
 if v_code='' then v_code:='term_'||substr(replace(gen_random_uuid()::text,'-',''),1,8); end if;
 if p_is_default then update public.purchase_payment_terms set is_default=false,updated_at=now() where store_id=p_store_id and is_default; end if;
 if p_term_id is null then
   insert into public.purchase_payment_terms(store_id,code,name,payment_mode,installment_count,offset_days,payment_method_code,active,is_default,is_system_preset,metadata,created_by)
   values(p_store_id,v_code,btrim(p_name),p_payment_mode,cardinality(p_offset_days),p_offset_days,p_payment_method_code,p_active,p_is_default,false,coalesce(p_metadata,'{}'::jsonb),auth.uid()) returning id into v_id;
 else
   update public.purchase_payment_terms set code=v_code,name=btrim(p_name),payment_mode=p_payment_mode,installment_count=cardinality(p_offset_days),offset_days=p_offset_days,payment_method_code=p_payment_method_code,active=p_active,is_default=p_is_default,metadata=coalesce(p_metadata,metadata),updated_at=now()
   where id=p_term_id and store_id=p_store_id returning id into v_id;
   if v_id is null then raise exception 'Condição de pagamento não encontrada.'; end if;
 end if;
 return public._purchase_payment_term_snapshot(v_id);
end $$;

create or replace function public.suggest_supplier_payment_term_safe(p_store_id uuid,p_supplier_id uuid)
returns jsonb language plpgsql stable security definer set search_path='public' as $$
begin
 if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
 if not exists(select 1 from public.suppliers s where s.id=p_supplier_id and s.store_id=p_store_id) then raise exception 'Fornecedor não pertence à loja.'; end if;
 if not (public.app_is_store_owner(p_store_id) or public.user_has_store_permission(p_store_id,'quotes.view') or public.user_has_store_permission(p_store_id,'quotes.manage') or public.user_has_store_permission(p_store_id,'purchases.view') or public.user_has_store_permission(p_store_id,'purchases.create')) then raise exception 'Sem permissão para consultar sugestão de prazo.'; end if;
 return public._suggest_supplier_payment_term(p_store_id,p_supplier_id);
end $$;

create or replace function public.set_purchase_financial_terms_safe(p_document_id uuid,p_payment_term_id uuid,p_payment_method_code text default null,p_preferred_financial_account_id uuid default null,p_payment_term_source text default 'manual',p_notes text default null)
returns jsonb language plpgsql security definer set search_path='public' as $$
declare v_doc public.purchase_documents%rowtype; v_term public.purchase_payment_terms%rowtype; v_payable_id uuid;
begin
 if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
 select * into v_doc from public.purchase_documents where id=p_document_id for update;
 if v_doc.id is null then raise exception 'Compra não encontrada.'; end if;
 if not (public.app_is_store_owner(v_doc.store_id) or public.user_has_store_permission(v_doc.store_id,'accounts_payable.manage') or public.user_has_store_permission(v_doc.store_id,'purchases.create')) then raise exception 'Sem permissão para definir condição financeira da compra.'; end if;
 if v_doc.status in ('cancelled','canceled') then raise exception 'Compra cancelada não pode gerar obrigação financeira.'; end if;
 if p_payment_term_source not in ('quotation','supplier_response','supplier_default','recent_purchase','store_default','manual','legacy') then raise exception 'Origem da condição de pagamento inválida.'; end if;
 select * into v_term from public.purchase_payment_terms where id=p_payment_term_id and store_id=v_doc.store_id and active;
 if v_term.id is null then raise exception 'Condição de pagamento inválida ou inativa.'; end if;
 if p_payment_method_code is not null and not exists(select 1 from public.store_payment_methods m where m.store_id=v_doc.store_id and m.code=p_payment_method_code and m.active) then raise exception 'Forma de pagamento inválida ou inativa.'; end if;
 if p_preferred_financial_account_id is not null and not exists(select 1 from public.store_financial_accounts a where a.store_id=v_doc.store_id and a.id=p_preferred_financial_account_id and a.active) then raise exception 'Conta financeira prevista inválida ou inativa.'; end if;
 update public.purchase_documents set payment_term_id=v_term.id,payment_term_snapshot=public._purchase_payment_term_snapshot(v_term.id),payment_term_source=p_payment_term_source,payment_mode=v_term.payment_mode,payment_method_code=coalesce(p_payment_method_code,v_term.payment_method_code),preferred_financial_account_id=p_preferred_financial_account_id,financial_notes=nullif(btrim(p_notes),'') where id=v_doc.id;
 v_payable_id:=public._upsert_purchase_payable_from_document(v_doc.id);
 return public.get_accounts_payable_detail_safe(v_payable_id);
end $$;

create or replace function public.apply_accounts_payable_adjustment_safe(p_payable_id uuid,p_adjustment_type text,p_direction text,p_amount numeric,p_purchase_receipt_issue_id uuid default null,p_notes text default null)
returns jsonb language plpgsql security definer set search_path='public' as $$
declare v_p public.accounts_payable%rowtype; v_adj_id uuid;
begin
 if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
 select * into v_p from public.accounts_payable where id=p_payable_id for update; if v_p.id is null then raise exception 'Conta a pagar não encontrada.'; end if;
 if not (public.app_is_store_owner(v_p.store_id) or public.user_has_store_permission(v_p.store_id,'accounts_payable.manage')) then raise exception 'Sem permissão para ajustar conta a pagar.'; end if;
 if v_p.status='cancelled' then raise exception 'Conta cancelada não pode receber ajuste.'; end if;
 if p_adjustment_type not in ('discount','supplier_credit','return','correction','other') then raise exception 'Tipo de ajuste inválido.'; end if;
 if p_direction not in ('increase','decrease') then raise exception 'Direção do ajuste inválida.'; end if;
 if coalesce(p_amount,0)<=0 then raise exception 'Valor do ajuste deve ser positivo.'; end if;
 if p_purchase_receipt_issue_id is not null and not exists(select 1 from public.purchase_receipt_issues ri where ri.id=p_purchase_receipt_issue_id and ri.store_id=v_p.store_id and ri.purchase_document_id=v_p.purchase_document_id) then raise exception 'Ressalva de recebimento não pertence à mesma compra.'; end if;
 insert into public.accounts_payable_adjustments(store_id,accounts_payable_id,purchase_receipt_issue_id,adjustment_type,direction,amount,notes,created_by)
 values(v_p.store_id,v_p.id,p_purchase_receipt_issue_id,p_adjustment_type,p_direction,round(p_amount,2),nullif(btrim(p_notes),''),auth.uid()) returning id into v_adj_id;
 perform public._recalculate_accounts_payable(v_p.id);
 perform public._accounts_payable_add_event(v_p.store_id,v_p.id,'adjustment_applied','Ajuste financeiro aplicado',coalesce(nullif(btrim(p_notes),''),'Ajuste aplicado à obrigação financeira.'),null,jsonb_build_object('adjustment_id',v_adj_id,'type',p_adjustment_type,'direction',p_direction,'amount',round(p_amount,2),'receipt_issue_id',p_purchase_receipt_issue_id),'{}'::jsonb);
 return public.get_accounts_payable_detail_safe(v_p.id);
end $$;

create or replace function public.reverse_accounts_payable_adjustment_safe(p_adjustment_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path='public' as $$
declare v_a public.accounts_payable_adjustments%rowtype;
begin
 if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
 if nullif(btrim(p_reason),'') is null then raise exception 'Informe o motivo do estorno.'; end if;
 select * into v_a from public.accounts_payable_adjustments where id=p_adjustment_id for update; if v_a.id is null then raise exception 'Ajuste não encontrado.'; end if;
 if not (public.app_is_store_owner(v_a.store_id) or public.user_has_store_permission(v_a.store_id,'accounts_payable.manage')) then raise exception 'Sem permissão para estornar ajuste.'; end if;
 if v_a.status='reversed' then raise exception 'Ajuste já estornado.'; end if;
 update public.accounts_payable_adjustments set status='reversed',reversed_by=auth.uid(),reversed_at=now(),reversal_reason=btrim(p_reason) where id=v_a.id;
 perform public._recalculate_accounts_payable(v_a.accounts_payable_id);
 perform public._accounts_payable_add_event(v_a.store_id,v_a.accounts_payable_id,'adjustment_reversed','Ajuste financeiro estornado',btrim(p_reason),to_jsonb(v_a),jsonb_build_object('status','reversed'),'{}'::jsonb);
 return public.get_accounts_payable_detail_safe(v_a.accounts_payable_id);
end $$;

create or replace function public.register_accounts_payable_payment_safe(p_installment_id uuid,p_amount numeric,p_financial_account_id uuid,p_payment_method_code text,p_paid_at timestamptz default now(),p_reference text default null,p_notes text default null)
returns jsonb language plpgsql security definer set search_path='public' as $$
declare v_i public.accounts_payable_installments%rowtype; v_p public.accounts_payable%rowtype; v_payment_id uuid; v_entry_id uuid; v_open numeric(14,2);
begin
 if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
 select * into v_i from public.accounts_payable_installments where id=p_installment_id for update; if v_i.id is null then raise exception 'Parcela não encontrada.'; end if;
 select * into v_p from public.accounts_payable where id=v_i.accounts_payable_id for update;
 if not (public.app_is_store_owner(v_p.store_id) or public.user_has_store_permission(v_p.store_id,'accounts_payable.pay')) then raise exception 'Sem permissão para baixar conta a pagar.'; end if;
 if v_p.status='cancelled' or v_i.status='cancelled' then raise exception 'Obrigação cancelada não pode ser paga.'; end if;
 v_open:=greatest(v_i.net_amount-v_i.paid_amount,0);
 if coalesce(p_amount,0)<=0 then raise exception 'Valor do pagamento deve ser positivo.'; end if;
 if round(p_amount,2)>v_open then raise exception 'Pagamento acima do saldo da parcela. Saldo: %, informado: %.',v_open,round(p_amount,2); end if;
 if not exists(select 1 from public.store_financial_accounts a where a.id=p_financial_account_id and a.store_id=v_p.store_id and a.active) then raise exception 'Conta financeira inválida ou inativa.'; end if;
 if not exists(select 1 from public.store_payment_methods m where m.store_id=v_p.store_id and m.code=p_payment_method_code and m.active) then raise exception 'Forma de pagamento inválida ou inativa.'; end if;
 insert into public.accounts_payable_payments(store_id,accounts_payable_id,installment_id,amount,paid_at,financial_account_id,payment_method_code,reference,notes,status,created_by)
 values(v_p.store_id,v_p.id,v_i.id,round(p_amount,2),coalesce(p_paid_at,now()),p_financial_account_id,p_payment_method_code,nullif(btrim(p_reference),''),nullif(btrim(p_notes),''),'confirmed',auth.uid()) returning id into v_payment_id;
 insert into public.cashbook_entries(store_id,entry_code,entry_date,occurred_at,type,direction,amount,description,notes,payment_method,payment_method_code,source,source_id,status,affects_balance,metadata,created_by,source_financial_account_id,is_transfer)
 values(v_p.store_id,'APG-'||to_char(timezone('America/Sao_Paulo',coalesce(p_paid_at,now())),'YYYYMMDD-HH24MISS')||'-'||upper(substr(replace(v_payment_id::text,'-',''),1,6)),timezone('America/Sao_Paulo',coalesce(p_paid_at,now()))::date,coalesce(p_paid_at,now()),'manual_expense','out',round(p_amount,2),'Pagamento '||v_p.payable_code||' · parcela '||v_i.installment_number,nullif(btrim(p_notes),''),p_payment_method_code,p_payment_method_code,'accounts_payable',v_payment_id,'confirmed',true,jsonb_build_object('accounts_payable_id',v_p.id,'installment_id',v_i.id,'purchase_document_id',v_p.purchase_document_id,'supplier_id',v_p.supplier_id,'payment_reference',nullif(btrim(p_reference),'')),auth.uid(),p_financial_account_id,false) returning id into v_entry_id;
 update public.accounts_payable_payments set cashbook_entry_id=v_entry_id where id=v_payment_id;
 perform public._recalculate_accounts_payable(v_p.id);
 perform public._accounts_payable_add_event(v_p.store_id,v_p.id,'payment_registered','Pagamento registrado','Pagamento de '||round(p_amount,2)::text||' registrado na parcela '||v_i.installment_number||'.',null,jsonb_build_object('payment_id',v_payment_id,'installment_id',v_i.id,'amount',round(p_amount,2),'financial_account_id',p_financial_account_id,'cashbook_entry_id',v_entry_id),'{}'::jsonb);
 return public.get_accounts_payable_detail_safe(v_p.id);
end $$;

create or replace function public.reverse_accounts_payable_payment_safe(p_payment_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path='public' as $$
declare v_pay public.accounts_payable_payments%rowtype; v_p public.accounts_payable%rowtype; v_entry_id uuid;
begin
 if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
 if nullif(btrim(p_reason),'') is null then raise exception 'Informe o motivo do estorno.'; end if;
 select * into v_pay from public.accounts_payable_payments where id=p_payment_id for update; if v_pay.id is null then raise exception 'Pagamento não encontrado.'; end if;
 select * into v_p from public.accounts_payable where id=v_pay.accounts_payable_id for update;
 if not (public.app_is_store_owner(v_p.store_id) or public.user_has_store_permission(v_p.store_id,'accounts_payable.reverse_payment')) then raise exception 'Sem permissão para estornar pagamento.'; end if;
 if v_pay.status='reversed' then raise exception 'Pagamento já estornado.'; end if;
 insert into public.cashbook_entries(store_id,entry_code,entry_date,occurred_at,type,direction,amount,description,notes,payment_method,payment_method_code,source,source_id,status,affects_balance,metadata,created_by,destination_financial_account_id,is_transfer)
 values(v_p.store_id,'APE-'||to_char(timezone('America/Sao_Paulo',now()),'YYYYMMDD-HH24MISS')||'-'||upper(substr(replace(v_pay.id::text,'-',''),1,6)),timezone('America/Sao_Paulo',now())::date,now(),'adjustment','in',v_pay.amount,'Estorno de pagamento '||v_p.payable_code,btrim(p_reason),v_pay.payment_method_code,v_pay.payment_method_code,'accounts_payable_reversal',v_pay.id,'confirmed',true,jsonb_build_object('accounts_payable_id',v_p.id,'payment_id',v_pay.id,'reversal_reason',btrim(p_reason)),auth.uid(),v_pay.financial_account_id,false) returning id into v_entry_id;
 update public.accounts_payable_payments set status='reversed',reversed_by=auth.uid(),reversed_at=now(),reversal_reason=btrim(p_reason),reversal_cashbook_entry_id=v_entry_id where id=v_pay.id;
 perform public._recalculate_accounts_payable(v_p.id);
 perform public._accounts_payable_add_event(v_p.store_id,v_p.id,'payment_reversed','Pagamento estornado',btrim(p_reason),to_jsonb(v_pay),jsonb_build_object('status','reversed','reversal_cashbook_entry_id',v_entry_id),'{}'::jsonb);
 return public.get_accounts_payable_detail_safe(v_p.id);
end $$;

create or replace function public.cancel_accounts_payable_safe(p_payable_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path='public' as $$
declare v_p public.accounts_payable%rowtype;
begin
 if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
 if nullif(btrim(p_reason),'') is null then raise exception 'Informe o motivo do cancelamento.'; end if;
 select * into v_p from public.accounts_payable where id=p_payable_id for update; if v_p.id is null then raise exception 'Conta a pagar não encontrada.'; end if;
 if not (public.app_is_store_owner(v_p.store_id) or public.user_has_store_permission(v_p.store_id,'accounts_payable.manage')) then raise exception 'Sem permissão para cancelar conta a pagar.'; end if;
 if exists(select 1 from public.accounts_payable_payments where accounts_payable_id=v_p.id and status='confirmed') then raise exception 'Existem pagamentos confirmados. Estorne-os antes de cancelar a obrigação.'; end if;
 if v_p.status='cancelled' then return public.get_accounts_payable_detail_safe(v_p.id); end if;
 update public.accounts_payable set status='cancelled',cancelled_by=auth.uid(),cancelled_at=now(),cancellation_reason=btrim(p_reason),updated_at=now() where id=v_p.id;
 update public.accounts_payable_installments set status='cancelled',updated_at=now() where accounts_payable_id=v_p.id;
 update public.purchase_documents set financial_status='cancelled' where id=v_p.purchase_document_id and store_id=v_p.store_id;
 perform public._accounts_payable_add_event(v_p.store_id,v_p.id,'payable_cancelled','Conta a pagar cancelada',btrim(p_reason),to_jsonb(v_p),jsonb_build_object('status','cancelled'),'{}'::jsonb);
 return public.get_accounts_payable_detail_safe(v_p.id);
end $$;

create or replace function public.set_purchase_quotation_payment_request_safe(p_quotation_id uuid,p_payment_term_id uuid,p_payment_method_code text default null)
returns jsonb language plpgsql security definer set search_path='public' as $$
declare v_q public.purchase_quotations%rowtype; v_snapshot jsonb;
begin
 if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
 select * into v_q from public.purchase_quotations where id=p_quotation_id for update; if v_q.id is null then raise exception 'Cotação não encontrada.'; end if;
 if not public.user_can_purchase_action(v_q.store_id,'manage_quotation') then raise exception 'Sem permissão para alterar cotação.'; end if;
 if v_q.status in ('converted','cancelled') then raise exception 'Cotação encerrada não pode ser alterada.'; end if;
 if not exists(select 1 from public.purchase_payment_terms t where t.id=p_payment_term_id and t.store_id=v_q.store_id and t.active) then raise exception 'Condição de pagamento inválida.'; end if;
 if p_payment_method_code is not null and not exists(select 1 from public.store_payment_methods m where m.store_id=v_q.store_id and m.code=p_payment_method_code and m.active) then raise exception 'Forma de pagamento inválida.'; end if;
 v_snapshot:=public._purchase_payment_term_snapshot(p_payment_term_id);
 update public.purchase_quotations set sent_payment_term_id=p_payment_term_id,sent_payment_term_snapshot=v_snapshot,sent_payment_method_code=p_payment_method_code,updated_at=now() where id=p_quotation_id;
 return jsonb_build_object('quotation_id',p_quotation_id,'sent_payment_term_id',p_payment_term_id,'snapshot',v_snapshot,'payment_method_code',p_payment_method_code);
end $$;

create or replace function public.set_purchase_quotation_payment_response_safe(p_quotation_id uuid,p_payment_term_id uuid,p_payment_method_code text default null,p_notes text default null)
returns jsonb language plpgsql security definer set search_path='public' as $$
declare v_q public.purchase_quotations%rowtype; v_snapshot jsonb;
begin
 if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
 select * into v_q from public.purchase_quotations where id=p_quotation_id for update; if v_q.id is null then raise exception 'Cotação não encontrada.'; end if;
 if not public.user_can_purchase_action(v_q.store_id,'manage_quotation') then raise exception 'Sem permissão para registrar resposta financeira da cotação.'; end if;
 if v_q.status in ('converted','cancelled') then raise exception 'Cotação encerrada não pode ser alterada.'; end if;
 if not exists(select 1 from public.purchase_payment_terms t where t.id=p_payment_term_id and t.store_id=v_q.store_id and t.active) then raise exception 'Condição de pagamento inválida.'; end if;
 if p_payment_method_code is not null and not exists(select 1 from public.store_payment_methods m where m.store_id=v_q.store_id and m.code=p_payment_method_code and m.active) then raise exception 'Forma de pagamento inválida.'; end if;
 v_snapshot:=public._purchase_payment_term_snapshot(p_payment_term_id);
 update public.purchase_quotations set supplier_payment_term_id=p_payment_term_id,supplier_payment_term_snapshot=v_snapshot,supplier_payment_method_code=p_payment_method_code,supplier_payment_notes=nullif(btrim(p_notes),''),updated_at=now() where id=p_quotation_id;
 return jsonb_build_object('quotation_id',p_quotation_id,'supplier_payment_term_id',p_payment_term_id,'snapshot',v_snapshot,'payment_method_code',p_payment_method_code,'notes',nullif(btrim(p_notes),''));
end $$;

create or replace function public.accept_purchase_quotation_payment_terms_safe(p_quotation_id uuid,p_payment_term_id uuid default null,p_payment_method_code text default null)
returns jsonb language plpgsql security definer set search_path='public' as $$
declare v_q public.purchase_quotations%rowtype; v_term_id uuid; v_snapshot jsonb; v_method text;
begin
 if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
 select * into v_q from public.purchase_quotations where id=p_quotation_id for update; if v_q.id is null then raise exception 'Cotação não encontrada.'; end if;
 if not public.user_can_purchase_action(v_q.store_id,'manage_quotation') then raise exception 'Sem permissão para aceitar condição financeira da cotação.'; end if;
 if v_q.status in ('converted','cancelled') then raise exception 'Cotação encerrada não pode ser alterada.'; end if;
 v_term_id:=coalesce(p_payment_term_id,v_q.supplier_payment_term_id,v_q.sent_payment_term_id,v_q.suggested_payment_term_id);
 if v_term_id is null then raise exception 'Nenhuma condição de pagamento disponível para aceite.'; end if;
 if not exists(select 1 from public.purchase_payment_terms t where t.id=v_term_id and t.store_id=v_q.store_id) then raise exception 'Condição de pagamento inválida.'; end if;
 v_snapshot:=public._purchase_payment_term_snapshot(v_term_id);
 v_method:=coalesce(p_payment_method_code,v_q.supplier_payment_method_code,v_q.sent_payment_method_code);
 update public.purchase_quotations set accepted_payment_term_id=v_term_id,accepted_payment_term_snapshot=v_snapshot,accepted_payment_method_code=v_method,updated_at=now() where id=p_quotation_id;
 return jsonb_build_object('quotation_id',p_quotation_id,'accepted_payment_term_id',v_term_id,'snapshot',v_snapshot,'payment_method_code',v_method);
end $$;

create or replace function public.trg_purchase_quotation_payment_terms()
returns trigger language plpgsql security definer set search_path='public' as $$
declare v_suggestion jsonb;
begin
 if tg_op='INSERT' and new.suggested_payment_term_id is null then
   v_suggestion:=public._suggest_supplier_payment_term(new.store_id,new.supplier_id);
   if v_suggestion is not null then
     new.suggested_payment_term_id:=(v_suggestion->>'payment_term_id')::uuid;
     new.suggested_payment_term_snapshot:=v_suggestion->'snapshot';
     new.payment_term_suggestion_source:=v_suggestion->>'source';
     if new.sent_payment_term_id is null then
       new.sent_payment_term_id:=new.suggested_payment_term_id;
       new.sent_payment_term_snapshot:=new.suggested_payment_term_snapshot;
       new.sent_payment_method_code:=v_suggestion->>'payment_method_code';
     end if;
   end if;
 end if;
 if tg_op='UPDATE' and new.status='approved' and old.status is distinct from new.status and new.accepted_payment_term_id is null then
   new.accepted_payment_term_id:=coalesce(new.supplier_payment_term_id,new.sent_payment_term_id,new.suggested_payment_term_id);
   new.accepted_payment_term_snapshot:=coalesce(new.supplier_payment_term_snapshot,new.sent_payment_term_snapshot,new.suggested_payment_term_snapshot);
   new.accepted_payment_method_code:=coalesce(new.supplier_payment_method_code,new.sent_payment_method_code,new.accepted_payment_method_code);
 end if;
 return new;
end $$;
drop trigger if exists purchase_quotation_payment_terms_before_write on public.purchase_quotations;
create trigger purchase_quotation_payment_terms_before_write before insert or update of status on public.purchase_quotations for each row execute function public.trg_purchase_quotation_payment_terms();
revoke all on function public.trg_purchase_quotation_payment_terms() from public,anon,authenticated;

create or replace function public.trg_inherit_quotation_terms_to_purchase()
returns trigger language plpgsql security definer set search_path='public' as $$
declare v_term_id uuid; v_snapshot jsonb; v_method text; v_source text;
begin
 if new.converted_purchase_document_id is null or new.converted_purchase_document_id is not distinct from old.converted_purchase_document_id then return new; end if;
 v_term_id:=coalesce(new.accepted_payment_term_id,new.supplier_payment_term_id,new.sent_payment_term_id,new.suggested_payment_term_id);
 v_snapshot:=coalesce(new.accepted_payment_term_snapshot,new.supplier_payment_term_snapshot,new.sent_payment_term_snapshot,new.suggested_payment_term_snapshot);
 v_method:=coalesce(new.accepted_payment_method_code,new.supplier_payment_method_code,new.sent_payment_method_code);
 v_source:=case when new.accepted_payment_term_id is not null then 'quotation' when new.supplier_payment_term_id is not null then 'supplier_response' when new.sent_payment_term_id is not null then 'quotation' else coalesce(new.payment_term_suggestion_source,'quotation') end;
 update public.purchase_documents pd set source_quotation_id=new.id,payment_term_id=v_term_id,payment_term_snapshot=v_snapshot,payment_term_source=v_source,payment_mode=coalesce(v_snapshot->>'payment_mode',pd.payment_mode),payment_method_code=coalesce(v_method,v_snapshot->>'payment_method_code',pd.payment_method_code) where pd.id=new.converted_purchase_document_id and pd.store_id=new.store_id;
 return new;
end $$;
drop trigger if exists purchase_quotation_inherit_terms_after_convert on public.purchase_quotations;
create trigger purchase_quotation_inherit_terms_after_convert after update of converted_purchase_document_id on public.purchase_quotations for each row execute function public.trg_inherit_quotation_terms_to_purchase();
revoke all on function public.trg_inherit_quotation_terms_to_purchase() from public,anon,authenticated;

create or replace function public.trg_sync_purchase_document_states()
returns trigger language plpgsql security definer set search_path='public' as $$
begin
 new.commercial_status:=case when new.status in ('cancelled','canceled') then 'cancelled' when new.status in ('partially_received','confirmed') then 'committed' else coalesce(new.commercial_status,'draft') end;
 new.physical_status:=case when new.status in ('cancelled','canceled') then 'cancelled' when new.status='partially_received' then 'partial' when new.status='confirmed' then 'received' else 'not_received' end;
 return new;
end $$;
drop trigger if exists purchase_document_states_before_write on public.purchase_documents;
create trigger purchase_document_states_before_write before insert or update of status on public.purchase_documents for each row execute function public.trg_sync_purchase_document_states();
revoke all on function public.trg_sync_purchase_document_states() from public,anon,authenticated;

create or replace function public.trg_sync_purchase_payable_after_document()
returns trigger language plpgsql security definer set search_path='public' as $$
declare v_p public.accounts_payable%rowtype;
begin
 if new.status in ('cancelled','canceled') then
   select * into v_p from public.accounts_payable where store_id=new.store_id and purchase_document_id=new.id for update;
   if v_p.id is not null then
     if exists(select 1 from public.accounts_payable_payments where accounts_payable_id=v_p.id and status='confirmed') then raise exception 'A compra possui pagamentos financeiros confirmados. Estorne-os antes de cancelar a compra.'; end if;
     update public.accounts_payable set status='cancelled',cancelled_at=now(),cancelled_by=auth.uid(),cancellation_reason=coalesce(new.cancel_reason,'Compra cancelada'),updated_at=now() where id=v_p.id;
     update public.accounts_payable_installments set status='cancelled',updated_at=now() where accounts_payable_id=v_p.id;
     update public.purchase_documents set financial_status='cancelled' where id=new.id;
   end if;
   return null;
 end if;
 if new.payment_term_id is not null and coalesce(new.total_amount,0)>0 then perform public._upsert_purchase_payable_from_document(new.id); end if;
 if new.status in ('partially_received','confirmed') then
   update public.accounts_payable set status=case when paid_amount>=net_amount then 'paid' when paid_amount>0 then 'partially_paid' else 'open' end,updated_at=now() where store_id=new.store_id and purchase_document_id=new.id and status='draft';
   select * into v_p from public.accounts_payable where store_id=new.store_id and purchase_document_id=new.id;
   if v_p.id is not null then perform public._recalculate_accounts_payable(v_p.id); end if;
 end if;
 return null;
end $$;
drop trigger if exists purchase_document_payable_after_write on public.purchase_documents;
create trigger purchase_document_payable_after_write after insert or update of total_amount,status,payment_term_id,payment_method_code,preferred_financial_account_id on public.purchase_documents for each row execute function public.trg_sync_purchase_payable_after_document();
revoke all on function public.trg_sync_purchase_payable_after_document() from public,anon,authenticated;

revoke all on function public.get_accounts_payable_detail_safe(uuid) from public,anon;
revoke all on function public.list_accounts_payable_safe(uuid,text,uuid,date,date,integer,integer) from public,anon;
revoke all on function public.list_purchase_payment_terms_safe(uuid,boolean) from public,anon;
revoke all on function public.upsert_purchase_payment_term_safe(uuid,uuid,text,text,text,integer[],text,boolean,boolean,jsonb) from public,anon;
revoke all on function public.suggest_supplier_payment_term_safe(uuid,uuid) from public,anon;
revoke all on function public.set_purchase_financial_terms_safe(uuid,uuid,text,uuid,text,text) from public,anon;
revoke all on function public.apply_accounts_payable_adjustment_safe(uuid,text,text,numeric,uuid,text) from public,anon;
revoke all on function public.reverse_accounts_payable_adjustment_safe(uuid,text) from public,anon;
revoke all on function public.register_accounts_payable_payment_safe(uuid,numeric,uuid,text,timestamptz,text,text) from public,anon;
revoke all on function public.reverse_accounts_payable_payment_safe(uuid,text) from public,anon;
revoke all on function public.cancel_accounts_payable_safe(uuid,text) from public,anon;
revoke all on function public.set_purchase_quotation_payment_request_safe(uuid,uuid,text) from public,anon;
revoke all on function public.set_purchase_quotation_payment_response_safe(uuid,uuid,text,text) from public,anon;
revoke all on function public.accept_purchase_quotation_payment_terms_safe(uuid,uuid,text) from public,anon;

grant execute on function public.get_accounts_payable_detail_safe(uuid) to authenticated;
grant execute on function public.list_accounts_payable_safe(uuid,text,uuid,date,date,integer,integer) to authenticated;
grant execute on function public.list_purchase_payment_terms_safe(uuid,boolean) to authenticated;
grant execute on function public.upsert_purchase_payment_term_safe(uuid,uuid,text,text,text,integer[],text,boolean,boolean,jsonb) to authenticated;
grant execute on function public.suggest_supplier_payment_term_safe(uuid,uuid) to authenticated;
grant execute on function public.set_purchase_financial_terms_safe(uuid,uuid,text,uuid,text,text) to authenticated;
grant execute on function public.apply_accounts_payable_adjustment_safe(uuid,text,text,numeric,uuid,text) to authenticated;
grant execute on function public.reverse_accounts_payable_adjustment_safe(uuid,text) to authenticated;
grant execute on function public.register_accounts_payable_payment_safe(uuid,numeric,uuid,text,timestamptz,text,text) to authenticated;
grant execute on function public.reverse_accounts_payable_payment_safe(uuid,text) to authenticated;
grant execute on function public.cancel_accounts_payable_safe(uuid,text) to authenticated;
grant execute on function public.set_purchase_quotation_payment_request_safe(uuid,uuid,text) to authenticated;
grant execute on function public.set_purchase_quotation_payment_response_safe(uuid,uuid,text,text) to authenticated;
grant execute on function public.accept_purchase_quotation_payment_terms_safe(uuid,uuid,text) to authenticated;
