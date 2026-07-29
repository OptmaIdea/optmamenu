-- POS_9 — Validacao da RPC confirm_pending_order_payment_safe
--
-- Execute depois de aplicar:
-- supabase/migrations/20260630190500_confirm_pending_order_payment_safe.sql

select
  'function_exists' as section,
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'confirm_pending_order_payment_safe';

select
  'function_grants' as section,
  grantee,
  privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name = 'confirm_pending_order_payment_safe'
order by grantee, privilege_type;

-- Encontre um pedido pendente candidato para teste manual.
select
  'pending_order_candidates' as section,
  o.store_id,
  o.id as order_id,
  o.order_code,
  o.customer_name,
  o.total,
  o.payment_method_code,
  o.payment_method::text as payment_method,
  o.created_at,
  exists (
    select 1
    from public.cashbook_entries ce
    where ce.order_id = o.id
      and ce.store_id = o.store_id
      and ce.type = 'sale'
      and ce.status = 'confirmed'
      and coalesce(ce.affects_balance, true) = true
  ) as already_affects_cashbook
from public.orders o
where coalesce(o.payment_method_code, o.payment_method::text, '') = 'pending'
order by o.created_at desc
limit 20;

-- Exemplo manual, substitua os ids e o metodo:
-- select public.confirm_pending_order_payment_safe(
--   '<store_id>'::uuid,
--   '<order_id>'::uuid,
--   'pix',
--   now(),
--   'Recebimento confirmado manualmente no financeiro',
--   jsonb_build_object('validated_from', 'validate_confirm_pending_order_payment_safe')
-- );
