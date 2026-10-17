-- Reservas na linha do tempo operacional + correção de horário + suspensão imediata do timer após pagamento.
-- Mantém reserva como evento não-físico; a baixa física continua ocorrendo apenas no fluxo de conclusão/expedição.

alter table public.stock_reservations
  alter column created_at set default now();

-- Corrige o legado que gravou o relógio UTC como timestamptz local (+3h no Brasil).
-- Para reservas criadas junto ao pedido público, o instante correto é o created_at do pedido.
update public.stock_reservations sr
set created_at = o.created_at
from public.orders o
where o.id = sr.order_id
  and o.store_id = sr.store_id
  and sr.metadata->>'source' = 'public_order_rpc'
  and sr.created_at between o.created_at + interval '2 hours 50 minutes'
                        and o.created_at + interval '3 hours 10 minutes';

create or replace view public.v_stock_operational_events as
select
  sm.id,
  sm.store_id,
  sm.product_id,
  p.name::text as product_name,
  sm.order_id,
  sm.quantity,
  sm.type::text as type,
  sm.reason,
  sm.user_id,
  sm.previous_stock,
  sm.new_stock,
  sm.created_at,
  sm.affects_physical,
  sm.source,
  sm.source_id,
  sm.reason_code,
  coalesce(sm.metadata,'{}'::jsonb) as metadata,
  sm.created_by,
  sm.supplier_id,
  sm.location_id,
  loc.code::text as location_code,
  loc.name::text as location_name,
  sm.from_location_id,
  fl.code::text as from_location_code,
  fl.name::text as from_location_name,
  sm.to_location_id,
  tl.code::text as to_location_code,
  tl.name::text as to_location_name,
  sm.transfer_id
from public.stock_movements sm
join public.products p
  on p.id = sm.product_id
 and p.store_id = sm.store_id
left join public.stock_locations loc
  on loc.id = sm.location_id
 and loc.store_id = sm.store_id
left join public.stock_locations fl
  on fl.id = sm.from_location_id
 and fl.store_id = sm.store_id
left join public.stock_locations tl
  on tl.id = sm.to_location_id
 and tl.store_id = sm.store_id

union all

select
  sr.id,
  sr.store_id,
  sr.product_id,
  p.name::text as product_name,
  sr.order_id,
  sr.quantity,
  'reservation'::text as type,
  ('Reserva criada para o pedido ' || coalesce(o.order_code, sr.order_id::text))::text as reason,
  null::uuid as user_id,
  0::integer as previous_stock,
  0::integer as new_stock,
  sr.created_at,
  false as affects_physical,
  'reservation'::text as source,
  sr.order_id as source_id,
  'order_reservation'::text as reason_code,
  coalesce(sr.metadata,'{}'::jsonb)
    || jsonb_strip_nulls(jsonb_build_object(
      'reservation_status', sr.status,
      'reservation_expires_at', sr.expires_at,
      'reservation_consumed_at', sr.consumed_at,
      'reservation_cancelled_at', sr.cancelled_at,
      'order_code', o.order_code,
      'customer_name', o.customer_name,
      'customer_id', o.customer_id,
      'payment_status', o.payment_status,
      'payment_method_code', o.payment_method_code,
      'fulfillment_type', o.fulfillment_type,
      'sales_channel', o.sales_channel,
      'affects_physical', false
    )) as metadata,
  null::uuid as created_by,
  null::uuid as supplier_id,
  sr.location_id,
  loc.code::text as location_code,
  loc.name::text as location_name,
  null::uuid as from_location_id,
  null::text as from_location_code,
  null::text as from_location_name,
  null::uuid as to_location_id,
  null::text as to_location_code,
  null::text as to_location_name,
  null::uuid as transfer_id
from public.stock_reservations sr
join public.products p
  on p.id = sr.product_id
 and p.store_id = sr.store_id
left join public.orders o
  on o.id = sr.order_id
 and o.store_id = sr.store_id
