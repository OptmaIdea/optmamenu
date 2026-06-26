-- garante pgcrypto (se já existe, ok)
create extension if not exists pgcrypto;

create or replace function public.customer_login_with_password(
  p_phone text,
  p_password text,
  p_store_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_customer public.customers%rowtype;
begin
  -- normaliza
  p_phone := regexp_replace(coalesce(p_phone,''), '\D', '', 'g');

  select c.*
    into v_customer
    from public.customers c
   where c.phone = p_phone
     and c.store_id = p_store_id
     and c.password_hash is not null
     and c.password_hash = crypt(p_password, c.password_hash)
   limit 1;

  if not found then
    return jsonb_build_object('customer', null);
  end if;

  -- retorna tudo (se quiser reduzir campos, a gente reduz depois)
  return jsonb_build_object('customer', to_jsonb(v_customer));
end;
$$;

revoke all on function public.customer_login_with_password(text,text,uuid) from public;
grant execute on function public.customer_login_with_password(text,text,uuid) to anon, authenticated;



create or replace function public.get_user_store_by_id(p_user_id uuid)
returns table(
  id uuid,
  slug text,
  config jsonb
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  select s.id, s.slug, s.config
    from public.stores s
   where s.user_id = p_user_id
   limit 1;
end;
$$;

revoke all on function public.get_user_store_by_id(uuid) from public;
grant execute on function public.get_user_store_by_id(uuid) to authenticated;