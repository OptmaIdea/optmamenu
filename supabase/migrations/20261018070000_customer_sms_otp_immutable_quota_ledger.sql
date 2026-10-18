begin;

-- Kept separate from the operational customer_otps table by design.
-- A DB administrator may edit an OTP row; this cannot rewrite prior attempt counts.
create table public.customer_sms_otp_rate_secret (
  id integer primary key default 1 check(id=1),
  pepper bytea not null
);
insert into public.customer_sms_otp_rate_secret(id,pepper) values(1,gen_random_bytes(32));

create table public.customer_sms_otp_issue_ledger (
  id bigint generated always as identity primary key,
  otp_id uuid not null unique,
  store_id uuid not null references public.stores(id),
  phone_digest text not null check(length(phone_digest)=64),
  issued_at timestamptz not null,
  purpose text not null,
  source text not null check(source in ('issued','legacy_backfill'))
);
create index customer_sms_otp_issue_ledger_phone_time_idx
  on public.customer_sms_otp_issue_ledger(phone_digest,issued_at desc);
create index customer_sms_otp_issue_ledger_store_phone_time_idx
  on public.customer_sms_otp_issue_ledger(store_id,phone_digest,issued_at desc);

alter table public.customer_sms_otp_rate_secret enable row level security;
alter table public.customer_sms_otp_issue_ledger enable row level security;
revoke all on public.customer_sms_otp_rate_secret,public.customer_sms_otp_issue_ledger
  from public,anon,authenticated,service_role;
revoke all on sequence public.customer_sms_otp_issue_ledger_id_seq
  from public,anon,authenticated,service_role;

create or replace function public.customer_sms_otp_digest_internal(p_phone text)
returns text language plpgsql security definer
set search_path to 'public','extensions','pg_temp'
as $digest$
declare
  v_norm jsonb;
  v_key text;
  v_pepper bytea;
begin
  v_norm:=public.normalize_br_customer_phone(p_phone);
  if not coalesce((v_norm->>'valid')::boolean,false) then
    return null;
  end if;
  v_key:=nullif(v_norm->>'match_key','');
  if v_key is null then return null;end if;
  select pepper into v_pepper from public.customer_sms_otp_rate_secret where id=1;
  if v_pepper is null then raise exception 'otp_quota_secret_missing';end if;
  return encode(hmac(convert_to(v_key,'UTF8'),v_pepper,'sha256'),'hex');
end;
$digest$;
revoke all on function public.customer_sms_otp_digest_internal(text)
  from public,anon,authenticated,service_role;

-- Legacy events are imported best-effort from the existing mutable source.
-- A historical manual edit cannot be forensically reconstructed here.
insert into public.customer_sms_otp_issue_ledger(otp_id,store_id,phone_digest,issued_at,purpose,source)
select co.id,co.store_id,
       public.customer_sms_otp_digest_internal(co.phone),
       co.created_at,coalesce(co.purpose,'login'),'legacy_backfill'
from public.customer_otps co
where co.created_at >= clock_timestamp()-interval '24 hours'
  and co.created_at <= clock_timestamp()
  and public.customer_sms_otp_digest_internal(co.phone) is not null
on conflict(otp_id) do nothing;

create or replace function public.customer_sms_otp_rate_check_safe(
  p_store_id uuid,p_phone text
) returns jsonb language plpgsql security definer
set search_path to 'public','extensions','pg_temp'
as $check$
declare
  v_digest text;
  v_now timestamptz;
  v_ten_store integer;
  v_day_store integer;
  v_ten_global integer;
  v_day_global integer;
  v_retry integer;
