-- Audited post-completion sale adjustments: full cancellation and partial returns.
-- A completed sale remains historically completed; reversals are recorded as explicit
-- stock and cashbook events and reflected through payment_status / commercial metadata.

create table if not exists public.sale_adjustments (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete restrict,
  adjustment_type text not null check (adjustment_type in ('full_cancellation', 'partial_return')),
  reason_code text not null check (reason_code in (
    'customer_withdrew',
    'customer_return',
    'sale_entered_by_mistake',
    'duplicate_sale',
    'wrong_item',
    'quality_issue',
    'other'
  )),
  reason_notes text not null,
  refund_amount numeric(14,2) not null check (refund_amount > 0),
  status text not null default 'completed' check (status in ('completed', 'cancelled')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.sale_adjustment_items (
  id uuid primary key default gen_random_uuid(),
  adjustment_id uuid not null references public.sale_adjustments(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete restrict,
  product_id uuid references public.products(id) on delete set null,
  quantity integer not null check (quantity > 0),
  unit_refund_amount numeric(14,4) not null check (unit_refund_amount >= 0),
  refund_amount numeric(14,2) not null check (refund_amount >= 0),
  stock_returned_quantity integer not null default 0 check (stock_returned_quantity >= 0),
  stock_movement_id uuid references public.stock_movements(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  unique (adjustment_id, order_item_id)
);

create index if not exists idx_sale_adjustments_store_order_created
  on public.sale_adjustments(store_id, order_id, created_at desc);
create index if not exists idx_sale_adjustment_items_adjustment
  on public.sale_adjustment_items(adjustment_id);
create index if not exists idx_sale_adjustment_items_order_item
  on public.sale_adjustment_items(order_item_id);

alter table public.sale_adjustments enable row level security;
alter table public.sale_adjustment_items enable row level security;

drop policy if exists sale_adjustments_select_store_member on public.sale_adjustments;
create policy sale_adjustments_select_store_member
  on public.sale_adjustments
  for select
  to authenticated
  using (public.is_store_member(store_id));

drop policy if exists sale_adjustment_items_select_store_member on public.sale_adjustment_items;
create policy sale_adjustment_items_select_store_member
  on public.sale_adjustment_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.sale_adjustments sa
      where sa.id = adjustment_id
        and public.is_store_member(sa.store_id)
    )
  );

revoke insert, update, delete on public.sale_adjustments from anon, authenticated;
revoke insert, update, delete on public.sale_adjustment_items from anon, authenticated;
grant select on public.sale_adjustments to authenticated;
grant select on public.sale_adjustment_items to authenticated;

create or replace function public.get_sale_adjustments_safe(
  p_store_id uuid,
  p_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $$
declare
  v_order_total numeric := 0;
  v_total_refunded numeric := 0;
  v_items jsonb := '[]'::jsonb;
  v_can_adjust boolean := false;
begin
  if p_store_id is null or p_order_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_parameters');
  end if;

  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    if auth.uid() is null or not (
      public.app_is_store_owner(p_store_id)
      or public.user_has_store_permission_v2(p_store_id, 'orders.view')
    ) then
      return jsonb_build_object('ok', false, 'error', 'access_denied');
    end if;
  end if;

  select o.total
  into v_order_total
  from public.orders o
  where o.id = p_order_id
    and o.store_id = p_store_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'order_not_found');
  end if;

  v_can_adjust :=
    public.app_is_store_owner(p_store_id)
    or (
      (
        public.user_has_store_permission_v2(p_store_id, 'orders.cancel')
        or public.user_has_store_permission_v2(p_store_id, 'orders.manage')
      )
      and public.user_has_store_permission_v2(p_store_id, 'stock.adjust')
      and (
        public.user_has_store_permission_v2(p_store_id, 'cashbook.cancel')
        or public.user_has_store_permission_v2(p_store_id, 'financial.manage')
      )
    );

  select coalesce(sum(sa.refund_amount), 0)
  into v_total_refunded
  from public.sale_adjustments sa
  where sa.store_id = p_store_id
    and sa.order_id = p_order_id
    and sa.status = 'completed';

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', sa.id,
        'adjustment_type', sa.adjustment_type,
        'reason_code', sa.reason_code,
        'reason_notes', sa.reason_notes,
        'refund_amount', sa.refund_amount,
        'status', sa.status,
        'created_by', sa.created_by,
        'created_at', sa.created_at,
        'metadata', sa.metadata,
        'items', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', sai.id,
              'order_item_id', sai.order_item_id,
              'product_id', sai.product_id,
              'product_name', coalesce(p.name, oi.product_snapshot->>'name', 'Produto'),
              'quantity', sai.quantity,
              'unit_refund_amount', sai.unit_refund_amount,
              'refund_amount', sai.refund_amount,
              'stock_returned_quantity', sai.stock_returned_quantity,
              'stock_movement_id', sai.stock_movement_id,
              'metadata', sai.metadata
            )
            order by sai.id
          )
          from public.sale_adjustment_items sai
          left join public.order_items oi on oi.id = sai.order_item_id
          left join public.products p on p.id = sai.product_id
          where sai.adjustment_id = sa.id
        ), '[]'::jsonb)
      )
      order by sa.created_at desc, sa.id desc
    ),
    '[]'::jsonb
  )
  into v_items
  from public.sale_adjustments sa
  where sa.store_id = p_store_id
    and sa.order_id = p_order_id;

  return jsonb_build_object(
    'ok', true,
    'can_adjust', v_can_adjust,
    'total_refunded', v_total_refunded,
    'remaining_refundable', greatest(coalesce(v_order_total, 0) - v_total_refunded, 0),
    'fully_refunded', v_total_refunded >= coalesce(v_order_total, 0) - 0.005,
    'adjustments', v_items
  );
