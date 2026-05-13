-- =========================================================
-- E7) OTP TABLES: acesso só por service role (edge function)
-- =========================================================
revoke all on public.otp_codes from anon, authenticated;
revoke all on public.customer_otps from anon, authenticated;