
update public.cashbook_account_plan
set path='2/2.6/2.6.2',
    updated_at=now()
where code='payment_processing_fees'
  and path is distinct from '2/2.6/2.6.2';

CREATE OR REPLACE FUNCTION public.get_cashbook_account_plan_trial_balance_safe(p_store_id uuid, p_start_date date, p_end_date date, p_include_inactive boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_items jsonb := '[]'::jsonb;
  v_totals jsonb := '{}'::jsonb;
BEGIN
  IF p_store_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Loja não informada.');
  END IF;

  IF p_start_date IS NULL OR p_end_date IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Informe o período do balancete.');
  END IF;

  IF p_end_date < p_start_date THEN
    RETURN jsonb_build_object('ok', false, 'message', 'A data final não pode ser menor que a data inicial.');
  END IF;

  IF COALESCE(auth.role(), '') IN ('anon', 'authenticated') THEN
    IF auth.uid() IS NULL OR NOT (
      public.app_is_store_owner(p_store_id)
      OR public.user_has_store_permission(p_store_id, 'cashbook.view')
    ) THEN
      RETURN jsonb_build_object('ok', false, 'message', 'Você não tem permissão para consultar o balancete.');
    END IF;
  END IF;

  WITH plan_items AS (
    SELECT
      p.code,
      p.display_code,
      p.parent_code,
      p.name,
      p.kind,
      p.level,
      p.path,
      p.is_group,
      p.is_postable,
      p.nature,
      p.analysis_enabled,
      p.active,
      p.sort_order
    FROM public.cashbook_account_plan p
    WHERE p_include_inactive OR p.active = true
  ),
  direct_entries AS (
    SELECT
      e.account_plan_code,
      SUM(CASE WHEN e.direction = 'in' THEN e.amount ELSE 0 END)::numeric(14,2) AS direct_in,
      SUM(CASE WHEN e.direction = 'out' THEN e.amount ELSE 0 END)::numeric(14,2) AS direct_out,
      COUNT(*)::integer AS entries_count
    FROM public.cashbook_entries e
    WHERE e.store_id = p_store_id
      AND e.account_plan_code IS NOT NULL
      AND e.entry_date >= p_start_date
      AND e.entry_date <= p_end_date
      AND COALESCE(e.affects_balance, true) = true
      AND COALESCE(e.status, 'active') NOT IN ('cancelled', 'canceled', 'voided')
    GROUP BY e.account_plan_code
  ),
  direct_by_plan AS (
    SELECT
      p.*,
      COALESCE(d.direct_in, 0)::numeric(14,2) AS direct_in,
      COALESCE(d.direct_out, 0)::numeric(14,2) AS direct_out,
      COALESCE(d.entries_count, 0)::integer AS direct_entries_count
    FROM plan_items p
    LEFT JOIN direct_entries d ON d.account_plan_code = p.code
  ),
  ancestor_map AS (
    SELECT
      child.code AS child_code,
      ancestor.code AS ancestor_code
    FROM plan_items child
    JOIN plan_items ancestor
      ON child.code = ancestor.code
      OR child.path LIKE ancestor.path || '/%'
  ),
  rolled AS (
    SELECT
      ancestor_map.ancestor_code AS code,
      SUM(direct_by_plan.direct_in)::numeric(14,2) AS total_in,
      SUM(direct_by_plan.direct_out)::numeric(14,2) AS total_out,
      SUM(direct_by_plan.direct_entries_count)::integer AS total_entries_count
    FROM ancestor_map
    JOIN direct_by_plan ON direct_by_plan.code = ancestor_map.child_code
    GROUP BY ancestor_map.ancestor_code
  ),
  final_items AS (
    SELECT
      p.code,
      p.display_code,
      p.parent_code,
      p.name,
      p.kind,
      p.level,
      p.path,
      p.is_group,
      p.is_postable,
      p.nature,
      p.analysis_enabled,
      p.active,
      p.sort_order,
      p.direct_in,
      p.direct_out,
      (p.direct_in - p.direct_out)::numeric(14,2) AS direct_balance,
      p.direct_entries_count,
      COALESCE(r.total_in, 0)::numeric(14,2) AS total_in,
      COALESCE(r.total_out, 0)::numeric(14,2) AS total_out,
      (COALESCE(r.total_in, 0) - COALESCE(r.total_out, 0))::numeric(14,2) AS total_balance,
      COALESCE(r.total_entries_count, 0)::integer AS total_entries_count
    FROM direct_by_plan p
    LEFT JOIN rolled r ON r.code = p.code
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(final_items) ORDER BY final_items.sort_order, final_items.display_code NULLS LAST, final_items.name), '[]'::jsonb)
  INTO v_items
  FROM final_items;

  WITH period_entries AS (
    SELECT
      e.direction,
      e.amount
    FROM public.cashbook_entries e
    WHERE e.store_id = p_store_id
      AND e.account_plan_code IS NOT NULL
      AND e.entry_date >= p_start_date
      AND e.entry_date <= p_end_date
      AND COALESCE(e.affects_balance, true) = true
      AND COALESCE(e.status, 'active') NOT IN ('cancelled', 'canceled', 'voided')
  )
  SELECT jsonb_build_object(
    'total_in', COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE 0 END), 0)::numeric(14,2),
    'total_out', COALESCE(SUM(CASE WHEN direction = 'out' THEN amount ELSE 0 END), 0)::numeric(14,2),
    'balance', COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE -amount END), 0)::numeric(14,2),
    'entries_count', COUNT(*)::integer
  )
  INTO v_totals
  FROM period_entries;

  RETURN jsonb_build_object(
    'ok', true,
    'store_id', p_store_id,
    'start_date', p_start_date,
    'end_date', p_end_date,
    'totals', v_totals,
    'items', v_items
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.list_financial_account_statement_safe(p_store_id uuid, p_account_id uuid DEFAULT NULL::uuid, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_limit integer DEFAULT 500, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
declare
  v_items jsonb := '[]'::jsonb;
  v_total bigint := 0;
  v_limit integer := greatest(1, least(coalesce(p_limit, 500), 1000));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
  v_opening_balance numeric := 0;
  v_period_inflows numeric := 0;
  v_period_outflows numeric := 0;
  v_period_net numeric := 0;
  v_final_balance numeric := 0;
  v_account jsonb := null;
  v_scope text := case when p_account_id is null then 'consolidated' else 'account' end;
begin
  if p_store_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_store_id');
  end if;

  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    if auth.uid() is null or not (
      public.app_is_store_owner(p_store_id)
      or public.user_has_store_permission_v2(p_store_id, 'financial.accounts.view')
      or public.user_has_store_permission_v2(p_store_id, 'cashbook.view')
    ) then
      return jsonb_build_object('ok', false, 'error', 'access_denied');
    end if;
  end if;

  if p_account_id is not null then
    select to_jsonb(a)
      into v_account
    from public.store_financial_accounts a
    where a.id = p_account_id
      and a.store_id = p_store_id;

    if v_account is null then
      return jsonb_build_object('ok', false, 'error', 'account_not_found');
    end if;
  end if;

  with base as (
    select
      e.id,
      e.entry_code,
      e.entry_date,
      e.occurred_at,
      e.description,
      e.notes,
      e.payment_method,
      e.payment_method_code,
      e.source,
      e.source_id,
      e.order_id,
      e.customer_id,
      e.type,
      e.account_plan_code,
      e.metadata,
      e.affects_financial_result,
      coalesce(e.is_transfer, false) as is_transfer,
      e.transfer_group_id,
      e.direction,
      e.amount::numeric as amount,
      e.source_financial_account_id,
      e.destination_financial_account_id,
      o.order_code,
      o.customer_name as order_customer_name,
      case
        when p_account_id is null and coalesce(e.is_transfer, false) = true then 0::numeric
        when p_account_id is null and e.direction = 'in' then e.amount::numeric
        when p_account_id is null and e.direction = 'out' then -e.amount::numeric
        when e.destination_financial_account_id = p_account_id then e.amount::numeric
        when e.source_financial_account_id = p_account_id then -e.amount::numeric
        else 0::numeric
      end as signed_amount,
      case
        when p_account_id is null and coalesce(e.is_transfer, false) = true then 'transfer'
        when p_account_id is null and e.direction = 'in' then 'in'
        when p_account_id is null and e.direction = 'out' then 'out'
        when e.destination_financial_account_id = p_account_id then 'in'
        when e.source_financial_account_id = p_account_id then 'out'
        else e.direction
      end as account_direction,
      case
        when e.destination_financial_account_id = p_account_id then e.source_financial_account_id
        when e.source_financial_account_id = p_account_id then e.destination_financial_account_id
        else null::uuid
      end as counterpart_account_id
    from public.cashbook_entries e
    left join public.orders o on o.id = e.order_id and o.store_id = e.store_id
    where e.store_id = p_store_id
      and e.status = 'confirmed'
      and e.affects_balance = true
      and (
        p_account_id is null
        or e.source_financial_account_id = p_account_id
        or e.destination_financial_account_id = p_account_id
      )
  ), ordered as (
    select
      b.*,
      ca.name as counterpart_account_name,
      ca.code as counterpart_account_code,
      sum(b.signed_amount) over (order by b.occurred_at, b.id rows between unbounded preceding and current row) as running_balance_after
    from base b
    left join public.store_financial_accounts ca on ca.id = b.counterpart_account_id and ca.store_id = p_store_id
  ), scoped as (
    select *
    from ordered o
    where (p_start_date is null or o.entry_date >= p_start_date)
      and (p_end_date is null or o.entry_date <= p_end_date)
  ), page as (
    select *
    from scoped
    order by occurred_at desc, id desc
    limit v_limit offset v_offset
  )
  select
    coalesce((select sum(signed_amount) from ordered where p_start_date is not null and entry_date < p_start_date), 0),
    coalesce((select sum(amount) from scoped where signed_amount > 0), 0),
    coalesce((select sum(abs(signed_amount)) from scoped where signed_amount < 0), 0),
    coalesce((select sum(signed_amount) from scoped), 0),
    coalesce((select max(running_balance_after) from ordered where false), 0),
    (select count(*) from scoped),
    coalesce((select jsonb_agg(to_jsonb(page) order by page.occurred_at desc, page.id desc) from page), '[]'::jsonb)
  into v_opening_balance, v_period_inflows, v_period_outflows, v_period_net, v_final_balance, v_total, v_items;

  v_final_balance := v_opening_balance + v_period_net;

  return jsonb_build_object(
    'ok', true,
    'scope', v_scope,
    'account', v_account,
    'start_date', p_start_date,
    'end_date', p_end_date,
    'opening_balance', v_opening_balance,
    'period_inflows', v_period_inflows,
    'period_outflows', v_period_outflows,
    'period_net', v_period_net,
    'final_balance', v_final_balance,
    'total', v_total,
    'limit', v_limit,
    'offset', v_offset,
    'items', v_items
  );
end;
$function$;

create or replace function public.adjust_financial_account_balance_safe(
  p_store_id uuid,
  p_account_id uuid,
  p_effective_at timestamptz,
  p_target_balance numeric,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  v_role text := coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), nullif(auth.role(), ''), current_user);
  v_account public.store_financial_accounts%rowtype;
  v_current numeric := 0;
  v_target numeric := round(coalesce(p_target_balance,0),2);
  v_delta numeric;
  v_direction text;
  v_plan_code text;
  v_meta jsonb;
  v_result jsonb;
begin
  if p_store_id is null or p_account_id is null or p_effective_at is null or p_target_balance is null then
    return jsonb_build_object('ok',false,'error','missing_required_fields');
  end if;

  if v_role in ('anon','authenticated') then
    if auth.uid() is null or not (
      public.app_is_store_owner(p_store_id)
      or public.user_has_store_permission_v2(p_store_id,'cashbook.create')
      or public.user_has_store_permission_v2(p_store_id,'financial.accounts.manage')
    ) then
      return jsonb_build_object('ok',false,'error','access_denied');
    end if;
  elsif v_role not in ('service_role','postgres','supabase_admin') then
    return jsonb_build_object('ok',false,'error','access_denied');
  end if;

  select * into v_account
  from public.store_financial_accounts
  where id=p_account_id and store_id=p_store_id
  for update;

  if v_account.id is null then
    return jsonb_build_object('ok',false,'error','account_not_found');
  end if;
  if not v_account.active then
    return jsonb_build_object('ok',false,'error','account_inactive');
  end if;
  if nullif(trim(coalesce(v_account.code,'')),'') is null then
    return jsonb_build_object('ok',false,'error','account_code_required');
  end if;

  select coalesce(sum(
    case
      when e.destination_financial_account_id=p_account_id then e.amount
      when e.source_financial_account_id=p_account_id then -e.amount
      else 0
    end
  ),0)
  into v_current
  from public.cashbook_entries e
  where e.store_id=p_store_id
    and e.status='confirmed'
    and coalesce(e.affects_balance,true)=true
    and e.occurred_at <= p_effective_at
    and (e.source_financial_account_id=p_account_id or e.destination_financial_account_id=p_account_id);

  v_current := round(coalesce(v_current,0),2);
  v_delta := round(v_target-v_current,2);

  if abs(v_delta) < 0.005 then
    return jsonb_build_object(
      'ok',true,'changed',false,'account_id',v_account.id,
      'account_name',v_account.name,'previous_balance',v_current,'target_balance',v_target,'delta',0
    );
  end if;

  v_direction := case when v_delta>0 then 'in' else 'out' end;
  v_plan_code := case when v_delta>0 then 'positive_adjustment' else 'negative_adjustment' end;

  v_meta := jsonb_build_object(
    'origin','financial_account_balance_reconciliation',
    'account_plan_code',v_plan_code,
    'affects_cash_drawer',v_account.account_type='cash_drawer',
    'affects_financial_result',false,
    'is_transfer',false,
    'reconciliation_target_balance',v_target,
    'reconciliation_previous_balance',v_current,
    'reconciliation_delta',v_delta
  ) || case
    when v_delta>0 then jsonb_build_object('destination_financial_account_code',v_account.code)
    else jsonb_build_object('source_financial_account_code',v_account.code)
  end;

  v_result := public.create_cashbook_entry(
    p_store_id,
    'adjustment',
    v_direction,
    abs(v_delta),
    'Ajuste de saldo acumulado — ' || v_account.name,
    'adjustment',
    nullif(trim(coalesce(p_notes,'')),''),
    p_effective_at,
    v_meta
  );

  if coalesce((v_result->>'ok')::boolean,false) is not true then
    return jsonb_build_object('ok',false,'error',coalesce(v_result->>'error','adjustment_create_failed'));
  end if;

  return jsonb_build_object(
    'ok',true,'changed',true,'account_id',v_account.id,'account_name',v_account.name,
    'previous_balance',v_current,'target_balance',v_target,'delta',v_delta,'entry',v_result
  );
end;
$function$;

revoke all on function public.adjust_financial_account_balance_safe(uuid,uuid,timestamptz,numeric,text) from public;
revoke all on function public.adjust_financial_account_balance_safe(uuid,uuid,timestamptz,numeric,text) from anon;
grant execute on function public.adjust_financial_account_balance_safe(uuid,uuid,timestamptz,numeric,text) to authenticated;
grant execute on function public.adjust_financial_account_balance_safe(uuid,uuid,timestamptz,numeric,text) to service_role;
