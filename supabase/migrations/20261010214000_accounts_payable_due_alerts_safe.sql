create or replace function public.list_accounts_payable_due_alerts_safe(p_store_id uuid, p_days_ahead integer default 5)
returns jsonb language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare v_today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if auth.uid() is null or not (
    public.app_is_store_owner(p_store_id)
    or public.user_has_store_permission(p_store_id, 'accounts_payable.view')
    or public.user_has_store_permission(p_store_id, 'accounts_payable.manage')
  ) then return jsonb_build_object('ok',false,'error','access_denied'); end if;
  return jsonb_build_object('ok',true,'items',coalesce((
    select jsonb_agg(to_jsonb(x) order by x.days_until_due, x.due_date,x.payable_code)
    from (
      select i.id as installment_id,p.id as payable_id,p.payable_code,p.description,
        i.installment_number,i.due_date,round(i.open_amount,2) as open_amount,
        (i.due_date-v_today) as days_until_due,
        case when i.due_date < v_today then 'overdue'
             when i.due_date=v_today then 'today'
             else 'upcoming' end as urgency
      from public.accounts_payable_installments i
      join public.accounts_payable p on p.id=i.accounts_payable_id and p.store_id=i.store_id
      where p.store_id=p_store_id and p.status <> 'cancelled'
        and i.status not in ('paid','cancelled')
        and i.open_amount>0
        and i.due_date <= v_today + least(greatest(coalesce(p_days_ahead,5),0),30)
      order by i.due_date,p.payable_code limit 150
    ) x
  ),'[]'::jsonb),'as_of',v_today);
end $$;
revoke all on function public.list_accounts_payable_due_alerts_safe(uuid,integer) from public;
grant execute on function public.list_accounts_payable_due_alerts_safe(uuid,integer) to authenticated;