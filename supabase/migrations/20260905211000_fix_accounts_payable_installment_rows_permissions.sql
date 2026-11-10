-- Corrige os guards do read model de Contas a Pagar preservando o boundary já usado pelo módulo.

create or replace function public.list_accounts_payable_safe(
  p_store_id uuid,
  p_status text default null,
  p_supplier_id uuid default null,
  p_due_from date default null,
  p_due_to date default null,
  p_limit integer default 200,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 200), 1), 1000);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida.';
  end if;

  if not (
    public.app_is_store_owner(p_store_id)
    or public.user_has_store_permission(p_store_id, 'accounts_payable.view')
    or public.user_has_store_permission(p_store_id, 'accounts_payable.manage')
    or public.user_has_store_permission(p_store_id, 'accounts_payable.pay')
  ) then
    raise exception 'Sem permissão para consultar contas a pagar.';
  end if;

  return (
    with installment_rows as (
      select
        coalesce(i.id, p.id) as row_id,
        p.id as accounts_payable_id,
        p.store_id,
        p.supplier_id,
        p.purchase_document_id,
        p.document_number,
        p.description,
        p.payment_term_id,
        p.payment_term_snapshot,
        coalesce(i.payment_method_code, p.payment_method_code) as payment_method_code,
        coalesce(i.preferred_financial_account_id, p.preferred_financial_account_id) as preferred_financial_account_id,
        p.issue_date,
        p.notes,
        p.created_at,
        s.name as supplier_name,
        i.installment_number,
        case when i.id is null then 1 else count(i.id) over (partition by p.id) end as installment_count,
        i.due_date,
        coalesce(i.original_amount, p.original_amount) as original_amount,
        coalesce(i.adjustment_amount, p.adjustment_amount) as adjustment_amount,
        coalesce(i.net_amount, p.net_amount) as net_amount,
        coalesce(i.paid_amount, p.paid_amount) as paid_amount,
        coalesce(i.open_amount, p.open_amount) as open_amount,
        case
          when p.status = 'cancelled' then 'cancelled'
          when i.id is null then p.status
          when i.status = 'pending' then 'open'
          when i.status = 'partially_paid' then 'partially_paid'
          when i.status = 'paid' then 'paid'
          when i.status = 'cancelled' then 'cancelled'
          else p.status
        end as row_status
      from public.accounts_payable p
      join public.suppliers s on s.id = p.supplier_id and s.store_id = p.store_id
      left join public.accounts_payable_installments i on i.accounts_payable_id = p.id and i.store_id = p.store_id
      where p.store_id = p_store_id
        and (p_supplier_id is null or p.supplier_id = p_supplier_id)
    ),
    filtered as (
      select *
      from installment_rows r
      where (
        p_status is null
        or (p_status = 'open' and r.row_status in ('open', 'partially_paid'))
        or (p_status <> 'open' and r.row_status = p_status)
      )
        and (p_due_from is null or r.due_date is null or r.due_date >= p_due_from)
        and (p_due_to is null or r.due_date is null or r.due_date <= p_due_to)
    ),
    paged as (
      select *
      from filtered
      order by due_date nulls last, created_at desc, supplier_name, installment_number nulls first
      limit v_limit
      offset v_offset
    )
    select jsonb_build_object(
      'items', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', r.row_id,
            'payable_code', case
              when r.installment_number is null then coalesce(nullif(r.document_number, ''), r.description, 'Conta a pagar')
              else format('Parcela %s de %s', r.installment_number, r.installment_count)
            end,
            'store_id', r.store_id,
            'supplier_id', r.supplier_id,
            'purchase_document_id', r.purchase_document_id,
            'document_number', r.document_number,
            'description', r.description,
            'original_amount', r.original_amount,
            'adjustment_amount', r.adjustment_amount,
            'net_amount', r.net_amount,
            'paid_amount', r.paid_amount,
            'open_amount', r.open_amount,
            'status', r.row_status,
            'payment_term_id', r.payment_term_id,
            'payment_term_snapshot', r.payment_term_snapshot,
            'payment_method_code', r.payment_method_code,
            'preferred_financial_account_id', r.preferred_financial_account_id,
            'issue_date', r.issue_date,
            'notes', r.notes,
            'supplier_name', r.supplier_name,
            'next_due_date', r.due_date,
            'accounts_payable_id', r.accounts_payable_id,
            'installment_number', r.installment_number,
            'installment_count', r.installment_count
          )
          order by r.due_date nulls last, r.created_at desc, r.supplier_name, r.installment_number nulls first
        )
        from paged r
      ), '[]'::jsonb),
      'total', (select count(*) from filtered)
    )
  );
end;
$$;

create or replace function public.get_accounts_payable_detail_safe(p_payable_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_p public.accounts_payable%rowtype;
  v_supplier_name text;
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida.';
  end if;

  select p.* into v_p
  from public.accounts_payable p
  where p.id = p_payable_id;

  if v_p.id is null then
    select p.* into v_p
    from public.accounts_payable_installments i
    join public.accounts_payable p on p.id = i.accounts_payable_id
    where i.id = p_payable_id;
  end if;

  if v_p.id is null then
    return null;
  end if;

  if not (
    public.app_is_store_owner(v_p.store_id)
    or public.user_has_store_permission(v_p.store_id, 'accounts_payable.view')
    or public.user_has_store_permission(v_p.store_id, 'accounts_payable.manage')
    or public.user_has_store_permission(v_p.store_id, 'accounts_payable.pay')
    or public.user_has_store_permission(v_p.store_id, 'accounts_payable.reverse_payment')
  ) then
    raise exception 'Sem permissão para consultar conta a pagar.';
  end if;

  select s.name into v_supplier_name
  from public.suppliers s
  where s.id = v_p.supplier_id and s.store_id = v_p.store_id;

  return jsonb_build_object(
    'payable', to_jsonb(v_p) || jsonb_build_object(
      'payable_code', coalesce(nullif(v_p.document_number, ''), v_p.description, 'Conta a pagar'),
      'description', case
        when nullif(v_supplier_name, '') is not null then v_supplier_name || ' · ' || coalesce(v_p.description, 'Compra')
        else v_p.description
      end
    ),
    'installments', coalesce((select jsonb_agg(to_jsonb(i) order by i.installment_number) from public.accounts_payable_installments i where i.accounts_payable_id = v_p.id), '[]'::jsonb),
    'adjustments', coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from public.accounts_payable_adjustments a where a.accounts_payable_id = v_p.id), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(to_jsonb(pay) order by pay.paid_at desc, pay.created_at desc) from public.accounts_payable_payments pay where pay.accounts_payable_id = v_p.id), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc) from public.accounts_payable_events e where e.accounts_payable_id = v_p.id), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.list_accounts_payable_safe(uuid, text, uuid, date, date, integer, integer) from public, anon;
grant execute on function public.list_accounts_payable_safe(uuid, text, uuid, date, date, integer, integer) to authenticated, service_role;
revoke all on function public.get_accounts_payable_detail_safe(uuid) from public, anon;
grant execute on function public.get_accounts_payable_detail_safe(uuid) to authenticated, service_role;
