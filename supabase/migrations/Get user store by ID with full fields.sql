-- Migration: fix_get_user_store_by_id_return_all_fields
-- Description: Atualiza função para retornar todos os campos da tabela stores
-- Date: 2026-02-23

-- Drop da função antiga
drop function if exists public.get_user_store_by_id(uuid);

-- Recriar função retornando TODOS os campos da tabela stores
create or replace function public.get_user_store_by_id(p_user_id uuid)
returns table(
  id uuid,
  user_id uuid,
  slug text,
  name text,
  description text,
  logo_url text,
  phone_number text,
  theme_config jsonb,
  legal_name text,
  doc_type text,
  document text,
  fantasy_name text,
  establishment_type text,
  address jsonb,
  contacts jsonb,
  consents jsonb,
  sms_gateway_token text,
  reservation_time_minutes integer,
  stock_password_hash text,
  config jsonb,
  privacy_policy_text text,
  terms_of_use_text text,
  cookie_policy_text text,
  dpo_email text,
  dpo_contact text,
  token_expiry_seconds integer,
  max_token_attempts integer,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  select 
    s.id,
    s.user_id,
    s.slug,
    s.name,
    s.description,
    s.logo_url,
    s.phone_number,
    s.theme_config,
    s.legal_name,
    s.doc_type,
    s.document,
    s.fantasy_name,
    s.establishment_type,
    s.address,
    s.contacts,
    s.consents,
    s.sms_gateway_token,
    s.reservation_time_minutes,
    s.stock_password_hash,
    s.config,
    s.privacy_policy_text,
    s.terms_of_use_text,
    s.cookie_policy_text,
    s.dpo_email,
    s.dpo_contact,
    s.token_expiry_seconds,
    s.max_token_attempts,
    s.created_at
  from public.stores s
  where s.user_id = p_user_id
  limit 1;
end;
$$;

-- Revogar acesso público
revoke all on function public.get_user_store_by_id(uuid) from public;

-- Conceder acesso apenas para usuários autenticados
grant execute on function public.get_user_store_by_id(uuid) to authenticated;

comment on function public.get_user_store_by_id(uuid) is 'Retorna TODOS os campos da loja vinculada ao usuário autenticado';
