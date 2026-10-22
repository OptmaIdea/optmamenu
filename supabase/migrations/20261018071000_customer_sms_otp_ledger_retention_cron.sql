begin;
-- Audit retention: pseudonymized OTP issuance receipts are retained for 90 days.
-- The scheduled job runs in the PostgreSQL owner context; no browser/service
-- role receives direct DELETE or permission to call the purge function.
select cron.schedule(
  'customer-sms-otp-ledger-prune-90d',
  '13 3 * * *',
  $job$select public.customer_sms_otp_ledger_prune_90d();$job$
);
commit;
