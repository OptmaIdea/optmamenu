-- Aligns the live customer Auth identity bridge with the repository security model.
-- This migration intentionally removes the no-longer-used service-only touch RPC
-- and closes direct table/function privileges for browser roles.

begin;

revoke all on table public.customer_auth_identities from anon, authenticated;
grant all on table public.customer_auth_identities to service_role;

revoke all on function public.app_current_customer_id() from public, anon;
revoke all on function public.app_current_store_id() from public, anon;
revoke all on function public.app_current_role() from public, anon;
grant execute on function public.app_current_customer_id() to authenticated, service_role;
grant execute on function public.app_current_store_id() to authenticated, service_role;
grant execute on function public.app_current_role() to authenticated, service_role;

revoke all on function public.validate_customer_auth_identity_store() from public, anon, authenticated, service_role;

drop function if exists public.touch_customer_auth_identity(uuid, uuid, uuid);

commit;
