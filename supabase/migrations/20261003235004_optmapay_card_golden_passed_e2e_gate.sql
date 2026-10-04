
update public.store_payment_methods m
set metadata = jsonb_set(
  jsonb_set(
    coalesce(m.metadata,'{}'::jsonb),
    '{checkout,pay_now}',
    'false'::jsonb,
    true
  ),
  '{checkout,card_public_release_state}',
  '"golden_passed_pending_e2e"'::jsonb,
  true
)
where m.code in ('debit_card','credit_card')
  and coalesce(m.metadata #>> '{checkout,provider_code}','')='optma_sandbox'
  and coalesce((m.metadata #>> '{checkout,integration_enabled}')::boolean,false)=true;
