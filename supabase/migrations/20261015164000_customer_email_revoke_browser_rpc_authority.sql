begin;

-- Cut over only after the Vercel email and sensitive-change endpoints deploy
-- with CUSTOMER_EMAIL_SERVER_PROOF and the corresponding server-only wrappers.
-- A customer JWT must never authorize choosing a verification-token hash or
-- asserting a message's provider status directly.
revoke all on function public.create_customer_self_email_verification_challenge_safe(text)
  from public, anon, authenticated;
grant execute on function public.create_customer_self_email_verification_challenge_safe(text)
  to service_role;

revoke all on function public.mark_customer_self_email_verification_delivery_safe(uuid,text,text,boolean)
  from public, anon, authenticated;
grant execute on function public.mark_customer_self_email_verification_delivery_safe(uuid,text,text,boolean)
  to service_role;

revoke all on function public.mark_customer_self_sensitive_change_notice_safe(uuid,text,text,boolean)
  from public, anon, authenticated;
grant execute on function public.mark_customer_self_sensitive_change_notice_safe(uuid,text,text,boolean)
  to service_role;

commit;
