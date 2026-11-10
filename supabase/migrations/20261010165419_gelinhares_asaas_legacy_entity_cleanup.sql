
update public.cashbook_entries
set source_financial_account_id=case
      when source_financial_account_id='822a88c1-434d-46d3-8b63-e4d527cfac55'::uuid
      then '970af23c-6c8a-478d-83b1-7415f0deac32'::uuid
      else source_financial_account_id
    end,
    destination_financial_account_id=case
      when destination_financial_account_id='822a88c1-434d-46d3-8b63-e4d527cfac55'::uuid
      then '970af23c-6c8a-478d-83b1-7415f0deac32'::uuid
      else destination_financial_account_id
    end,
    updated_at=now()
where store_id='0abba741-0f77-4783-8cf8-58811cf7343b'::uuid
  and (
    source_financial_account_id='822a88c1-434d-46d3-8b63-e4d527cfac55'::uuid
    or destination_financial_account_id='822a88c1-434d-46d3-8b63-e4d527cfac55'::uuid
  );

update public.store_order_payment_account_routes
set destination_financial_account_id='970af23c-6c8a-478d-83b1-7415f0deac32'::uuid,
    updated_at=now()
where store_id='0abba741-0f77-4783-8cf8-58811cf7343b'::uuid
  and destination_financial_account_id='822a88c1-434d-46d3-8b63-e4d527cfac55'::uuid;

delete from public.order_payment_proofs
where store_id='0abba741-0f77-4783-8cf8-58811cf7343b'::uuid
  and financial_account_id='822a88c1-434d-46d3-8b63-e4d527cfac55'::uuid;

delete from public.store_financial_accounts
where id='822a88c1-434d-46d3-8b63-e4d527cfac55'::uuid
  and store_id='0abba741-0f77-4783-8cf8-58811cf7343b'::uuid;

delete from public.online_payment_events
where provider_id='1f1d29b2-f447-4293-8039-21d4fc95be2f'::uuid;

delete from public.online_payment_refunds
where provider_id='1f1d29b2-f447-4293-8039-21d4fc95be2f'::uuid;

delete from public.online_payment_receivables
where provider_id='1f1d29b2-f447-4293-8039-21d4fc95be2f'::uuid;

delete from public.online_payment_intents
where provider_id='1f1d29b2-f447-4293-8039-21d4fc95be2f'::uuid;

delete from public.store_online_payment_providers
where id='1f1d29b2-f447-4293-8039-21d4fc95be2f'::uuid
  and store_id='0abba741-0f77-4783-8cf8-58811cf7343b'::uuid;