left join public.stock_locations loc
  on loc.id = sr.location_id
 and loc.store_id = sr.store_id;

revoke all on public.v_stock_operational_events from public, anon, authenticated;
grant select on public.v_stock_operational_events to service_role;

create or replace function public.get_product_stock_movements(
  p_store_id uuid,
  p_product_id uuid
)
returns table(
  id uuid,
  store_id uuid,
  product_id uuid,
  product_name text,
  order_id uuid,
  quantity integer,
  type text,
  reason text,
  user_id uuid,
  previous_stock integer,
  new_stock integer,
  created_at timestamptz,
  created_at_display text,
  affects_physical boolean,
  source text,
  source_id uuid,
  reason_code text,
  metadata jsonb,
  created_by uuid,
  supplier_id uuid,
  location_id uuid,
  location_code text,
  location_name text,
  from_location_id uuid,
  from_location_code text,
  from_location_name text,
  to_location_id uuid,
  to_location_code text,
  to_location_name text,
  transfer_id uuid
)
language plpgsql
security definer
set search_path = public
as $function$
begin
  if p_store_id is null or not (
    public.app_is_store_owner(p_store_id)
    or public.user_has_store_permission_v2(p_store_id,'stock.view')
    or public.user_has_store_permission_v2(p_store_id,'stock.adjust')
    or public.user_has_store_permission_v2(p_store_id,'stock.transfer')
    or public.user_has_store_permission_v2(p_store_id,'products.view')
  ) then
    raise exception 'Acesso negado à loja informada.';
  end if;

  return query
  select
    e.id,
    e.store_id,
    e.product_id,
    e.product_name,
    e.order_id,
    e.quantity,
    e.type,
    case
      when d.id is null then e.reason
      else concat_ws(
        ' ',
        e.reason,
        'Divergência de estoque:',
        case d.status
          when 'open' then 'aberta.'
          when 'under_review' then 'em análise.'
          when 'waiting_stock_count' then 'aguardando contagem.'
          when 'resolved' then 'resolvida.'
          when 'cancelled' then 'cancelada.'
          else d.status || '.'
        end,
        case d.resolution_type
          when 'inventory_count_corrected' then 'Resolução: contagem de estoque corrigida.'
          when 'physical_item_found' then 'Resolução: item físico localizado.'
          when 'loss_or_breakage_registered' then 'Resolução: perda ou quebra registrada.'
          when 'registration_or_location_error' then 'Resolução: erro de cadastro ou local.'
          when 'other' then 'Resolução: outro tratamento.'
          else null
        end,
        case
          when nullif(btrim(d.resolution_notes),'') is not null
            then 'Observação: ' || d.resolution_notes
          else null
        end
      )
    end::text as reason,
    coalesce(d.resolved_by,e.user_id),
    e.previous_stock,
    e.new_stock,
    e.created_at,
    public.format_datetime_sao_paulo(e.created_at),
    e.affects_physical,
    e.source,
    e.source_id,
    e.reason_code,
    e.metadata
      || case
        when d.id is null then '{}'::jsonb
        else jsonb_build_object(
          'discrepancy_id',d.id,
          'discrepancy_status',d.status,
          'discrepancy_status_label',
            case d.status
              when 'open' then 'Aberta'
              when 'under_review' then 'Em análise'
              when 'waiting_stock_count' then 'Aguardando contagem'
              when 'resolved' then 'Resolvida'
              when 'cancelled' then 'Cancelada'
              else d.status
            end,
          'discrepancy_resolution_type',d.resolution_type,
          'discrepancy_resolution_notes',d.resolution_notes,
          'discrepancy_resolved_by',d.resolved_by,
          'discrepancy_resolved_at',d.resolved_at,
          'discrepancy_updated_at',d.updated_at,
          'discrepancy_link','/admin/stock/divergences'
        )
      end,
    e.created_by,
    e.supplier_id,
    e.location_id,
    e.location_code,
    e.location_name,
    e.from_location_id,
    e.from_location_code,
    e.from_location_name,
    e.to_location_id,
    e.to_location_code,
    e.to_location_name,
    e.transfer_id
  from public.v_stock_operational_events e
  left join lateral (
    select occ.*
    from public.stock_discrepancy_occurrences occ
    cross join lateral jsonb_array_elements(coalesce(occ.items,'[]'::jsonb)) item(value)
    where e.type <> 'reservation'
      and occ.store_id=e.store_id
      and occ.order_id=e.order_id
      and nullif(item.value->>'product_id','')::uuid=e.product_id
    order by occ.updated_at desc
    limit 1
  ) d on true
  where e.store_id=p_store_id
    and e.product_id=p_product_id
  order by e.created_at desc
  limit 500;
