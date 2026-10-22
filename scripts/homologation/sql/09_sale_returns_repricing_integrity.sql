-- Homologação OptmaMenu — devoluções, reprecificação e estornos
-- Somente leitura. Valida integridade financeira/operacional das reversões pós-venda.

-- 1) Resumo por loja: ajustes concluídos, valor estornado e paridade com Livro Diário.
with adjustment_totals as (
  select sa.store_id,
         sa.order_id,
         count(*) filter (where sa.status = 'completed') as adjustment_count,
         coalesce(sum(sa.refund_amount) filter (where sa.status = 'completed'), 0) as adjustment_refund_total
  from public.sale_adjustments sa
  group by sa.store_id, sa.order_id
), cashbook_totals as (
  select ce.store_id,
         ce.order_id,
         coalesce(sum(ce.amount) filter (
           where ce.status = 'confirmed'
             and ce.affects_balance = true
             and ce.type = 'refund'
             and ce.direction = 'out'
         ), 0) as cashbook_refund_total
  from public.cashbook_entries ce
  where ce.order_id is not null
  group by ce.store_id, ce.order_id
)
select s.name as store_name,
       count(*) filter (where a.adjustment_count > 0) as orders_with_adjustments,
       sum(a.adjustment_count) as completed_adjustments,
       round(sum(a.adjustment_refund_total), 2) as adjustment_refund_total,
       round(sum(coalesce(c.cashbook_refund_total, 0)), 2) as cashbook_refund_total,
       count(*) filter (where abs(a.adjustment_refund_total - coalesce(c.cashbook_refund_total, 0)) > 0.009) as refund_finance_mismatch
from adjustment_totals a
join public.stores s on s.id = a.store_id
left join cashbook_totals c on c.store_id = a.store_id and c.order_id = a.order_id
group by s.id, s.name
order by s.name;

-- 2) Exceções: ajuste concluído sem estorno financeiro correspondente ou com valor divergente.
with adjustment_totals as (
  select sa.store_id,
         sa.order_id,
         coalesce(sum(sa.refund_amount) filter (where sa.status = 'completed'), 0) as adjustment_refund_total
  from public.sale_adjustments sa
  group by sa.store_id, sa.order_id
), cashbook_totals as (
  select ce.store_id,
         ce.order_id,
         coalesce(sum(ce.amount) filter (
           where ce.status = 'confirmed'
             and ce.affects_balance = true
             and ce.type = 'refund'
             and ce.direction = 'out'
         ), 0) as cashbook_refund_total
  from public.cashbook_entries ce
  where ce.order_id is not null
  group by ce.store_id, ce.order_id
)
select s.name as store_name,
       o.order_code,
       a.adjustment_refund_total,
       coalesce(c.cashbook_refund_total, 0) as cashbook_refund_total,
       round(a.adjustment_refund_total - coalesce(c.cashbook_refund_total, 0), 2) as difference
from adjustment_totals a
join public.orders o on o.id = a.order_id and o.store_id = a.store_id
join public.stores s on s.id = a.store_id
left join cashbook_totals c on c.store_id = a.store_id and c.order_id = a.order_id
where abs(a.adjustment_refund_total - coalesce(c.cashbook_refund_total, 0)) > 0.009
order by s.name, o.order_code;

-- 3) Devoluções parciais novas devem preservar a cotação de reprecificação no metadata.
-- Registros anteriores ao rollout aparecem como legado e não são reescritos automaticamente.
select s.name as store_name,
       o.order_code,
       sa.id as adjustment_id,
       sa.created_at,
       sa.refund_amount,
       case
         when sa.metadata ? 'partial_return_quote' then 'repriced_snapshot'
         else 'legacy_without_repricing_snapshot'
       end as pricing_audit_state,
       sa.metadata->>'pricing_recalculation_adjustment' as pricing_recalculation_adjustment,
       sa.metadata->>'refund_payment_method_name' as refund_payment_method_name
from public.sale_adjustments sa
join public.orders o on o.id = sa.order_id and o.store_id = sa.store_id
join public.stores s on s.id = sa.store_id
where sa.adjustment_type = 'partial_return'
  and sa.status = 'completed'
order by sa.created_at desc;

-- 4) Ajustes V2 que registram forma de devolução devem ter Livro Diário com a mesma forma e conta.
select s.name as store_name,
       o.order_code,
       sa.id as adjustment_id,
       sa.refund_amount,
       sa.metadata->>'refund_payment_method_code' as adjustment_method,
       sa.metadata->>'refund_account_id' as adjustment_account,
       ce.entry_code,
       ce.amount as cashbook_amount,
       ce.payment_method_code as cashbook_method,
       ce.source_financial_account_id as cashbook_source_account,
       case
         when abs(sa.refund_amount - ce.amount) <= 0.009
          and coalesce(sa.metadata->>'refund_payment_method_code', '') = coalesce(ce.payment_method_code, '')
          and coalesce(sa.metadata->>'refund_account_id', '') = coalesce(ce.source_financial_account_id::text, '')
         then 'ok'
         else 'mismatch'
       end as audit_state
from public.sale_adjustments sa
join public.orders o on o.id = sa.order_id and o.store_id = sa.store_id
join public.stores s on s.id = sa.store_id
left join lateral (
  select e.*
  from public.cashbook_entries e
  where e.store_id = sa.store_id
    and e.order_id = sa.order_id
    and e.type = 'refund'
    and e.direction = 'out'
    and e.status = 'confirmed'
    and e.affects_balance = true
    and e.created_at >= sa.created_at - interval '5 seconds'
  order by abs(extract(epoch from (e.created_at - sa.created_at))) asc
  limit 1
) ce on true
where sa.status = 'completed'
  and sa.metadata ? 'refund_payment_method_code'
order by sa.created_at desc;

-- 5) Boundary das RPCs novas: anon não executa; authenticated somente pela autorização interna das funções.
select
  has_function_privilege('anon', 'public.quote_completed_sale_partial_return_safe(uuid,uuid,jsonb)', 'EXECUTE') as quote_anon,
  has_function_privilege('authenticated', 'public.quote_completed_sale_partial_return_safe(uuid,uuid,jsonb)', 'EXECUTE') as quote_authenticated,
  has_function_privilege('anon', 'public.adjust_completed_sale_v2_safe(uuid,uuid,text,text,text,jsonb,uuid,text)', 'EXECUTE') as adjust_v2_anon,
  has_function_privilege('authenticated', 'public.adjust_completed_sale_v2_safe(uuid,uuid,text,text,text,jsonb,uuid,text)', 'EXECUTE') as adjust_v2_authenticated;
