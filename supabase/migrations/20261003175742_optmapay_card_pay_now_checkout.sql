-- OptmaMenu ↔ OptmaPay — habilita cartão em "Pagar agora" somente onde o provider Sandbox está pronto.
-- Preserva PIX e não altera lojas sem OptmaPay configurado.

update public.store_payment_methods pm
set metadata = coalesce(pm.metadata,'{}'::jsonb)
  || jsonb_build_object(
    'checkout',
    coalesce(pm.metadata->'checkout','{}'::jsonb)
      || jsonb_build_object(
        'pay_now', true,
        'confirmation_mode','api',
        'integration_enabled',true,
        'provider_code','optma_sandbox'
      )
  ),
  updated_at = now()
where pm.base_code in ('debit_card','credit_card')
  and pm.active = true
  and pm.public_enabled = true
  and exists (
    select 1
    from public.store_online_payment_providers p
    where p.store_id = pm.store_id
      and p.provider_code = 'optma_sandbox'
      and p.environment = 'sandbox'
      and p.enabled = true
      and p.credential_status = 'ready'
      and coalesce((p.capabilities->>pm.base_code)::boolean,false) = true
  );
