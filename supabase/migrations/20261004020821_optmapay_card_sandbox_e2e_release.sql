
update public.store_payment_methods m
set metadata = jsonb_set(
  jsonb_set(
    coalesce(m.metadata, '{}'::jsonb),
    '{checkout,pay_now}',
    'true'::jsonb,
    true
  ),
  '{checkout,card_public_release_state}',
  '"e2e_approved_sandbox"'::jsonb,
  true
)
where m.store_id = '0abba741-0f77-4783-8cf8-58811cf7343b'::uuid
  and m.code in ('debit_card','credit_card')
  and m.active = true
  and m.public_enabled = true
  and coalesce(m.metadata #>> '{checkout,provider_code}','') = 'optma_sandbox'
  and coalesce((m.metadata #>> '{checkout,integration_enabled}')::boolean,false) = true
  and coalesce(m.metadata #>> '{checkout,confirmation_mode}','') = 'api';

update public.store_payment_methods m
set metadata = jsonb_set(
  coalesce(m.metadata, '{}'::jsonb),
  '{checkout,card_public_release_state}',
  '"blocked_legacy_method"'::jsonb,
  true
)
where m.store_id = '0abba741-0f77-4783-8cf8-58811cf7343b'::uuid
  and m.code = 'debit_card_debito_infinitepay'
  and m.public_enabled = false;
