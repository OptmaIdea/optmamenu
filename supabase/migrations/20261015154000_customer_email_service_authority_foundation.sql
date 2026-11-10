begin;

-- The browser may request that the Vercel server send a message, but it must
-- never choose its own verification token nor declare delivery authoritative.
-- Shared proof is a 256-bit random server-side secret; the database stores only its digest.
create table if not exists public.customer_email_server_proof (
  singleton boolean primary key default true check (singleton),
  proof_sha256 text not null check (proof_sha256 ~ '^[0-9a-f]{64}$'),
  rotated_at timestamptz not null default clock_timestamp()
);
alter table public.customer_email_server_proof enable row level security;
revoke all on public.customer_email_server_proof from public, anon, authenticated;
grant select, insert, update on public.customer_email_server_proof to service_role;

create or replace function public.customer_email_server_proof_valid_internal(p_proof text)
returns boolean language sql stable security definer
set search_path to 'public','extensions','pg_temp'
as $fn$
  select length(coalesce(p_proof,'')) = 64
    and exists (
      select 1 from public.customer_email_server_proof c
      where c.singleton=true
        and c.proof_sha256 = encode(extensions.digest(p_proof,'sha256'),'hex')
    );
$fn$;
revoke all on function public.customer_email_server_proof_valid_internal(text)
  from public, anon, authenticated;
grant execute on function public.customer_email_server_proof_valid_internal(text) to service_role;

create or replace function public.create_customer_self_email_verification_challenge_server_safe(
  p_token_hash text, p_server_proof text
)
returns jsonb language plpgsql security definer
set search_path to 'public','pg_temp'
as $fn$
begin
  if not public.customer_email_server_proof_valid_internal(p_server_proof) then
    return jsonb_build_object('ok',false,'error','access_denied');
  end if;
  -- The legacy function derives the store and customer from the verified JWT.
  return public.create_customer_self_email_verification_challenge_safe(p_token_hash);
end;
$fn$;
revoke all on function public.create_customer_self_email_verification_challenge_server_safe(text,text)
  from public, anon;
grant execute on function public.create_customer_self_email_verification_challenge_server_safe(text,text)
  to authenticated, service_role;

create or replace function public.mark_customer_self_email_verification_delivery_server_safe(
  p_challenge_id uuid, p_provider_message_id text,
  p_provider text, p_failed boolean, p_server_proof text
)
returns jsonb language plpgsql security definer
set search_path to 'public','pg_temp'
as $fn$
begin
  if not public.customer_email_server_proof_valid_internal(p_server_proof) then
    return jsonb_build_object('ok',false,'error','access_denied');
  end if;
  return public.mark_customer_self_email_verification_delivery_safe(
    p_challenge_id,p_provider_message_id,p_provider,p_failed
  );
end;
$fn$;
revoke all on function public.mark_customer_self_email_verification_delivery_server_safe(uuid,text,text,boolean,text)
  from public, anon;
grant execute on function public.mark_customer_self_email_verification_delivery_server_safe(uuid,text,text,boolean,text)
  to authenticated, service_role;

create or replace function public.mark_customer_self_sensitive_change_notice_server_safe(
  p_audit_id uuid, p_provider text, p_provider_message_id text,
  p_failed boolean, p_server_proof text
)
returns jsonb language plpgsql security definer
set search_path to 'public','pg_temp'
as $fn$
begin
  if not public.customer_email_server_proof_valid_internal(p_server_proof) then
    return jsonb_build_object('ok',false,'error','access_denied');
  end if;
  return public.mark_customer_self_sensitive_change_notice_safe(
    p_audit_id,p_provider,p_provider_message_id,p_failed
  );
end;
$fn$;
revoke all on function public.mark_customer_self_sensitive_change_notice_server_safe(uuid,text,text,boolean,text)
  from public, anon;
grant execute on function public.mark_customer_self_sensitive_change_notice_server_safe(uuid,text,text,boolean,text)
  to authenticated, service_role;

commit;
