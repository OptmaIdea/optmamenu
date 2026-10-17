
update public.store_financial_accounts
set is_default=false, updated_at=now()
where store_id='0abba741-0f77-4783-8cf8-58811cf7343b'::uuid
  and id<>'970af23c-6c8a-478d-83b1-7415f0deac32'::uuid
  and is_default=true;

update public.store_financial_account_payment_methods apm
set active=false, updated_at=now()
where apm.store_id='0abba741-0f77-4783-8cf8-58811cf7343b'::uuid
  and (
    exists (
      select 1 from public.store_financial_accounts a
      where a.id=apm.account_id
        and a.store_id=apm.store_id
        and (
          a.active=false
          or (
            coalesce((a.metadata->>'hidden_from_workspace')::boolean,false)=true
            and coalesce((a.metadata->>'internal_clearing')::boolean,false)=false
          )
        )
    )
    or exists (
      select 1 from public.store_payment_methods pm
      where pm.store_id=apm.store_id
        and pm.code=apm.payment_method_code
        and (pm.active=false or pm.code='pending')
    )
  );

insert into public.store_financial_account_payment_methods(
  store_id,account_id,payment_method_code,active,created_at,updated_at
)
select
  pm.store_id,
  '970af23c-6c8a-478d-83b1-7415f0deac32'::uuid,
  pm.code,
  true,
  now(),
  now()
from public.store_payment_methods pm
where pm.store_id='0abba741-0f77-4783-8cf8-58811cf7343b'::uuid
  and pm.active=true
  and pm.code<>'pending'
  and pm.affects_cashbook=true
on conflict (account_id,payment_method_code)
do update set active=true,updated_at=now();

insert into public.store_financial_account_payment_methods(
  store_id,account_id,payment_method_code,active,created_at,updated_at
) values (
  '0abba741-0f77-4783-8cf8-58811cf7343b'::uuid,
  '558c94f0-3080-4236-a975-83e90cfaf71d'::uuid,
  'cash',true,now(),now()
)
on conflict (account_id,payment_method_code)
do update set active=true,updated_at=now();
