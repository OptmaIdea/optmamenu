-- Homologação OptmaMenu — PIX antecipado com comprovante e revisão manual
-- Somente leitura.

-- 1) Comprovantes confirmados devem apontar para pedido pago, CXA confirmado e conta financeira.
select
  s.name as store_name,
  o.order_code,
  p.id as proof_id,
  p.status as proof_status,
  o.status::text as order_status,
  o.payment_status,
  p.cashbook_entry_id,
  ce.entry_code,
  ce.status as cashbook_status,
  ce.amount as cashbook_amount,
  o.total as order_total,
  p.financial_account_id,
  ce.destination_financial_account_id,
  case
    when p.status = 'confirmed'
      and o.payment_status = 'paid'
      and ce.id = p.cashbook_entry_id
      and ce.status = 'confirmed'
      and ce.affects_balance = true
      and ce.type = 'sale'
      and ce.direction = 'in'
      and abs(ce.amount - o.total) <= 0.009
      and p.financial_account_id = ce.destination_financial_account_id
    then 'ok'
    else 'mismatch'
  end as audit_state
from public.order_payment_proofs p
join public.orders o on o.id = p.order_id and o.store_id = p.store_id
join public.stores s on s.id = p.store_id
left join public.cashbook_entries ce on ce.id = p.cashbook_entry_id
where p.status = 'confirmed'
order by p.created_at desc;

-- 2) Nenhum comprovante confirmado pode pertencer a pedido cancelado/expirado.
select
  count(*) as confirmed_proofs_on_inactive_orders
from public.order_payment_proofs p
join public.orders o on o.id = p.order_id and o.store_id = p.store_id
where p.status = 'confirmed'
  and o.status::text in ('cancelled','expired');

-- 3) Confirmações incompletas são erro de integridade.
select
  count(*) as incomplete_confirmed_proofs
from public.order_payment_proofs p
where p.status = 'confirmed'
  and (p.cashbook_entry_id is null or p.financial_account_id is null or p.decided_at is null or p.decided_by is null);

-- 4) Bucket precisa permanecer privado e com limite/MIME controlados.
select
  id,
  public,
  file_size_limit,
  allowed_mime_types
from storage.buckets
where id = 'order-payment-proofs';

-- 5) Boundary: anon usa somente ticket/finalização/estado público; revisão administrativa permanece fechada.
select
  has_table_privilege('anon','public.order_payment_proofs','SELECT') as proof_table_anon_select,
  has_table_privilege('authenticated','public.order_payment_proofs','INSERT') as proof_table_authenticated_insert,
  has_function_privilege('anon','public.create_public_order_payment_proof_ticket(text,text,text,numeric,timestamptz)','EXECUTE') as public_ticket_anon,
  has_function_privilege('anon','public.finalize_public_order_payment_proof(text,uuid)','EXECUTE') as public_finalize_anon,
  has_function_privilege('anon','public.get_public_order_payment_proof_state(text)','EXECUTE') as public_state_anon,
  has_function_privilege('anon','public.get_order_payment_proofs_safe(uuid,uuid)','EXECUTE') as admin_list_anon,
  has_function_privilege('anon','public.review_order_payment_proof_safe(uuid,uuid,text,uuid,text)','EXECUTE') as admin_review_anon,
  has_function_privilege('authenticated','public.review_order_payment_proof_safe(uuid,uuid,text,uuid,text)','EXECUTE') as admin_review_authenticated;

-- 6) Upload tickets vencidos ainda pendentes: devem tender a zero; são convertidos para expired ao próximo ticket do pedido.
select count(*) as stale_upload_tickets
from public.order_payment_proofs
where status = 'upload_pending'
  and upload_expires_at <= now();
