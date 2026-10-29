
update public.online_payment_receivables r
set expected_settlement_at = (
  (r.expected_settlement_at at time zone 'UTC')::date::timestamp
  + time '06:00'
) at time zone 'America/Sao_Paulo',
updated_at = now()
from public.store_online_payment_providers p
where r.provider_id = p.id
  and p.provider_code = 'optma_sandbox'
  and p.environment = 'sandbox'
  and r.status in ('receivable','scheduled')
  and r.settled_at is null
  and r.expected_settlement_at is not null
  and extract(hour from (r.expected_settlement_at at time zone 'UTC')) = 0
  and r.settlement_plan in ('standard','d1','d7','d15','due_date');
