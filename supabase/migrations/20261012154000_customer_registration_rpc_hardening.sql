begin;

-- Cadastro de cliente é orquestrado exclusivamente pela Edge Function
-- customer-auth-session após OTP válido. A RPC interna continua disponível
-- somente ao service_role para impedir criação direta de cadastro pela API REST.
revoke all on function public.register_public_customer_safe(
  uuid, text, text, text, text, date, boolean, text, text, boolean, boolean, text
) from public, anon, authenticated;
grant execute on function public.register_public_customer_safe(
  uuid, text, text, text, text, date, boolean, text, text, boolean, boolean, text
) to service_role;

-- Função de trigger não é endpoint de aplicação e não deve ser exposta via RPC.
revoke all on function public.trg_customer_password_history() from public, anon, authenticated;
grant execute on function public.trg_customer_password_history() to service_role;

commit;
