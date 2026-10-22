-- Gate de release: mantém cartão fora do "Pagar agora" enquanto Golden Debit/Credit do OptmaPay não estiver homologado.
-- Não desliga o adapter server-side; apenas evita expor ao cliente um fluxo ainda incompleto.

update public.store_payment_methods pm
set metadata = coalesce(pm.metadata,'{}'::jsonb)
  || jsonb_build_object(
    'checkout',
    coalesce(pm.metadata->'checkout','{}'::jsonb)
      || jsonb_build_object(
        'pay_now', false,
        'card_public_release_state','blocked_pending_optmapay_golden'
      )
  ),
  updated_at=now()
where pm.base_code in ('debit_card','credit_card')
  and pm.metadata->'checkout'->>'provider_code'='optma_sandbox';
