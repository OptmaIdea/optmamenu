
update public.cashbook_entries
set metadata =
  (coalesce(metadata,'{}'::jsonb)
    - 'financial_account_id'
    - 'preferred_financial_account_id'
    - 'financial_account_reclassification_reason'
    - 'rerouted_reason'
    - 'legacy_asaas_account_removed'
    - 'legacy_asaas_account_removed_at')
  || jsonb_build_object(
    'legacy_route_removed',true,
    'legacy_route_removed_at',now(),
    'destination_financial_account_id','970af23c-6c8a-478d-83b1-7415f0deac32'
  ),
  updated_at=now()
where store_id='0abba741-0f77-4783-8cf8-58811cf7343b'::uuid
  and lower(coalesce(metadata,'{}'::jsonb)::text) like '%asaas%';

delete from public.order_payment_proofs
where store_id='0abba741-0f77-4783-8cf8-58811cf7343b'::uuid
  and lower(coalesce(metadata,'{}'::jsonb)::text) like '%asaas%';

update public.store_payment_methods
set metadata=coalesce(metadata,'{}'::jsonb)-'provider_code'-'asaas',
    updated_at=now()
where store_id='0abba741-0f77-4783-8cf8-58811cf7343b'::uuid
  and lower(coalesce(metadata,'{}'::jsonb)::text) like '%asaas%';
