-- C4 authentication boundary cleanup.
-- The public customer portal now authenticates through Edge Functions and standard
-- Supabase Auth sessions. Legacy password/direct-OTP RPCs are no longer browser-facing.

begin;

revoke all on function public.customer_login_with_password(text, text, uuid) from public, anon, authenticated;
revoke all on function public.send_customer_otp(text, uuid) from public, anon, authenticated;
revoke all on function public.verify_customer_otp(text, text, uuid) from public, anon, authenticated;
revoke all on function public.verify_customer_otp_sms_safe(text, text, uuid, text) from public, anon, authenticated;

grant execute on function public.customer_login_with_password(text, text, uuid) to service_role;
grant execute on function public.send_customer_otp(text, uuid) to service_role;
grant execute on function public.verify_customer_otp(text, text, uuid) to service_role;
grant execute on function public.verify_customer_otp_sms_safe(text, text, uuid, text) to service_role;

commit;