begin
  if p_store_id is null then return jsonb_build_object('ok',false,'error','invalid_request');end if;
  v_digest:=public.customer_sms_otp_digest_internal(p_phone);
  if v_digest is null then return jsonb_build_object('ok',false,'error','invalid_phone');end if;
  -- Global phone lock: all stores and concurrent RPCs serialize for one canonical number.
  perform pg_advisory_xact_lock(hashtextextended('optmamenu:customer-sms-otp:'||v_digest,0));
  v_now:=clock_timestamp();
  select count(*) filter(where store_id=p_store_id and issued_at>=v_now-interval '10 minutes'),
         count(*) filter(where store_id=p_store_id),
         count(*) filter(where issued_at>=v_now-interval '10 minutes'),
         count(*)
    into v_ten_store,v_day_store,v_ten_global,v_day_global
  from public.customer_sms_otp_issue_ledger
  where phone_digest=v_digest and issued_at>=v_now-interval '24 hours';

  -- Existing store-specific limits remain 3/10m and 10/24h.
  -- Defense against multiplying SMS attempts across stores: 6/10m and 20/24h globally.
  if v_ten_store>=3 or v_ten_global>=6 then
    select greatest(1,ceil(extract(epoch from (
      min(issued_at) filter(where issued_at>=v_now-interval '10 minutes')
       +interval '10 minutes'-v_now)))::integer)
    into v_retry
    from public.customer_sms_otp_issue_ledger
    where phone_digest=v_digest and issued_at>=v_now-interval '10 minutes'
      and (v_ten_global>=6 or store_id=p_store_id);
    return jsonb_build_object('ok',false,'error','rate_limited','retry_after_seconds',coalesce(v_retry,600));
  end if;
  if v_day_store>=10 or v_day_global>=20 then
    select greatest(1,ceil(extract(epoch from (min(issued_at)+interval '24 hours'-v_now)))::integer)
      into v_retry from public.customer_sms_otp_issue_ledger
    where phone_digest=v_digest and issued_at>=v_now-interval '24 hours'
      and (v_day_global>=20 or store_id=p_store_id);
    return jsonb_build_object('ok',false,'error','daily_limit_reached','retry_after_seconds',coalesce(v_retry,86400));
  end if;
  return jsonb_build_object('ok',true);
end;
$check$;
revoke all on function public.customer_sms_otp_rate_check_safe(uuid,text)
  from public,anon,authenticated,service_role;

-- Every insertion (including legacy send_customer_otp) is accounted for.
-- BEFORE INSERT makes the issue receipt and the OTP record one atomic transaction.
create or replace function public.customer_sms_otp_ledger_on_issue()
returns trigger language plpgsql security definer
set search_path to 'public','extensions','pg_temp'
as $trg$
declare
  v_decision jsonb;
  v_digest text;
begin
  v_decision:=public.customer_sms_otp_rate_check_safe(new.store_id,new.phone);
  if not coalesce((v_decision->>'ok')::boolean,false) then
    raise exception 'sms_otp_quota_rejected: %',v_decision->>'error'
      using errcode='P0001';
  end if;
  v_digest:=public.customer_sms_otp_digest_internal(new.phone);
  insert into public.customer_sms_otp_issue_ledger(
    otp_id,store_id,phone_digest,issued_at,purpose,source
  ) values(new.id,new.store_id,v_digest,clock_timestamp(),new.purpose,'issued');
  return new;
end;
$trg$;
revoke all on function public.customer_sms_otp_ledger_on_issue()
  from public,anon,authenticated,service_role;

create trigger customer_sms_otp_record_issue
before insert on public.customer_otps
for each row execute function public.customer_sms_otp_ledger_on_issue();

-- No operational role can update a historical quota receipt.
create or replace function public.customer_sms_otp_ledger_immutable()
returns trigger language plpgsql
set search_path to 'public','pg_temp'
as $immutable$
begin
  if tg_op='DELETE'
     and current_setting('app.customer_sms_otp_retention_prune',true)='yes'
  then return old;end if;
  raise exception 'sms_otp_ledger_is_immutable';
end;
$immutable$;
revoke all on function public.customer_sms_otp_ledger_immutable()
  from public,anon,authenticated,service_role;
create trigger customer_sms_otp_ledger_no_mutation
before update or delete on public.customer_sms_otp_issue_ledger
for each row execute function public.customer_sms_otp_ledger_immutable();
create trigger customer_sms_otp_ledger_no_truncate
before truncate on public.customer_sms_otp_issue_ledger
for each statement execute function public.customer_sms_otp_ledger_immutable();

-- Retain 90d of pseudonymized audit data without storing phone numbers or codes.
create or replace function public.customer_sms_otp_ledger_prune_90d()
returns integer language plpgsql security definer
set search_path to 'public','pg_temp'
as $retention$
declare v_deleted integer;
begin
  perform set_config('app.customer_sms_otp_retention_prune','yes',true);
  delete from public.customer_sms_otp_issue_ledger
  where issued_at<clock_timestamp()-interval '90 days';
  get diagnostics v_deleted=row_count;
  perform set_config('app.customer_sms_otp_retention_prune','no',true);
  return v_deleted;