end;
$function$;

revoke all on function public.get_product_stock_movements(uuid,uuid) from public;
grant execute on function public.get_product_stock_movements(uuid,uuid) to authenticated;

create or replace function public.get_stock_movements_safe(
  p_store_id uuid,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_items jsonb;
  v_total integer := 0;
begin
  if p_store_id is null then
    return jsonb_build_object('ok',false,'error','missing_store_id','items','[]'::jsonb,'total',0);
  end if;

  if coalesce(auth.role(),'') in ('anon','authenticated') then
    if auth.uid() is null or not (
      public.app_is_store_owner(p_store_id)
      or public.user_has_store_permission_v2(p_store_id,'stock.view')
      or public.user_has_store_permission_v2(p_store_id,'stock.adjust')
      or public.user_has_store_permission_v2(p_store_id,'stock.transfer')
      or public.user_has_store_permission_v2(p_store_id,'products.view')
    ) then
      return jsonb_build_object('ok',false,'error','access_denied','items','[]'::jsonb,'total',0);
    end if;
  end if;

  select count(*)::integer
    into v_total
  from public.v_stock_operational_events e
  where e.store_id=p_store_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',q.id,
        'product_id',q.product_id,
        'product_name',q.product_name,
        'store_id',q.store_id,
        'location_id',q.location_id,
        'location_code',q.location_code,
        'location_name',q.location_name,
        'from_location_id',q.from_location_id,
        'from_location_code',q.from_location_code,
        'from_location_name',q.from_location_name,
        'to_location_id',q.to_location_id,
        'to_location_code',q.to_location_code,
        'to_location_name',q.to_location_name,
        'transfer_id',q.transfer_id,
        'quantity',q.quantity,
        'type',q.type,
        'reason',q.reason,
        'previous_stock',q.previous_stock,
        'new_stock',q.new_stock,
        'created_at',q.created_at,
        'created_at_display',public.format_datetime_sao_paulo(q.created_at),
        'affects_physical',q.affects_physical,
        'source',q.source,
        'source_id',q.source_id,
        'reason_code',q.reason_code,
        'metadata',q.metadata,
        'order_id',q.order_id,
        'user_id',q.user_id,
        'created_by',q.created_by,
        'supplier_id',q.supplier_id
      )
      order by q.created_at desc
    ),
    '[]'::jsonb
  )
  into v_items
  from (
    select *
    from public.v_stock_operational_events e
    where e.store_id=p_store_id
    order by e.created_at desc
    limit greatest(1,least(coalesce(p_limit,50),200))
    offset greatest(0,coalesce(p_offset,0))
  ) q;

  return jsonb_build_object('ok',true,'items',v_items,'total',v_total);
end;
$function$;

revoke all on function public.get_stock_movements_safe(uuid,integer,integer) from public, anon;
grant execute on function public.get_stock_movements_safe(uuid,integer,integer) to authenticated;

