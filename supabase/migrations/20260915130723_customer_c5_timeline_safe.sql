create or replace function public.get_customer_timeline_safe(
  p_store_id uuid,
  p_customer_id uuid,
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_sensitive boolean := false;
  v_customer_exists boolean := false;
  v_events jsonb := '[]'::jsonb;
begin
  if p_store_id is null or p_customer_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_parameters', 'events', '[]'::jsonb);
  end if;

  if auth.uid() is null
     or not (
       public.app_is_store_owner(p_store_id)
       or public.user_has_store_permission(p_store_id, 'customers.view')
       or public.user_has_store_permission(p_store_id, 'customers.manage')
     ) then
    return jsonb_build_object('ok', false, 'error', 'access_denied', 'events', '[]'::jsonb);
  end if;

  v_sensitive := public.app_is_store_owner(p_store_id)
    or public.user_has_store_permission(p_store_id, 'customers.sensitive.view');

  select exists (
    select 1
    from public.customers c
    where c.id = p_customer_id
      and c.store_id = p_store_id
      and c.status not in ('merged', 'anonymized')
  ) into v_customer_exists;

  if not v_customer_exists then
    return jsonb_build_object('ok', false, 'error', 'customer_not_found', 'events', '[]'::jsonb);
  end if;

  with timeline_events as (
    select
      'customer:' || c.id::text || ':created' as event_id,
      'profile'::text as category,
      'customer_created'::text as event_type,
      'Cliente cadastrado'::text as title,
      case
        when c.source = 'admin' then 'Cadastro criado pelo administrativo.'
        when c.source = 'public_store' then 'Cadastro criado pela loja pública.'
        when c.source = 'whatsapp' then 'Cadastro criado a partir do WhatsApp.'
        when c.source = 'qr_table' then 'Cadastro criado a partir de QR/Mesa.'
        when c.source = 'direct_sale' then 'Cadastro criado durante uma venda direta.'
        when c.source = 'import' then 'Cadastro importado para a loja.'
        else 'Cadastro do cliente criado.'
      end as description,
      c.created_at as occurred_at,
      coalesce(c.source, 'customer')::text as source,
      c.id as related_id,
      jsonb_build_object('registration_method', c.registration_method, 'data_ownership', c.data_ownership) as metadata
    from public.customers c
    where c.id = p_customer_id and c.store_id = p_store_id

    union all

    select
      'customer:' || c.id::text || ':updated',
      'profile',
      'customer_updated',
      'Cadastro atualizado',
      'Os dados do cadastro receberam uma atualização.',
      c.updated_at,
      'customer',
      c.id,
      '{}'::jsonb
    from public.customers c
    where c.id = p_customer_id
      and c.store_id = p_store_id
      and c.updated_at is not null
      and c.updated_at > c.created_at + interval '1 second'

    union all

    select
      'customer:' || c.id::text || ':identity_verified',
      'profile',
      'identity_verified',
      'Identidade confirmada',
      'A identidade do cliente foi confirmada.',
      c.identity_verified_at,
      'customer_auth',
      c.id,
      '{}'::jsonb
    from public.customers c
    where c.id = p_customer_id
      and c.store_id = p_store_id
      and c.identity_verified_at is not null

    union all

    select
      'customer:' || c.id::text || ':last_login',
      'profile',
      'customer_login',
      'Acesso ao portal do cliente',
      'Último acesso autenticado registrado para este cliente.',
      c.last_login,
      'customer_auth',
      c.id,
      '{}'::jsonb
    from public.customers c
    where c.id = p_customer_id
      and c.store_id = p_store_id
      and c.last_login is not null

    union all

    select
      'order:' || o.id::text,
      'order',
      'order_created',
      case when o.order_code is not null then 'Pedido ' || o.order_code else 'Pedido registrado' end,
      'Pedido vinculado de forma confirmada a este cadastro.',
      o.created_at,
      coalesce(o.sales_channel, 'order'),
      o.id,
      jsonb_build_object(
        'order_id', o.id,
        'order_code', o.order_code,
        'status', o.status,
        'total', o.total,
        'sales_channel', o.sales_channel,
        'fulfillment_type', o.fulfillment_type
      )
    from public.orders o
    where o.store_id = p_store_id
      and o.customer_id = p_customer_id

    union all

    select
      'loyalty:' || lt.id::text,
      'loyalty',
      'loyalty_transaction',
      case when lt.points >= 0 then 'Pontos creditados' else 'Pontos debitados' end,
      coalesce(nullif(btrim(lt.description), ''), 'Movimentação no programa de fidelidade.'),
      lt.created_at,
      'loyalty',
      lt.id,
      jsonb_build_object(
        'points', lt.points,
        'transaction_type', lt.type,
        'order_id', lt.order_id
      )
    from public.loyalty_transactions lt
    where lt.customer_id = p_customer_id

    union all

    select
      'consent:' || cl.id::text,
      'consent',
      'consent_' || coalesce(cl.action, 'recorded'),
      case when cl.action = 'granted' then 'Consentimento concedido' else 'Consentimento revogado' end,
      'Registro de ' || coalesce(cl.consent_type, 'consentimento') || '.',
      cl.created_at,
      coalesce(cl.source, 'consent'),
      cl.id,
      jsonb_build_object(
        'consent_type', cl.consent_type,
        'action', cl.action,
        'terms_version', cl.terms_version,
        'privacy_version', cl.privacy_version
      )
    from public.customer_consent_logs cl
    where v_sensitive
      and cl.store_id = p_store_id
      and cl.customer_id = p_customer_id

    union all

    select
      'address:' || ca.id::text,
      'address',
      'address_added',
      'Endereço adicionado',
      'Um endereço foi incluído no cadastro do cliente.',
      ca.created_at,
      'customer_address',
      ca.id,
      jsonb_build_object('is_default', ca.is_default, 'city', ca.city, 'state', ca.state)
    from public.customer_addresses ca
    where v_sensitive
      and ca.customer_id = p_customer_id

    union all

    select
      'merge:' || me.id::text,
      'merge',
      'customer_merged',
      'Fusão de cadastros concluída',
      case
        when me.canonical_customer_id = p_customer_id then 'Outro cadastro foi consolidado neste cliente.'
        else 'Este cadastro foi consolidado em outro cliente.'
      end,
      me.created_at,
      'customer_merge',
      me.id,
      jsonb_build_object(
        'canonical_customer_id', me.canonical_customer_id,
        'duplicate_customer_id', me.duplicate_customer_id,
        'match_basis', me.match_basis,
        'moved_counts', me.moved_counts
      )
    from public.customer_merge_events me
    where v_sensitive
      and me.store_id = p_store_id
      and (me.canonical_customer_id = p_customer_id or me.duplicate_customer_id = p_customer_id)

    union all

    select
      'notification:' || cn.id::text,
      'communication',
      'customer_notification',
      coalesce(nullif(btrim(cn.title), ''), 'Comunicação registrada'),
      'Notificação registrada para o cliente.',
      cn.created_at,
      'customer_notification',
      cn.id,
      jsonb_build_object('notification_type', cn.type, 'read', cn.read)
    from public.customer_notifications cn
    where v_sensitive
      and cn.store_id = p_store_id
      and cn.customer_id = p_customer_id
  ), limited as (
    select *
    from timeline_events
    where occurred_at is not null
    order by occurred_at desc, event_id desc
    limit greatest(1, least(coalesce(p_limit, 100), 300))
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', event_id,
        'category', category,
        'event_type', event_type,
        'title', title,
        'description', description,
        'occurred_at', occurred_at,
        'source', source,
        'related_id', related_id,
        'metadata', metadata
      ) order by occurred_at desc, event_id desc
    ),
    '[]'::jsonb
  ) into v_events
  from limited;

  return jsonb_build_object(
    'ok', true,
    'events', v_events,
    'sensitive_data_visible', v_sensitive,
    'identity_link_policy', 'confirmed_customer_id_only'
  );
end;
$$;

revoke all on function public.get_customer_timeline_safe(uuid, uuid, integer) from public;
revoke all on function public.get_customer_timeline_safe(uuid, uuid, integer) from anon;
grant execute on function public.get_customer_timeline_safe(uuid, uuid, integer) to authenticated;
grant execute on function public.get_customer_timeline_safe(uuid, uuid, integer) to service_role;