end;
$retention$;
revoke all on function public.customer_sms_otp_ledger_prune_90d()
  from public,anon,authenticated,service_role;

-- Harden the primary issuing path: count the immutable ledger, not OTP rows.
CREATE OR REPLACE FUNCTION public.issue_customer_otp_for_sms_safe(p_phone text, p_store_id uuid, p_purpose text DEFAULT 'login'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_norm jsonb;
  v_phone text;
  v_match text;
  v_purpose text := lower(trim(coalesce(p_purpose,'login')));
  v_entropy bytea;
  v_random_number bigint;
  v_otp text;
  v_hash text;
  v_expires_at timestamptz;
  v_recent_count integer;
  v_daily_count integer;
  v_otp_id uuid;
  v_customer_exists boolean := false;
  v_quota jsonb;
begin
  if p_store_id is null then
    return jsonb_build_object('ok',false,'error','invalid_request');
  end if;

  if v_purpose not in (
    'login','registration','password_reset','profile_change',
    'phone_change','sensitive_action','account_delete'
  ) then
    return jsonb_build_object('ok',false,'error','invalid_purpose');
  end if;

  if not exists (
    select 1 from public.stores s
    where s.id=p_store_id and s.public_store_enabled=true
  ) then
    return jsonb_build_object('ok',false,'error','store_unavailable');
  end if;

  v_norm:=public.normalize_br_customer_phone(p_phone);
  if coalesce((v_norm->>'valid')::boolean,false)=false then
    return jsonb_build_object('ok',false,'error','invalid_phone');
  end if;

  v_phone:=nullif(v_norm->>'e164','');
  v_match:=nullif(v_norm->>'match_key','');
  if v_phone is null or v_match is null then
    return jsonb_build_object('ok',false,'error','invalid_phone');
  end if;

  select exists(
    select 1
    from public.customers c
    where c.store_id=p_store_id
      and c.phone_match_key=v_match
      and coalesce(c.status,'active')='active'
      and c.merged_into_customer_id is null
  ) into v_customer_exists;

  -- Evita SMS desnecessário e informa o fluxo correto antes do envio.
  if v_purpose='registration' and v_customer_exists then
    return jsonb_build_object(
      'ok',false,
      'error','phone_already_registered',
      'message','Este telefone já possui cadastro nesta loja. Use a opção Entrar.'
    );
  end if;

  if v_purpose in ('login','password_reset') and not v_customer_exists then
    return jsonb_build_object(
      'ok',false,
      'error','customer_not_found',
      'message','Não encontramos uma conta com este telefone nesta loja. Use Criar conta.'
    );
  end if;

  -- Phone quota is protected by one cross-store advisory lock held until commit.
  v_quota := public.customer_sms_otp_rate_check_safe(p_store_id,v_phone);
  if not coalesce((v_quota->>'ok')::boolean,false) then return v_quota;end if;

  update public.customer_otps
  set used=true,
      consumed_at=coalesce(consumed_at,clock_timestamp()),
      metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('superseded_at',clock_timestamp())
  where store_id=p_store_id
    and phone=v_phone
    and purpose=v_purpose
    and coalesce(verified,false)=false
    and coalesce(used,false)=false;

  v_expires_at:=clock_timestamp()+interval '5 minutes';
  v_entropy:=gen_random_bytes(4);
  v_random_number:=
      get_byte(v_entropy,0)::bigint*16777216
    + get_byte(v_entropy,1)::bigint*65536
    + get_byte(v_entropy,2)::bigint*256
    + get_byte(v_entropy,3)::bigint;
  v_otp:=lpad((v_random_number%1000000)::text,6,'0');
  v_hash:=crypt(v_otp,gen_salt('bf'));

  insert into public.customer_otps(
    phone,store_id,otp_code,otp_hash,expires_at,verified,
    attempts,used,last_sent_at,purpose,metadata
  ) values(
    v_phone,p_store_id,v_hash,v_hash,v_expires_at,false,
    0,false,clock_timestamp(),v_purpose,
    jsonb_build_object(
      'transport','optmasmsgate',
      'delivery_status','issuing',
      'phone_match_key',v_match,
      'requested_at',clock_timestamp()
    )
  ) returning id into v_otp_id;

  return jsonb_build_object(
    'ok',true,
    'otp_id',v_otp_id,
    'phone_number',v_phone,
    'otp',v_otp,
    'purpose',v_purpose,
    'expires_at',v_expires_at
  );
end;
$function$
;
commit;