create or replace function public.apply_online_payment_settlement_internal(
  p_intent_id uuid,
  p_provider_event_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','auth','pg_temp'
as $function$
declare
  v_intent public.online_payment_intents%rowtype;
  v_provider public.store_online_payment_providers%rowtype;
  v_order public.orders%rowtype;
  v_payment public.store_payment_methods%rowtype;
  v_account_id uuid;
  v_account_ref text;
  v_entry_id uuid;
  v_base_code text;
  v_payment_method_enum public.payment_method;
  v_paid_at timestamptz;
begin
  if coalesce(auth.role(),'') <> 'service_role' then
    return jsonb_build_object('ok',false,'error','service_role_required');
  end if;

  select * into v_intent
  from public.online_payment_intents
  where id=p_intent_id
  for update;

  if v_intent.id is null then
    return jsonb_build_object('ok',false,'error','payment_intent_not_found');
  end if;
  if v_intent.status <> 'paid' then
    return jsonb_build_object('ok',false,'error','payment_not_received','status',v_intent.status);
  end if;
  if v_intent.order_id is null then
    return jsonb_build_object('ok',true,'skipped',true,'reason','intent_without_order');
  end if;

  select * into v_provider
  from public.store_online_payment_providers
  where id=v_intent.provider_id and store_id=v_intent.store_id
  for update;

  if v_provider.id is null or not v_provider.enabled then
    return jsonb_build_object('ok',false,'error','payment_provider_inactive');
  end if;

  select * into v_order
  from public.orders
  where id=v_intent.order_id and store_id=v_intent.store_id
  for update;

  if v_order.id is null then
    return jsonb_build_object('ok',false,'error','order_not_found');
  end if;
  if v_order.status::text='cancelled' then
    return jsonb_build_object('ok',false,'error','order_cancelled');
  end if;
  if abs(coalesce(v_order.total,0)-coalesce(v_intent.amount,0))>0.01 then
    return jsonb_build_object(
      'ok',false,'error','payment_amount_mismatch',
      'order_total',v_order.total,
      'payment_amount',v_intent.amount
    );
  end if;

  select * into v_payment
  from public.store_payment_methods
  where store_id=v_intent.store_id
    and code=v_intent.method_code
    and active=true
  limit 1;

  if v_payment.id is null then
    return jsonb_build_object('ok',false,'error','payment_method_not_available');
  end if;

  v_base_code := coalesce(nullif(v_payment.base_code,''),v_payment.code);
  v_account_ref := nullif(trim(coalesce(v_provider.public_config->>'settlement_financial_account_id','')),'');

  if v_account_ref is null then
    return jsonb_build_object('ok',false,'error','settlement_account_required');
  end if;

  begin
    v_account_id := v_account_ref::uuid;
  exception when invalid_text_representation then
    return jsonb_build_object('ok',false,'error','invalid_settlement_account');
  end;

  if not exists (
    select 1
    from public.store_financial_accounts account
    where account.id=v_account_id
      and account.store_id=v_intent.store_id
      and account.active=true
      and exists (
        select 1
        from public.store_financial_account_payment_methods account_method
        where account_method.store_id=v_intent.store_id
          and account_method.account_id=account.id
          and account_method.active=true
          and account_method.payment_method_code in (v_payment.code,v_base_code)
      )
  ) then
    return jsonb_build_object('ok',false,'error','settlement_account_incompatible');
  end if;

  v_payment_method_enum := case
    when v_base_code='cash' then 'cash'::public.payment_method
    when v_base_code='pix' then 'pix'::public.payment_method
    when v_base_code in ('debit_card','credit_card') then 'card'::public.payment_method
    else 'pending'::public.payment_method
  end;
  v_paid_at := coalesce(v_intent.paid_at,now());

  update public.orders
  set payment_status='paid',
      payment_method=v_payment_method_enum,
      payment_method_code=v_payment.code,
      expires_at=null,
      available_until=null,
      cancellation_grace_until=null,
      payment_metadata=coalesce(payment_metadata,'{}'::jsonb) || jsonb_build_object(
        'code',v_payment.code,
        'name',v_payment.name,
        'base_code',v_base_code,
        'status','paid',
        'confirmed_at',v_paid_at,
        'confirmation_mode','api',
        'provider_code',v_provider.provider_code,
        'provider_environment',v_provider.environment,
        'online_payment_intent_id',v_intent.id,
        'provider_event_id',p_provider_event_id
      ),
      metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
        'online_payment_received_at',v_paid_at,
        'online_payment_intent_id',v_intent.id,
        'online_payment_provider',v_provider.provider_code,
        'reservation_timer_suspended_at',v_paid_at,
        'reservation_timer_suspension_reason','payment_confirmed'
      ),
      commercial_metadata=coalesce(commercial_metadata,'{}'::jsonb) || jsonb_build_object(
        'timer_suspended_at',v_paid_at,
        'timer_suspended_reason','payment_confirmed'
      ),
      updated_at=now()
  where id=v_order.id and store_id=v_order.store_id;

  -- Pagamento confirmado interrompe o TTL, mas NÃO consome a reserva e NÃO baixa físico.
  update public.stock_reservations sr
  set expires_at='infinity'::timestamptz,
      metadata=coalesce(sr.metadata,'{}'::jsonb) || jsonb_build_object(
        'timer_suspended_at',v_paid_at,
        'timer_suspended_reason','payment_confirmed',
        'payment_status','paid',
        'online_payment_intent_id',v_intent.id,
        'provider_event_id',p_provider_event_id
      )
  where sr.order_id=v_order.id
    and sr.store_id=v_order.store_id
    and sr.status='active';

  select id into v_entry_id
  from public.cashbook_entries
  where store_id=v_order.store_id
    and order_id=v_order.id
    and type='sale'
    and status<>'cancelled'
  order by created_at desc
  limit 1
  for update;

  if v_entry_id is null then
    insert into public.cashbook_entries (
      store_id,entry_code,entry_date,occurred_at,type,direction,amount,
      description,payment_method,payment_method_code,source,source_id,
      order_id,customer_id,status,affects_balance,
      destination_financial_account_id,metadata,created_by
    ) values (
      v_order.store_id,
      public.generate_cashbook_entry_code(),
      (v_paid_at at time zone 'America/Sao_Paulo')::date,
      v_paid_at,
      'sale','in',v_intent.amount,
      'Pagamento online confirmado pelo pedido ' || v_order.order_code,
      v_payment.name,v_payment.code,'order',v_order.id,
      v_order.id,v_order.customer_id,'confirmed',true,
      v_account_id,
      jsonb_build_object(
        'order_code',v_order.order_code,
        'online_payment_intent_id',v_intent.id,
        'provider_code',v_provider.provider_code,
        'provider_environment',v_provider.environment,
        'provider_event_id',p_provider_event_id,
        'settlement_financial_account_id',v_account_id,
        'payment_method_base_code',v_base_code
      ),
      null
    )
    returning id into v_entry_id;
  else
    update public.cashbook_entries
    set entry_date=(v_paid_at at time zone 'America/Sao_Paulo')::date,
        occurred_at=v_paid_at,
        amount=v_intent.amount,
        payment_method=v_payment.name,
        payment_method_code=v_payment.code,
        status='confirmed',
        affects_balance=true,
        destination_financial_account_id=v_account_id,
        metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
          'online_payment_intent_id',v_intent.id,
          'provider_code',v_provider.provider_code,
          'provider_environment',v_provider.environment,
          'provider_event_id',p_provider_event_id,
          'settlement_financial_account_id',v_account_id,
          'payment_method_base_code',v_base_code
        ),
        updated_at=now()
    where id=v_entry_id;
  end if;

  return jsonb_build_object(
    'ok',true,
    'intent_id',v_intent.id,
    'order_id',v_order.id,
    'cashbook_entry_id',v_entry_id,
    'settlement_financial_account_id',v_account_id,
    'reservation_timer_suspended',true
  );
end;
$function$;

revoke all on function public.apply_online_payment_settlement_internal(uuid,text)
  from public,anon,authenticated;
grant execute on function public.apply_online_payment_settlement_internal(uuid,text)
  to service_role;