end;
$$;

create or replace function public.adjust_completed_sale_safe(
  p_store_id uuid,
  p_order_id uuid,
  p_adjustment_type text,
  p_reason_code text,
  p_reason_notes text,
  p_items jsonb default null,
  p_refund_account_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $$
declare
  v_order record;
  v_sale_entry record;
  v_adjustment_id uuid;
  v_refund_entry_id uuid;
  v_refund_entry_code text;
  v_refund_account_id uuid;
  v_refund_account_active boolean;
  v_previous_refund numeric := 0;
  v_remaining_refundable numeric := 0;
  v_refund_amount numeric := 0;
  v_item_refund_total numeric := 0;
  v_cumulative_refund numeric := 0;
  v_requested_count integer := 0;
  v_distinct_count integer := 0;
  v_req record;
  v_item record;
  v_remaining_qty integer := 0;
  v_unit_refund numeric := 0;
  v_line_refund numeric := 0;
  v_physical_sold integer := 0;
  v_prior_stock_returned integer := 0;
  v_stock_return_qty integer := 0;
  v_location_id uuid;
  v_stock_movement_id uuid;
  v_reason_label text;
  v_now timestamptz := now();
  v_stock_warning_count integer := 0;
  v_selected_items jsonb := coalesce(p_items, '[]'::jsonb);
begin
  if p_store_id is null or p_order_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_parameters');
  end if;

  if p_adjustment_type not in ('full_cancellation', 'partial_return') then
    return jsonb_build_object('ok', false, 'error', 'invalid_adjustment_type');
  end if;

  if p_reason_code not in (
    'customer_withdrew',
    'customer_return',
    'sale_entered_by_mistake',
    'duplicate_sale',
    'wrong_item',
    'quality_issue',
    'other'
  ) then
    return jsonb_build_object('ok', false, 'error', 'invalid_reason_code');
  end if;

  if length(trim(coalesce(p_reason_notes, ''))) < 3 then
    return jsonb_build_object('ok', false, 'error', 'reason_notes_required');
  end if;

  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    if auth.uid() is null or not (
      public.app_is_store_owner(p_store_id)
      or (
        (
          public.user_has_store_permission_v2(p_store_id, 'orders.cancel')
          or public.user_has_store_permission_v2(p_store_id, 'orders.manage')
        )
        and public.user_has_store_permission_v2(p_store_id, 'stock.adjust')
        and (
          public.user_has_store_permission_v2(p_store_id, 'cashbook.cancel')
          or public.user_has_store_permission_v2(p_store_id, 'financial.manage')
        )
      )
    ) then
      return jsonb_build_object('ok', false, 'error', 'access_denied');
    end if;
  end if;

  select
    o.id,
    o.store_id,
    o.order_code,
    o.status::text as status,
    o.total,
    o.delivery_fee,
    o.customer_id,
    o.payment_method_code,
    o.payment_status,
    o.payment_metadata,
    o.commercial_metadata,
    o.metadata
  into v_order
  from public.orders o
  where o.id = p_order_id
    and o.store_id = p_store_id
  for update;

  if v_order.id is null then
    return jsonb_build_object('ok', false, 'error', 'order_not_found');
  end if;

  if v_order.status <> 'completed' then
    return jsonb_build_object('ok', false, 'error', 'sale_not_completed');
  end if;

  select coalesce(sum(sa.refund_amount), 0)
  into v_previous_refund
  from public.sale_adjustments sa
  where sa.store_id = p_store_id
    and sa.order_id = p_order_id
    and sa.status = 'completed';

  v_remaining_refundable := greatest(coalesce(v_order.total, 0) - v_previous_refund, 0);
  if v_remaining_refundable <= 0.005 then
    return jsonb_build_object('ok', false, 'error', 'sale_already_fully_refunded');
  end if;

  select
    e.id,
    e.entry_code,
    e.payment_method,
    e.payment_method_code,
    e.destination_financial_account_id,
    e.source_financial_account_id,
    e.account_plan_code
  into v_sale_entry
  from public.cashbook_entries e
  where e.store_id = p_store_id
    and e.order_id = p_order_id
    and e.type = 'sale'
    and e.direction = 'in'
    and e.status = 'confirmed'
    and e.affects_balance = true
  order by e.occurred_at desc, e.created_at desc
  limit 1;

  if v_sale_entry.id is null then
    return jsonb_build_object('ok', false, 'error', 'sale_financial_entry_not_found');
  end if;

  v_refund_account_id := coalesce(
    p_refund_account_id,
    v_sale_entry.destination_financial_account_id,
    v_sale_entry.source_financial_account_id
  );

  if v_refund_account_id is null then
    return jsonb_build_object('ok', false, 'error', 'refund_account_required');
  end if;

  select a.active
  into v_refund_account_active
  from public.store_financial_accounts a
  where a.id = v_refund_account_id
    and a.store_id = p_store_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_refund_account');
  end if;

  if p_refund_account_id is not null and v_refund_account_active is not true then
    return jsonb_build_object('ok', false, 'error', 'refund_account_inactive');
  end if;

  if p_adjustment_type = 'partial_return' then
    if jsonb_typeof(v_selected_items) <> 'array' or jsonb_array_length(v_selected_items) = 0 then
      return jsonb_build_object('ok', false, 'error', 'items_required');
    end if;

    select count(*), count(distinct x.order_item_id)
    into v_requested_count, v_distinct_count
    from jsonb_to_recordset(v_selected_items) as x(order_item_id uuid, quantity integer);

    if v_requested_count <> v_distinct_count then
      return jsonb_build_object('ok', false, 'error', 'duplicate_order_item');
    end if;

    for v_req in
      select x.order_item_id, x.quantity
      from jsonb_to_recordset(v_selected_items) as x(order_item_id uuid, quantity integer)
    loop
      if v_req.order_item_id is null or coalesce(v_req.quantity, 0) <= 0 then
        return jsonb_build_object('ok', false, 'error', 'invalid_item_quantity');
      end if;

      select oi.id, oi.product_id, oi.quantity, oi.unit_price, coalesce(oi.discount, 0) as discount
      into v_item
      from public.order_items oi
      where oi.id = v_req.order_item_id
        and oi.order_id = p_order_id
        and oi.store_id = p_store_id;

      if v_item.id is null then
        return jsonb_build_object('ok', false, 'error', 'order_item_not_found');
      end if;

      select greatest(v_item.quantity - coalesce(sum(sai.quantity), 0), 0)::integer
      into v_remaining_qty
      from public.sale_adjustment_items sai
      join public.sale_adjustments sa on sa.id = sai.adjustment_id
      where sa.store_id = p_store_id
        and sa.order_id = p_order_id
        and sa.status = 'completed'
        and sai.order_item_id = v_item.id;

      if v_req.quantity > v_remaining_qty then
        return jsonb_build_object(
          'ok', false,
          'error', 'quantity_exceeds_remaining',
          'order_item_id', v_item.id,
          'remaining_quantity', v_remaining_qty
        );
      end if;

      v_unit_refund := case
        when v_item.quantity > 0 then ((v_item.unit_price * v_item.quantity) - v_item.discount) / v_item.quantity
        else 0
      end;
      v_line_refund := round(v_unit_refund * v_req.quantity, 2);
      v_refund_amount := v_refund_amount + v_line_refund;
      v_item_refund_total := v_item_refund_total + v_line_refund;
    end loop;

    if v_refund_amount <= 0 or v_refund_amount > v_remaining_refundable + 0.005 then
      return jsonb_build_object('ok', false, 'error', 'invalid_refund_amount');
    end if;
  else
    v_refund_amount := v_remaining_refundable;
  end if;

  v_reason_label := case p_reason_code
    when 'customer_withdrew' then 'Cliente desistiu'
    when 'customer_return' then 'Devolução pelo cliente'
    when 'sale_entered_by_mistake' then 'Venda ou baixa lançada por engano'
    when 'duplicate_sale' then 'Venda duplicada'
    when 'wrong_item' then 'Produto/item incorreto'
    when 'quality_issue' then 'Problema de qualidade'
    else 'Outro motivo'
  end;

  insert into public.sale_adjustments (
    store_id,
    order_id,
    adjustment_type,
    reason_code,
    reason_notes,
    refund_amount,
    status,
    created_by,
    created_at,
    metadata
  ) values (
    p_store_id,
    p_order_id,
    p_adjustment_type,
    p_reason_code,
    trim(p_reason_notes),
    round(v_refund_amount, 2),
    'completed',
    auth.uid(),
    v_now,
    jsonb_build_object(
      'order_code', v_order.order_code,
      'source', 'sale_detail',
      'original_sale_cashbook_entry_id', v_sale_entry.id,
      'original_sale_cashbook_entry_code', v_sale_entry.entry_code,
      'refund_account_id', v_refund_account_id
    )
  ) returning id into v_adjustment_id;

  if p_adjustment_type = 'partial_return' then
    for v_req in
      select x.order_item_id, x.quantity
      from jsonb_to_recordset(v_selected_items) as x(order_item_id uuid, quantity integer)
    loop
      select oi.id, oi.product_id, oi.quantity, oi.unit_price, coalesce(oi.discount, 0) as discount
      into v_item
      from public.order_items oi
      where oi.id = v_req.order_item_id
        and oi.order_id = p_order_id
        and oi.store_id = p_store_id;

      v_remaining_qty := v_req.quantity;
      v_unit_refund := case
        when v_item.quantity > 0 then ((v_item.unit_price * v_item.quantity) - v_item.discount) / v_item.quantity
        else 0
      end;
      v_line_refund := round(v_unit_refund * v_remaining_qty, 2);

      select
        coalesce(sum(abs(sm.quantity)) filter (where sm.quantity < 0 and sm.affects_physical), 0)::integer,
        (array_agg(sm.location_id order by sm.created_at desc) filter (where sm.quantity < 0 and sm.affects_physical and sm.location_id is not null))[1]
      into v_physical_sold, v_location_id
      from public.stock_movements sm
      where sm.store_id = p_store_id
        and sm.order_id = p_order_id
        and sm.product_id = v_item.product_id;

      select coalesce(sum(sai.stock_returned_quantity), 0)::integer
      into v_prior_stock_returned
      from public.sale_adjustment_items sai
      join public.sale_adjustments sa on sa.id = sai.adjustment_id
      where sa.store_id = p_store_id
        and sa.order_id = p_order_id
        and sa.status = 'completed'
        and sai.product_id = v_item.product_id;

      v_stock_return_qty := least(v_remaining_qty, greatest(v_physical_sold - v_prior_stock_returned, 0));
      v_stock_movement_id := null;

      if v_stock_return_qty > 0 then
        select r.movement_id
        into v_stock_movement_id
        from public.apply_stock_movement_delta_v2(
          p_store_id,
          v_item.product_id,
          'entry'::public.stock_movement_type,
          v_stock_return_qty,
          true,
          format('Devolução da venda %s · %s', coalesce(v_order.order_code, p_order_id::text), v_reason_label),
          p_order_id,
          'sale_adjustment',
          jsonb_build_object(
            'sale_adjustment_id', v_adjustment_id,
            'sale_adjustment_type', p_adjustment_type,
            'reason_code', p_reason_code,
            'reason_notes', trim(p_reason_notes),
            'order_item_id', v_item.id,
            'order_code', v_order.order_code
          ),
          auth.uid(),
          v_location_id,
          null,
          null,
          null,
          null,
          'sale_partial_return',
          null,
          true
        ) r
        limit 1;
      end if;

      if v_stock_return_qty < v_remaining_qty then
        v_stock_warning_count := v_stock_warning_count + 1;
      end if;

      insert into public.sale_adjustment_items (
        adjustment_id,
        order_item_id,
        product_id,
        quantity,
        unit_refund_amount,
        refund_amount,
        stock_returned_quantity,
        stock_movement_id,
        metadata
      ) values (
        v_adjustment_id,
        v_item.id,
        v_item.product_id,
        v_remaining_qty,
        v_unit_refund,
        v_line_refund,
        v_stock_return_qty,
        v_stock_movement_id,
        jsonb_build_object(
          'physical_quantity_originally_moved', v_physical_sold,
          'stock_quantity_already_returned_before', v_prior_stock_returned,
          'stock_return_shortfall', greatest(v_remaining_qty - v_stock_return_qty, 0),
          'location_id', v_location_id
        )
      );
    end loop;
  else
    for v_item in
      select oi.id, oi.product_id, oi.quantity, oi.unit_price, coalesce(oi.discount, 0) as discount
      from public.order_items oi
      where oi.order_id = p_order_id
        and oi.store_id = p_store_id
      order by oi.id
    loop
      select greatest(v_item.quantity - coalesce(sum(sai.quantity), 0), 0)::integer
      into v_remaining_qty
      from public.sale_adjustment_items sai
      join public.sale_adjustments sa on sa.id = sai.adjustment_id
      where sa.store_id = p_store_id
        and sa.order_id = p_order_id
        and sa.status = 'completed'
        and sai.order_item_id = v_item.id;

      if v_remaining_qty <= 0 then
        continue;
      end if;

      v_unit_refund := case
        when v_item.quantity > 0 then ((v_item.unit_price * v_item.quantity) - v_item.discount) / v_item.quantity
        else 0
      end;
      v_line_refund := round(v_unit_refund * v_remaining_qty, 2);
      v_item_refund_total := v_item_refund_total + v_line_refund;

      select
        coalesce(sum(abs(sm.quantity)) filter (where sm.quantity < 0 and sm.affects_physical), 0)::integer,
        (array_agg(sm.location_id order by sm.created_at desc) filter (where sm.quantity < 0 and sm.affects_physical and sm.location_id is not null))[1]
      into v_physical_sold, v_location_id
      from public.stock_movements sm
      where sm.store_id = p_store_id
        and sm.order_id = p_order_id
        and sm.product_id = v_item.product_id;

      select coalesce(sum(sai.stock_returned_quantity), 0)::integer
      into v_prior_stock_returned
      from public.sale_adjustment_items sai
      join public.sale_adjustments sa on sa.id = sai.adjustment_id
      where sa.store_id = p_store_id
        and sa.order_id = p_order_id
        and sa.status = 'completed'
        and sai.product_id = v_item.product_id;

      v_stock_return_qty := least(v_remaining_qty, greatest(v_physical_sold - v_prior_stock_returned, 0));
      v_stock_movement_id := null;

      if v_stock_return_qty > 0 then
        select r.movement_id
        into v_stock_movement_id
        from public.apply_stock_movement_delta_v2(
          p_store_id,
          v_item.product_id,
          'entry'::public.stock_movement_type,
          v_stock_return_qty,
          true,
          format('Cancelamento da venda %s · %s', coalesce(v_order.order_code, p_order_id::text), v_reason_label),
          p_order_id,
          'sale_adjustment',
          jsonb_build_object(
            'sale_adjustment_id', v_adjustment_id,
            'sale_adjustment_type', p_adjustment_type,
            'reason_code', p_reason_code,
            'reason_notes', trim(p_reason_notes),
            'order_item_id', v_item.id,
            'order_code', v_order.order_code
          ),
          auth.uid(),
          v_location_id,
          null,
          null,
          null,
          null,
          'sale_full_cancellation_return',
          null,
          true
        ) r
        limit 1;
      end if;

      if v_stock_return_qty < v_remaining_qty then
        v_stock_warning_count := v_stock_warning_count + 1;
      end if;

      insert into public.sale_adjustment_items (
        adjustment_id,
        order_item_id,
        product_id,
        quantity,
        unit_refund_amount,
        refund_amount,
        stock_returned_quantity,
        stock_movement_id,
        metadata
      ) values (
        v_adjustment_id,
        v_item.id,
        v_item.product_id,
        v_remaining_qty,
        v_unit_refund,
        v_line_refund,
        v_stock_return_qty,
        v_stock_movement_id,
        jsonb_build_object(
          'physical_quantity_originally_moved', v_physical_sold,
          'stock_quantity_already_returned_before', v_prior_stock_returned,
          'stock_return_shortfall', greatest(v_remaining_qty - v_stock_return_qty, 0),
          'location_id', v_location_id
        )
      );
    end loop;
  end if;

  v_refund_entry_code := public.generate_cashbook_entry_code();

  insert into public.cashbook_entries (
    store_id,
    entry_code,
    entry_date,
    occurred_at,
    type,
    direction,
    amount,
    description,
    notes,
    payment_method,
    payment_method_code,
    source,
    source_id,
    order_id,
    customer_id,
    status,
    affects_balance,
    metadata,
    created_by,
    account_plan_code,
    source_financial_account_id,
    destination_financial_account_id,
    is_transfer,
    affects_cash_drawer,
    affects_financial_result
  ) values (
    p_store_id,
    v_refund_entry_code,
    v_now::date,
    v_now,
    'refund',
    'out',
    round(v_refund_amount, 2),
    case when p_adjustment_type = 'full_cancellation'
      then format('Cancelamento da venda %s', coalesce(v_order.order_code, p_order_id::text))
      else format('Devolução parcial da venda %s', coalesce(v_order.order_code, p_order_id::text))
    end,
    trim(p_reason_notes),
    v_sale_entry.payment_method,
    coalesce(v_sale_entry.payment_method_code, v_order.payment_method_code),
    'sale_adjustment',
    v_adjustment_id,
    p_order_id,
    v_order.customer_id,
    'confirmed',
    true,
    jsonb_build_object(
      'sale_adjustment_id', v_adjustment_id,
      'sale_adjustment_type', p_adjustment_type,
      'reason_code', p_reason_code,
      'reason_notes', trim(p_reason_notes),
      'order_code', v_order.order_code,
      'original_sale_cashbook_entry_id', v_sale_entry.id,
      'original_sale_cashbook_entry_code', v_sale_entry.entry_code,
      'refund_account_id', v_refund_account_id,
      'affects_financial_result', true,
      'source_financial_account_id', v_refund_account_id
    ),
    auth.uid(),
    v_sale_entry.account_plan_code,
    v_refund_account_id,
    null,
    false,
    exists (
      select 1
      from public.store_financial_accounts a
      where a.id = v_refund_account_id
        and a.store_id = p_store_id
        and a.account_type = 'cash_drawer'
    ),
    true
  ) returning id into v_refund_entry_id;

  update public.sale_adjustments sa
  set metadata = sa.metadata || jsonb_build_object(
    'refund_cashbook_entry_id', v_refund_entry_id,
    'refund_cashbook_entry_code', v_refund_entry_code,
    'item_refund_total', round(v_item_refund_total, 2),
    'non_item_refund_component', greatest(round(v_refund_amount - v_item_refund_total, 2), 0),
    'stock_warning_count', v_stock_warning_count
  )
  where sa.id = v_adjustment_id;

  v_cumulative_refund := v_previous_refund + v_refund_amount;

  update public.orders o
  set
    payment_status = case
      when v_cumulative_refund >= coalesce(v_order.total, 0) - 0.005 then 'refunded'
      else 'partially_refunded'
    end,
    payment_metadata = coalesce(o.payment_metadata, '{}'::jsonb) || jsonb_build_object(
      'last_sale_adjustment_id', v_adjustment_id,
      'last_sale_adjustment_at', v_now,
      'last_refund_cashbook_entry_id', v_refund_entry_id,
      'last_refund_cashbook_entry_code', v_refund_entry_code,
      'refunded_total', round(v_cumulative_refund, 2)
    ),
    commercial_metadata = coalesce(o.commercial_metadata, '{}'::jsonb) || jsonb_build_object(
      'sale_adjustment_status', case
        when v_cumulative_refund >= coalesce(v_order.total, 0) - 0.005 then 'cancelled_after_completion'
        else 'partially_returned'
      end,
      'last_sale_adjustment_id', v_adjustment_id,
      'last_sale_adjustment_at', v_now,
      'refunded_total', round(v_cumulative_refund, 2)
    )
  where o.id = p_order_id
    and o.store_id = p_store_id;

  return jsonb_build_object(
    'ok', true,
    'adjustment_id', v_adjustment_id,
    'adjustment_type', p_adjustment_type,
    'refund_amount', round(v_refund_amount, 2),
    'refund_cashbook_entry_id', v_refund_entry_id,
    'refund_cashbook_entry_code', v_refund_entry_code,
    'refund_account_id', v_refund_account_id,
    'stock_warning_count', v_stock_warning_count,
    'payment_status', case
      when v_cumulative_refund >= coalesce(v_order.total, 0) - 0.005 then 'refunded'
      else 'partially_refunded'
    end,
    'remaining_refundable', greatest(round(coalesce(v_order.total, 0) - v_cumulative_refund, 2), 0)
  );
exception
  when others then
    raise;
end;
$$;

revoke all on function public.get_sale_adjustments_safe(uuid, uuid) from public;
grant execute on function public.get_sale_adjustments_safe(uuid, uuid) to authenticated, service_role;

revoke all on function public.adjust_completed_sale_safe(uuid, uuid, text, text, text, jsonb, uuid) from public;
grant execute on function public.adjust_completed_sale_safe(uuid, uuid, text, text, text, jsonb, uuid) to authenticated, service_role;
