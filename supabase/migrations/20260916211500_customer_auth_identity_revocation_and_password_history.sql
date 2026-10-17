-- Corrige a fronteira C6 de pedidos autenticados e registra alterações de senha
-- sem persistir senha ou hash em histórico/auditoria.

alter table public.customer_auth_identities
  add column if not exists revoked_at timestamptz;

create index if not exists idx_customer_auth_identities_active_auth_store
  on public.customer_auth_identities(auth_user_id, store_id)
  where revoked_at is null;

create or replace function public.trg_customer_password_history()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_store_id uuid;
  v_title text;
  v_message text;
begin
  if tg_op = 'UPDATE' and new.password_hash is not distinct from old.password_hash then
    return new;
  end if;

  select c.store_id
    into v_store_id
  from public.customers c
  where c.id = new.customer_id;

  if v_store_id is null then
    return new;
  end if;

  v_title := case when tg_op = 'INSERT' then 'Senha de acesso configurada' else 'Senha atualizada' end;
  v_message := case
    when tg_op = 'INSERT' then 'Registro de segurança: a senha de acesso ao portal do cliente foi configurada.'
    else 'Registro de segurança: a senha de acesso ao portal do cliente foi alterada.'
  end;

  insert into public.customer_notifications(
    customer_id,
    store_id,
    title,
    message,
    type,
    read,
    created_at
  ) values (
    new.customer_id,
    v_store_id,
    v_title,
    v_message,
    'info',
    true,
    coalesce(new.password_changed_at, clock_timestamp())
  );

  return new;
end;
$function$;

revoke all on function public.trg_customer_password_history() from public;

DROP TRIGGER IF EXISTS trg_customer_password_history ON public.customer_credentials;
create trigger trg_customer_password_history
after insert or update of password_hash on public.customer_credentials
for each row execute function public.trg_customer_password_history();

-- Faz o histórico atual refletir a última configuração/alteração já existente,
-- sem duplicar um evento equivalente caso a migration seja reaplicada.
insert into public.customer_notifications(
  customer_id,
  store_id,
  title,
  message,
  type,
  read,
  created_at
)
select
  cc.customer_id,
  c.store_id,
  case
    when cc.password_changed_at > cc.created_at + interval '1 second' then 'Senha atualizada'
    else 'Senha de acesso configurada'
  end,
  case
    when cc.password_changed_at > cc.created_at + interval '1 second'
      then 'Registro de segurança: a senha de acesso ao portal do cliente foi alterada.'
    else 'Registro de segurança: a senha de acesso ao portal do cliente foi configurada.'
  end,
  'info',
  true,
  cc.password_changed_at
from public.customer_credentials cc
join public.customers c on c.id = cc.customer_id
where cc.password_changed_at is not null
  and not exists (
    select 1
    from public.customer_notifications cn
    where cn.customer_id = cc.customer_id
      and cn.store_id = c.store_id
      and cn.title in ('Senha atualizada', 'Senha de acesso configurada')
      and abs(extract(epoch from (cn.created_at - cc.password_changed_at))) < 2
  );
