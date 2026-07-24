-- PDV-1 — fundação segura para Venda Direta e futuro PDV dedicado.
--
-- Esta migração:
-- - torna o motor central a autoridade de preços da Venda Direta;
-- - adiciona idempotência por loja/tentativa;
-- - impede fidelidade para cliente sem opt-in ou marcado como operacional;
-- - cadastra a matriz inicial de permissões específicas do PDV.

alter table public.orders
  add column if not exists idempotency_key uuid,
  add column if not exists idempotency_fingerprint text;

create unique index if not exists orders_store_idempotency_key_uidx
  on public.orders (store_id, idempotency_key)
  where idempotency_key is not null;

comment on column public.orders.idempotency_key is
  'Identificador estável da tentativa de criação do pedido, único por loja.';

comment on column public.orders.idempotency_fingerprint is
  'Assinatura do conteúdo da tentativa usada para detectar reutilização conflitante da chave.';

alter function public.create_admin_direct_sale_order_safe(
  uuid,
  jsonb,
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  text,
  text,
  boolean,
  boolean,
  boolean,
  jsonb
) rename to create_admin_direct_sale_order_legacy_internal;

revoke all on function public.create_admin_direct_sale_order_legacy_internal(
  uuid,
  jsonb,
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  text,
  text,
  boolean,
  boolean,
  boolean,
  jsonb
) from public, anon, authenticated;

grant execute on function public.create_admin_direct_sale_order_legacy_internal(
  uuid,
  jsonb,
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  text,
  text,
  boolean,
  boolean,
  boolean,
  jsonb
) to service_role;

