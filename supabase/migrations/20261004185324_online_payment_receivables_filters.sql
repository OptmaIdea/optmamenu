
create or replace function public.list_online_payment_receivables_safe(
  p_store_id uuid,
  p_start_date date default null,
  p_end_date date default null,
  p_date_basis text default 'created',
  p_payment_method_code text default null,
  p_settlement_plan text default null,
  p_classifier text default null,
  p_limit integer default 500
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  v_can_view boolean := false;
  v_limit integer := least(greatest(coalesce(p_limit,500),1),1000);
  v_date_basis text := lower(coalesce(nullif(trim(p_date_basis),''),'created'));
  v_method text := nullif(lower(trim(coalesce(p_payment_method_code,''))),'');
  v_plan text := nullif(lower(trim(coalesce(p_settlement_plan,''))),'');
  v_classifier text := nullif(lower(trim(coalesce(p_classifier,''))),'');
  v_items jsonb := '[]'::jsonb;
  v_total bigint := 0;
  v_gross numeric := 0;
  v_fees numeric := 0;
  v_net numeric := 0;
  v_open bigint := 0;
  v_settled bigint := 0;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok',false,'error','access_denied');
  end if;

  v_can_view := public.app_is_store_owner(p_store_id)
    or public.user_has_store_permission_v2(p_store_id,'payments.online.view');

  if not v_can_view then
    return jsonb_build_object('ok',false,'error','access_denied');
  end if;

  if v_date_basis not in ('created','settlement') then
    v_date_basis := 'created';
  end if;

  if v_method is not null and v_method not in ('debit_card','credit_card') then
    return jsonb_build_object('ok',false,'error','invalid_payment_method_filter');
  end if;

  if v_plan is not null and v_plan not in ('d1','d7','d15','due_date','ontime') then
    return jsonb_build_object('ok',false,'error','invalid_settlement_plan_filter');
  end if;

  if v_classifier is not null
     and v_classifier not in ('open','settled','anticipated','single','installment','overdue') then
    return jsonb_build_object('ok',false,'error','invalid_classifier_filter');
  end if;

  with filtered as (
    select
      r.*,
      o.order_code,
      p.provider_code
    from public.online_payment_receivables r
    join public.store_online_payment_providers p on p.id = r.provider_id
    left join public.orders o on o.id = r.order_id
    where r.store_id = p_store_id
      and (
        p_start_date is null
        or (
          case
            when v_date_basis = 'settlement'
              then coalesce(r.settled_at,r.expected_settlement_at,r.created_at)::date
            else r.created_at::date
          end
        ) >= p_start_date
      )
      and (
        p_end_date is null
        or (
          case
            when v_date_basis = 'settlement'
              then coalesce(r.settled_at,r.expected_settlement_at,r.created_at)::date
            else r.created_at::date
          end
        ) <= p_end_date
      )
      and (v_method is null or r.payment_method_code = v_method)
      and (
        v_plan is null
        or (v_plan = 'd1' and lower(coalesce(r.settlement_plan,'')) in ('standard','d1'))
        or (v_plan <> 'd1' and lower(coalesce(r.settlement_plan,'')) = v_plan)
        or (v_plan = 'ontime' and lower(coalesce(r.settlement_plan,'')) in ('ontime','nitro'))
      )
      and (
        v_classifier is null
        or (v_classifier = 'open' and r.status in ('receivable','scheduled'))
        or (v_classifier = 'settled' and r.status = 'settled')
        or (
          v_classifier = 'anticipated'
          and (
            coalesce(r.anticipation_fee_amount,0) > 0
            or lower(coalesce(r.settlement_plan,'')) in ('ontime','nitro')
            or (
              r.status = 'settled'
              and r.settled_at is not null
              and r.expected_settlement_at is not null
              and r.settled_at < r.expected_settlement_at
            )
          )
        )
        or (v_classifier = 'single' and coalesce(r.installments,1) = 1)
        or (v_classifier = 'installment' and coalesce(r.installments,1) > 1)
        or (
          v_classifier = 'overdue'
          and r.status in ('receivable','scheduled')
          and r.expected_settlement_at is not null
          and r.expected_settlement_at < now()
        )
      )
  ),
  totals as (
    select
      count(*)::bigint as total,
      coalesce(sum(gross_amount),0) as gross,
      coalesce(sum(fee_amount + anticipation_fee_amount),0) as fees,
      coalesce(sum(net_amount),0) as net,
      count(*) filter (where status in ('receivable','scheduled'))::bigint as open_count,
      count(*) filter (where status = 'settled')::bigint as settled_count
    from filtered
  ),
  items as (
    select jsonb_build_object(
      'id',f.id,
      'intent_id',f.intent_id,
      'order_id',f.order_id,
      'order_code',f.order_code,
      'provider_id',f.provider_id,
      'provider_code',f.provider_code,
      'payment_method_code',f.payment_method_code,
      'card_type',f.card_type,
      'card_brand',f.card_brand,
      'card_last4',f.card_last4,
      'installments',f.installments,
      'gross_amount',f.gross_amount,
      'fee_amount',f.fee_amount,
      'anticipation_fee_amount',f.anticipation_fee_amount,
      'net_amount',f.net_amount,
      'settlement_plan',f.settlement_plan,
      'expected_settlement_at',f.expected_settlement_at,
      'settled_at',f.settled_at,
      'status',f.status,
      'authorization_code',f.authorization_code,
      'provider_transaction_id',f.provider_transaction_id,
      'created_at',f.created_at,
      'updated_at',f.updated_at
    ) as row
    from filtered f
    order by f.created_at desc
    limit v_limit
  )
  select
    coalesce((select jsonb_agg(i.row) from items i),'[]'::jsonb),
    t.total,t.gross,t.fees,t.net,t.open_count,t.settled_count
  into v_items,v_total,v_gross,v_fees,v_net,v_open,v_settled
  from totals t;

  return jsonb_build_object(
    'ok',true,
    'items',v_items,
    'summary',jsonb_build_object(
      'total',v_total,
      'gross',v_gross,
      'fees',v_fees,
      'net',v_net,
      'open',v_open,
      'settled',v_settled
    ),
    'filters',jsonb_build_object(
      'startDate',p_start_date,
      'endDate',p_end_date,
      'dateBasis',v_date_basis,
      'paymentMethodCode',v_method,
      'settlementPlan',v_plan,
      'classifier',v_classifier,
      'limit',v_limit
    )
  );
end;
$function$;

revoke all on function public.list_online_payment_receivables_safe(uuid,date,date,text,text,text,text,integer) from public;
revoke all on function public.list_online_payment_receivables_safe(uuid,date,date,text,text,text,text,integer) from anon;
revoke all on function public.list_online_payment_receivables_safe(uuid,date,date,text,text,text,text,integer) from authenticated;
grant execute on function public.list_online_payment_receivables_safe(uuid,date,date,text,text,text,text,integer) to authenticated;
grant execute on function public.list_online_payment_receivables_safe(uuid,date,date,text,text,text,text,integer) to service_role;
