-- OptmaMenu ↔ OptmaPay — habilitação server-side dos métodos de cartão.
-- Mantém pay_now atual da UI; apenas liga os métodos existentes ao provider optma_sandbox.

update public.store_payment_methods pm
set metadata = coalesce(pm.metadata,'{}'::jsonb)
  || jsonb_build_object(
    'checkout',
    coalesce(pm.metadata->'checkout','{}'::jsonb)
      || jsonb_build_object(
        'confirmation_mode','api',
        'integration_enabled',true,
        'provider_code','optma_sandbox'
      )
  ),
  updated_at=now()
where pm.base_code in ('debit_card','credit_card')
  and exists (
    select 1
    from public.store_online_payment_providers p
    where p.store_id=pm.store_id
      and p.provider_code='optma_sandbox'
      and p.environment='sandbox'
      and p.enabled=true
      and p.credential_status='ready'
  );

update public.store_online_payment_providers p
set public_config=coalesce(p.public_config,'{}'::jsonb)
  || jsonb_build_object(
    'card_settlement_plan',
    coalesce(nullif(p.public_config->>'card_settlement_plan',''),'standard')
  ),
  updated_at=now()
where p.provider_code='optma_sandbox'
  and p.environment='sandbox';
