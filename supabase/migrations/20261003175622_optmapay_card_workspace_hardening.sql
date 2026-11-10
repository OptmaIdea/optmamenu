-- Restringe o workspace administrativo de pagamentos online a sessões autenticadas.
revoke all on function public.get_online_payments_workspace_safe(uuid) from public, anon;
grant execute on function public.get_online_payments_workspace_safe(uuid) to authenticated, service_role;