create function public.create_admin_direct_sale_order_safe(
  p_store_id uuid,
  p_items jsonb,
  p_customer_id uuid default null,
  p_customer_name text default null,
  p_customer_phone text default null,
  p_payment_method_code text default 'pending',
  p_notes text default null,
  p_location_id uuid default null,
  p_sales_channel text default 'direct',
  p_fulfillment_type text default 'pickup',
  p_create_customer_if_missing boolean default true,
  p_marketing_consent boolean default false,
  p_loyalty_opt_in boolean default true,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_jwt_role text := coalesce(auth.jwt()->>'role', '');
  v_idempotency_key uuid;
  v_fingerprint text;
  v_existing record;
  v_pricing jsonb;
  v_authoritative_items jsonb;
  v_requested_count integer;
  v_priced_count integer;
  v_result jsonb;
  v_order_id uuid;
begin
  if p_store_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_store_id');
  end if;

  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('ok', false, 'error', 'empty_cart');
  end if;

  if jsonb_array_length(p_items) > 100 then
    return jsonb_build_object('ok', false, 'error', 'too_many_items');
  end if;

  if v_jwt_role in ('anon', 'authenticated') then
    if v_user_id is null
       or not (
         public.app_is_store_owner(p_store_id)
         or public.user_has_store_permission(p_store_id, 'orders.manage')
       ) then
      return jsonb_build_object(
        'ok', false,
        'error', 'access_denied',
        'message', 'Você não tem permissão para criar venda direta.'
      );
    end if;
  end if;

  begin
    v_idempotency_key := nullif(trim(coalesce(p_metadata->>'idempotency_key', '')), '')::uuid;
  exception
    when invalid_text_representation then
      return jsonb_build_object('ok', false, 'error', 'invalid_idempotency_key');
  end;

  v_fingerprint := md5(jsonb_build_object(
    'store_id', p_store_id,
    'items', p_items,
    'customer_id', p_customer_id,
    'customer_name', nullif(trim(coalesce(p_customer_name, '')), ''),
    'customer_phone', regexp_replace(coalesce(p_customer_phone, ''), '\D', '', 'g'),
    'payment_method_code', coalesce(p_payment_method_code, 'pending'),
    'notes', nullif(trim(coalesce(p_notes, '')), ''),
    'location_id', p_location_id,
    'sales_channel', coalesce(p_sales_channel, 'direct'),
    'fulfillment_type', coalesce(p_fulfillment_type, 'pickup')
  )::text);

  if v_idempotency_key is not null then
    perform pg_advisory_xact_lock(
      hashtextextended(p_store_id::text || ':' || v_idempotency_key::text, 0)
    );

    select
      o.id,
      o.order_code,
      o.status,
      o.subtotal,
      o.total,
      o.sales_channel,
      o.fulfillment_type,
      o.payment_method,
      o.payment_method_code,
      o.customer_id,
      o.customer_name,
      o.customer_phone,
      o.delivery_metadata,
      o.commercial_metadata,
      o.idempotency_fingerprint
    into v_existing
    from public.orders o
    where o.store_id = p_store_id
      and o.idempotency_key = v_idempotency_key
    limit 1;

    if v_existing.id is not null then
      if v_existing.idempotency_fingerprint is distinct from v_fingerprint then
        return jsonb_build_object(
          'ok', false,
          'error', 'idempotency_conflict',
          'message', 'Esta tentativa já foi utilizada com dados diferentes.'
        );
      end if;

      return jsonb_build_object(
        'ok', true,
        'idempotent_replay', true,
        'order', jsonb_build_object(
          'id', v_existing.id,
          'order_code', v_existing.order_code,
          'status', v_existing.status,
          'subtotal', v_existing.subtotal,
          'gross_subtotal', v_existing.commercial_metadata->'gross_subtotal',
          'discount_total', v_existing.commercial_metadata->'discount_total',
          'delivery_fee', 0,
          'total', v_existing.total,
          'sales_channel', v_existing.sales_channel,
          'fulfillment_type', v_existing.fulfillment_type,
          'payment_method', v_existing.payment_method,
          'payment_method_code', v_existing.payment_method_code,
          'payment_method_name', v_existing.commercial_metadata->>'payment_method_name',
          'customer_id', v_existing.customer_id,
          'customer_name', v_existing.customer_name,
          'customer_phone', v_existing.customer_phone,
          'location_id', v_existing.delivery_metadata->>'location_id',
          'items_count', (
            select count(*)::integer
            from public.order_items oi
            where oi.order_id = v_existing.id
          )
        ),
        'cashbook', (
          select to_jsonb(cbe)
          from public.cashbook_entries cbe
          where cbe.order_id = v_existing.id
          order by cbe.created_at desc
          limit 1
        ),
        'loyalty', jsonb_build_object(
          'skipped', true,
          'reason', 'idempotent_replay'
        )
      );
    end if;
  end if;

  v_pricing := public.calculate_store_cart_pricing(p_store_id, p_items);

  if coalesce((v_pricing->>'ok')::boolean, false) = false then
    return v_pricing;
  end if;

  select count(distinct (entry->>'product_id')::uuid)
  into v_requested_count
  from jsonb_array_elements(p_items) entry
  where nullif(entry->>'product_id', '') is not null
    and coalesce((entry->>'quantity')::integer, 0) > 0;

  v_priced_count := jsonb_array_length(coalesce(v_pricing->'items', '[]'::jsonb));

  if v_priced_count <> v_requested_count then
    return jsonb_build_object(
      'ok', false,
      'error', 'invalid_or_unavailable_product',
      'message', 'Um ou mais produtos não pertencem à loja ou estão indisponíveis.'
    );
  end if;

  with original as (
    select
      (entry->>'product_id')::uuid as product_id,
      sum(greatest(coalesce((entry->>'discount')::numeric, 0), 0)) as manual_discount,
      max(nullif(trim(coalesce(entry->>'discount_reason', '')), '')) as discount_reason,
      jsonb_build_object(
        'source_items', jsonb_agg(coalesce(entry->'metadata', '{}'::jsonb))
      ) as client_metadata
    from jsonb_array_elements(p_items) entry
    group by (entry->>'product_id')::uuid
  ),
  priced as (
    select value as item
    from jsonb_array_elements(v_pricing->'items')
  )
  select jsonb_agg(
    jsonb_build_object(
      'product_id', p.item->>'product_id',
      'quantity', (p.item->>'quantity')::integer,
      'unit_price', (p.item->>'unit_price')::numeric,
      'original_unit_price', (p.item->>'base_price')::numeric,
      'discount', least(
        coalesce(o.manual_discount, 0),
        (p.item->>'line_total')::numeric
      ),
      'discount_reason', o.discount_reason,
      'pricing_source', p.item->>'pricing_source',
      'price_rule', p.item->'applied_tier',
      'metadata', coalesce(o.client_metadata, '{}'::jsonb)
        || jsonb_build_object(
          'pricing_quantity', (p.item->>'pricing_quantity')::integer,
          'central_pricing_applied', true
        )
    )
    order by p.item->>'product_name'
  )
  into v_authoritative_items
  from priced p
  join original o
    on o.product_id = (p.item->>'product_id')::uuid;

  v_result := public.create_admin_direct_sale_order_legacy_internal(
    p_store_id,
    v_authoritative_items,
    p_customer_id,
    p_customer_name,
    p_customer_phone,
    p_payment_method_code,
    p_notes,
    p_location_id,
    p_sales_channel,
    p_fulfillment_type,
    p_create_customer_if_missing,
    p_marketing_consent,
    p_loyalty_opt_in,
    coalesce(p_metadata, '{}'::jsonb)
      - 'idempotency_key'
      || jsonb_build_object(
        'central_pricing_applied', true,
        'pricing_engine', 'calculate_store_cart_pricing',
        'pricing_snapshot', v_pricing
      )
  );

  if coalesce((v_result->>'ok')::boolean, false) = false then
    return v_result;
  end if;

  v_order_id := nullif(v_result->'order'->>'id', '')::uuid;

  update public.orders o
  set
    idempotency_key = v_idempotency_key,
    idempotency_fingerprint = case
      when v_idempotency_key is null then null
      else v_fingerprint
    end,
    commercial_metadata = coalesce(o.commercial_metadata, '{}'::jsonb)
      || jsonb_build_object(
        'central_pricing_applied', true,
        'pricing_engine', 'calculate_store_cart_pricing',
        'pricing_snapshot', v_pricing
      ),
    metadata = coalesce(o.metadata, '{}'::jsonb)
      || case
        when v_idempotency_key is null then '{}'::jsonb
        else jsonb_build_object('idempotency_key', v_idempotency_key)
      end
  where o.id = v_order_id
    and o.store_id = p_store_id;

  return v_result
    || jsonb_build_object(
      'idempotent_replay', false,
      'pricing', v_pricing
    );
exception
  when invalid_text_representation then
    return jsonb_build_object(
      'ok', false,
      'error', 'invalid_request_format',
      'message', 'Produto, quantidade ou identificador inválido.'
    );
  when unique_violation then
    return jsonb_build_object(
      'ok', false,
      'error', 'idempotency_conflict',
      'message', 'A tentativa já foi processada.'
    );
  when others then
    return jsonb_build_object(
      'ok', false,
      'error', 'unexpected_error',
      'message', sqlerrm
    );
end;
$function$;

revoke all on function public.create_admin_direct_sale_order_safe(
  uuid,
  jsonb,
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  text,
  text,
  boolean,
  boolean,
  boolean,
  jsonb
) from public, anon;

grant execute on function public.create_admin_direct_sale_order_safe(
  uuid,
  jsonb,
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  text,
  text,
  boolean,
  boolean,
  boolean,
  jsonb
) to authenticated, service_role;

alter function public.apply_order_loyalty_points_advanced(uuid)
  rename to apply_order_loyalty_points_advanced_internal;

revoke all on function public.apply_order_loyalty_points_advanced_internal(uuid)
  from public, anon, authenticated;

grant execute on function public.apply_order_loyalty_points_advanced_internal(uuid)
  to service_role;

create function public.apply_order_loyalty_points_advanced(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_customer record;
begin
  select
    c.id,
    coalesce(c.loyalty_opt_in, false) as loyalty_opt_in,
    c.source,
    coalesce(c.customer_metadata, '{}'::jsonb) as customer_metadata
  into v_customer
  from public.orders o
  join public.customers c
    on c.id = o.customer_id
   and c.store_id = o.store_id
  where o.id = p_order_id;

  if v_customer.id is null then
    return jsonb_build_object(
      'ok', true,
      'skipped', true,
      'reason', 'customer_not_eligible',
      'order_id', p_order_id
    );
  end if;

  if v_customer.loyalty_opt_in = false then
    return jsonb_build_object(
      'ok', true,
      'skipped', true,
      'reason', 'loyalty_opt_out',
      'order_id', p_order_id,
      'customer_id', v_customer.id
    );
  end if;

  if coalesce((v_customer.customer_metadata->>'operational_customer')::boolean, false)
     or v_customer.source = 'system' then
    return jsonb_build_object(
      'ok', true,
      'skipped', true,
      'reason', 'operational_customer',
      'order_id', p_order_id,
      'customer_id', v_customer.id
    );
  end if;

  return public.apply_order_loyalty_points_advanced_internal(p_order_id);
end;
$function$;

revoke all on function public.apply_order_loyalty_points_advanced(uuid)
  from public, anon, authenticated;

grant execute on function public.apply_order_loyalty_points_advanced(uuid)
  to service_role;

update public.customers
set
  loyalty_opt_in = false,
  customer_metadata = coalesce(customer_metadata, '{}'::jsonb)
    || jsonb_build_object(
      'operational_customer', true,
      'loyalty_excluded_at', now(),
      'loyalty_exclusion_reason', 'shared_counter_customer'
    )
where id = '399f6e4e-6a3e-4228-bf99-a6581ebd9f28'::uuid
  and store_id = '0abba741-0f77-4783-8cf8-58811cf7343b'::uuid;

insert into public.store_permission_catalog (
  permission_key,
  category,
  label,
  description,
  risk,
  active,
  sort_order,
  macro_group,
  group_key,
  group_label,
  item_key,
  item_label,
  action_key,
  action_label,
  depends_on,
  access_permission_key,
  default_role_allowed,
  ui_sort_order,
  show_in_permission_ui
)
values
  ('pdv.view', 'Operacional', 'Acessar PDV', 'Permite acessar o PDV dedicado.', 'medium', true, 2130, 'operational', 'commercial', 'Comercial', 'pdv', 'PDV', 'view', 'Acessar', 'commercial.view', 'commercial.view', '{"admin":true,"manager":true,"cashier":true}'::jsonb, 2130, true),
  ('pdv.sell', 'Operacional', 'Realizar Venda', 'Permite concluir vendas no PDV.', 'high', true, 2131, 'operational', 'commercial', 'Comercial', 'pdv', 'PDV', 'sell', 'Vender', 'pdv.view', 'pdv.view', '{"admin":true,"manager":true,"cashier":true}'::jsonb, 2131, true),
  ('pdv.discount.apply', 'Operacional', 'Aplicar Desconto', 'Permite aplicar desconto manual no PDV.', 'high', true, 2132, 'operational', 'commercial', 'Comercial', 'pdv', 'PDV', 'discount_apply', 'Desconto', 'pdv.sell', 'pdv.view', '{"admin":true,"manager":true}'::jsonb, 2132, true),
  ('pdv.price.override', 'Operacional', 'Alterar Preço', 'Permite substituir o preço calculado pelo motor central.', 'critical', true, 2133, 'operational', 'commercial', 'Comercial', 'pdv', 'PDV', 'price_override', 'Alterar preço', 'pdv.sell', 'pdv.view', '{"admin":true}'::jsonb, 2133, true),
  ('pdv.item.cancel', 'Operacional', 'Cancelar Item', 'Permite remover ou cancelar item durante a venda.', 'medium', true, 2134, 'operational', 'commercial', 'Comercial', 'pdv', 'PDV', 'item_cancel', 'Cancelar item', 'pdv.sell', 'pdv.view', '{"admin":true,"manager":true,"cashier":true}'::jsonb, 2134, true),
  ('pdv.sale.cancel', 'Operacional', 'Cancelar Venda', 'Permite cancelar ou estornar venda concluída.', 'critical', true, 2135, 'operational', 'commercial', 'Comercial', 'pdv', 'PDV', 'sale_cancel', 'Cancelar venda', 'pdv.history.view', 'pdv.view', '{"admin":true,"manager":true}'::jsonb, 2135, true),
  ('pdv.customer.select', 'Operacional', 'Selecionar Cliente', 'Permite buscar e vincular cliente à venda.', 'medium', true, 2136, 'operational', 'commercial', 'Comercial', 'pdv', 'PDV', 'customer_select', 'Selecionar cliente', 'pdv.view', 'pdv.view', '{"admin":true,"manager":true,"cashier":true}'::jsonb, 2136, true),
  ('pdv.payment.change', 'Operacional', 'Alterar Pagamento', 'Permite corrigir a forma de pagamento após a conclusão.', 'critical', true, 2137, 'operational', 'commercial', 'Comercial', 'pdv', 'PDV', 'payment_change', 'Alterar pagamento', 'pdv.history.view', 'pdv.view', '{"admin":true,"manager":true}'::jsonb, 2137, true),
  ('pdv.cash.open', 'Operacional', 'Abrir Caixa', 'Permite abrir uma sessão de caixa do PDV.', 'high', true, 2138, 'operational', 'commercial', 'Comercial', 'pdv', 'PDV', 'cash_open', 'Abrir caixa', 'pdv.view', 'pdv.view', '{"admin":true,"manager":true,"cashier":true}'::jsonb, 2138, true),
  ('pdv.cash.close', 'Operacional', 'Fechar Caixa', 'Permite fechar uma sessão de caixa do PDV.', 'high', true, 2139, 'operational', 'commercial', 'Comercial', 'pdv', 'PDV', 'cash_close', 'Fechar caixa', 'pdv.view', 'pdv.view', '{"admin":true,"manager":true,"cashier":true}'::jsonb, 2139, true),
  ('pdv.history.view', 'Operacional', 'Ver Histórico do PDV', 'Permite consultar o histórico de vendas do PDV.', 'medium', true, 2140, 'operational', 'commercial', 'Comercial', 'pdv', 'PDV', 'history_view', 'Ver histórico', 'pdv.view', 'pdv.view', '{"admin":true,"manager":true,"cashier":true}'::jsonb, 2140, true),
  ('pdv.receipt.reprint', 'Operacional', 'Reimprimir Comprovante', 'Permite reimprimir comprovante de uma venda.', 'medium', true, 2141, 'operational', 'commercial', 'Comercial', 'pdv', 'PDV', 'receipt_reprint', 'Reimprimir', 'pdv.history.view', 'pdv.view', '{"admin":true,"manager":true,"cashier":true}'::jsonb, 2141, true)
on conflict (permission_key) do update
set
  category = excluded.category,
  label = excluded.label,
  description = excluded.description,
  risk = excluded.risk,
  active = excluded.active,
  sort_order = excluded.sort_order,
  macro_group = excluded.macro_group,
  group_key = excluded.group_key,
  group_label = excluded.group_label,
  item_key = excluded.item_key,
  item_label = excluded.item_label,
  action_key = excluded.action_key,
  action_label = excluded.action_label,
  depends_on = excluded.depends_on,
  access_permission_key = excluded.access_permission_key,
  default_role_allowed = excluded.default_role_allowed,
  ui_sort_order = excluded.ui_sort_order,
  show_in_permission_ui = excluded.show_in_permission_ui,
  updated_at = now();
