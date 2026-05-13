create or replace function public.update_store_message_settings(
  p_store_id uuid,
  p_sms_gateway_token text,
  p_config jsonb
)
returns void
language plpgsql
security definer
as $$
begin
  update public.stores
  set
    sms_gateway_token = p_sms_gateway_token,
    config = coalesce(p_config, '{}'::jsonb)
  where id = p_store_id;
end;
$$;

-- Opcional: garantir permissão de execução (ajuste conforme seu setup)
grant execute on function public.update_store_message_settings(uuid, text, jsonb) to authenticated;