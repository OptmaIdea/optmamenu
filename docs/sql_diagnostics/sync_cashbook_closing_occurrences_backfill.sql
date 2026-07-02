-- POS_9 — Diagnóstico/Backfill — Sincronizar ocorrências de fechamento divergente
--
-- Use quando um fechamento já aparece no histórico com divergência,
-- mas `list_cashbook_closing_occurrences_safe` ainda retorna items vazio.
--
-- 1) Ver fechamentos divergentes sem ocorrência
select
  'divergent_closings_without_occurrence_before' as section,
  c.id as closing_id,
  c.closing_date,
  c.status,
  c.expected_total,
  c.confirmed_total,
  c.difference_total,
  c.metadata ->> 'has_divergence' as has_divergence,
  c.metadata ->> 'divergence_type' as divergence_type,
  c.metadata ->> 'divergence_level' as divergence_level,
  c.metadata ->> 'occurrence_required' as occurrence_required,
  c.notes
from public.cashbook_day_closings c
left join public.cashbook_closing_occurrences occ on occ.closing_id = c.id
where (
    coalesce((c.metadata ->> 'has_divergence')::boolean, false) = true
    or abs(coalesce(c.difference_total, 0)) >= 0.01
  )
  and coalesce((c.metadata ->> 'occurrence_required')::boolean, true) = true
  and occ.id is null
order by c.closing_date desc;

-- 2) Backfill idempotente
insert into public.cashbook_closing_occurrences (
  store_id,
  closing_id,
  closing_date,
  status,
  divergence_type,
  divergence_level,
  expected_total,
  confirmed_total,
  difference_total,
  difference_cash,
  difference_pix,
  difference_debit_card,
  difference_credit_card,
  difference_other,
  opening_notes,
  created_by,
  metadata
)
select
  c.store_id,
  c.id,
  c.closing_date,
  'open',
  coalesce(nullif(c.metadata ->> 'divergence_type', ''), case when c.difference_total < 0 then 'shortage' else 'surplus' end),
  coalesce(nullif(c.metadata ->> 'divergence_level', ''), case when abs(c.difference_total) <= 2 then 'low' when abs(c.difference_total) <= 20 then 'relevant' else 'critical' end),
  coalesce(c.expected_total, 0),
  coalesce(c.confirmed_total, 0),
  coalesce(c.difference_total, 0),
  coalesce(c.difference_cash, 0),
  coalesce(c.difference_pix, 0),
  coalesce(c.difference_debit_card, 0),
  coalesce(c.difference_credit_card, 0),
  coalesce(c.difference_other, 0),
  c.notes,
  coalesce(c.closed_by, c.created_by),
  jsonb_build_object(
    'source', 'manual_backfill_sync_cashbook_closing_occurrences',
    'closing_metadata', coalesce(c.metadata, '{}'::jsonb),
    'backfilled_at', now()
  )
from public.cashbook_day_closings c
where (
    coalesce((c.metadata ->> 'has_divergence')::boolean, false) = true
    or abs(coalesce(c.difference_total, 0)) >= 0.01
  )
  and coalesce((c.metadata ->> 'occurrence_required')::boolean, true) = true
on conflict (closing_id) do update set
  store_id = excluded.store_id,
  closing_date = excluded.closing_date,
  divergence_type = excluded.divergence_type,
  divergence_level = excluded.divergence_level,
  expected_total = excluded.expected_total,
  confirmed_total = excluded.confirmed_total,
  difference_total = excluded.difference_total,
  difference_cash = excluded.difference_cash,
  difference_pix = excluded.difference_pix,
  difference_debit_card = excluded.difference_debit_card,
  difference_credit_card = excluded.difference_credit_card,
  difference_other = excluded.difference_other,
  opening_notes = excluded.opening_notes,
  metadata = coalesce(public.cashbook_closing_occurrences.metadata, '{}'::jsonb) || jsonb_build_object(
    'last_manual_backfill_at', now(),
    'closing_metadata', excluded.metadata -> 'closing_metadata'
  ),
  updated_at = now();

-- 3) Conferir ocorrências após backfill
select
  'occurrences_after_backfill' as section,
  public.list_cashbook_closing_occurrences_safe(
    '0abba741-0f77-4783-8cf8-58811cf7343b'::uuid,
    null,
    50
  ) as result;

-- 4) Contagem por status
select
  'count_by_status_after_backfill' as section,
  status,
  count(*) as total
from public.cashbook_closing_occurrences
where store_id = '0abba741-0f77-4783-8cf8-58811cf7343b'::uuid
 group by status
 order by status;
