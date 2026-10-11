
select public.set_financial_account_routing_safe(
  '0abba741-0f77-4783-8cf8-58811cf7343b'::uuid,
  '970af23c-6c8a-478d-83b1-7415f0deac32'::uuid,
  array(
    select code
    from public.store_payment_methods
    where store_id='0abba741-0f77-4783-8cf8-58811cf7343b'::uuid
      and active=true
      and code<>'debit_card_debito_infinitepay'
    order by sort_order,code
  ),
  true
);

delete from public.store_financial_account_payment_methods
where store_id='0abba741-0f77-4783-8cf8-58811cf7343b'::uuid
  and payment_method_code='debit_card_debito_infinitepay';
