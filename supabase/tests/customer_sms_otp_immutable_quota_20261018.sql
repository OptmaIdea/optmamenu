-- Run in homologation SQL Editor. No external SMS is sent.
-- Entire test is rolled back; it does not alter any real client or counter.
begin;
do $audit$
declare
  sid uuid;
  x jsonb;
  a jsonb;
  b jsonb;
  c jsonb;
  before_count integer;
  after_count integer;
  hash text;
  stored_id uuid;
  attempt_id bigint;
begin
  select id into sid from public.stores
    where public_store_enabled=true order by slug limit 1;
  if sid is null then raise exception 'INCONCLUSIVE: no public store';end if;

  select count(*) into before_count from public.customer_sms_otp_issue_ledger;
  a:=public.issue_customer_otp_for_sms_safe('62987634210',sid,'sensitive_action');
  b:=public.issue_customer_otp_for_sms_safe('55 62 98763-4210',sid,'sensitive_action');
  c:=public.issue_customer_otp_for_sms_safe('62 98763 4210',sid,'sensitive_action');
  if not coalesce((a->>'ok')::boolean,false)
    or not coalesce((b->>'ok')::boolean,false)
    or not coalesce((c->>'ok')::boolean,false) then
    raise exception 'FAIL: first 3 issuances';
  end if;
  stored_id:=(a->>'otp_id')::uuid;
  update public.customer_otps
    set phone='5562999910101',created_at=now()-interval '30 days'
    where id=stored_id;
  x:=public.issue_customer_otp_for_sms_safe('6287634210',sid,'sensitive_action');
  if x->>'error'<>'rate_limited' then
    raise exception 'FAIL: edited operational OTP bypassed 3/10 limit';
  end if;
  select id into attempt_id from public.customer_sms_otp_issue_ledger
    where otp_id=stored_id;
  if attempt_id is null then raise exception 'FAIL: no ledger event';end if;

  begin
    update public.customer_sms_otp_issue_ledger set issued_at=now()-interval '2 days'
      where id=attempt_id;
    raise exception 'FAIL: ledger UPDATE succeeded';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise;end if;
  end;
  begin
    delete from public.customer_sms_otp_issue_ledger where id=attempt_id;
    raise exception 'FAIL: ledger DELETE succeeded';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise;end if;
  end;

  hash:=public.customer_sms_otp_digest_internal('62981234098');
  insert into public.customer_sms_otp_issue_ledger(
    otp_id,store_id,phone_digest,issued_at,purpose,source)
  select gen_random_uuid(),sid,hash,now()-interval '12 minutes'
      - (i*interval '1 minute'),'login','legacy_backfill'
  from generate_series(1,10) i;
  x:=public.issue_customer_otp_for_sms_safe('62981234098',sid,'sensitive_action');
  if x->>'error'<>'daily_limit_reached' then
    raise exception 'FAIL: mutable OTP bypassed 10/24h quota';
  end if;

  if has_function_privilege('anon',
      'public.issue_customer_otp_for_sms_safe(text,uuid,text)','EXECUTE')
    or has_function_privilege('authenticated',
      'public.issue_customer_otp_for_sms_safe(text,uuid,text)','EXECUTE')
    or has_table_privilege('service_role',
      'public.customer_sms_otp_issue_ledger','SELECT')
    or has_table_privilege('service_role',
      'public.customer_sms_otp_issue_ledger','UPDATE')
    or has_table_privilege('service_role',
      'public.customer_sms_otp_rate_secret','SELECT') then
    raise exception 'FAIL: inappropriate direct privilege';
  end if;
  if not exists(select 1 from cron.job
    where jobname='customer-sms-otp-ledger-prune-90d' and active) then
    raise exception 'FAIL: audit-retention cron disabled';
  end if;
  select count(*) into after_count from public.customer_sms_otp_issue_ledger;
  if after_count<before_count+13 then raise exception 'FAIL: missing audit receipts';end if;
end $audit$;
select 'PASS: 3/10m, 10/24h, phone normalization, tamper resistance, grants, retention' result;
rollback;
