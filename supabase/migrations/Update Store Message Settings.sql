create or replace function public.update_store_message_settings_admin(
  p_store_id uuid,
  p_sms_gateway_token text,
  p_config jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  -- Ajuste aqui caso sua modelagem seja diferente:
  -- hoje estou assumindo que o dono da loja é o próprio auth.uid() e stores.id = auth.uid()
  if auth.uid() <> p_store_id then
    raise exception 'Not allowed';
  end if;

  update public.stores
  set
    sms_gateway_token = coalesce(p_sms_gateway_token, ''),
    config = coalesce(p_config, '{}'::jsonb)
  where id = p_store_id;

  if not found then
    raise exception 'Store not found';
  end if;
end;
$$;

-- Opcional: garantir que usuários autenticados possam executar
grant execute on function public.update_store_message_settings_admin(uuid, text, jsonb) to authenticated;