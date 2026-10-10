CREATE OR REPLACE FUNCTION public.list_store_financial_holidays_safe(p_store_id uuid, p_year integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
begin
 if auth.uid() is null or not (
  public.app_is_store_owner(p_store_id)
  or public.user_has_store_permission(p_store_id,'accounts_payable.view')
  or public.user_has_store_permission(p_store_id,'accounts_payable.manage')
 ) then return jsonb_build_object('ok',false,'error','access_denied'); end if;
 return jsonb_build_object('ok',true,'items',coalesce((
  select jsonb_agg(jsonb_build_object('id',h.id,'date',h.holiday_date,'name',h.name,'automatic',h.automatic,'category',h.category,'exception_status',ex.status,'exception_reason',ex.reason) order by h.holiday_date,h.name)
  from (
   select id,holiday_date,name,false as automatic,'local'::text category from public.store_financial_holidays
   where store_id=p_store_id and extract(year from holiday_date)=coalesce(p_year,extract(year from current_date)::int)
   union all select null::uuid,holiday_date,name,true,category from public.financial_banking_holidays_for_year(coalesce(p_year,extract(year from current_date)::int))
   union all select null::uuid,calendar_date,'Exceção de calendário'::text,false,'excecao'::text
   from public.store_financial_calendar_exceptions ex
   where ex.store_id=p_store_id and extract(year from ex.calendar_date)=coalesce(p_year,extract(year from current_date)::int)
   and not exists(select 1 from public.store_financial_holidays loc where loc.store_id=p_store_id and loc.holiday_date=ex.calendar_date)
   and not exists(select 1 from public.financial_banking_holidays_for_year(extract(year from ex.calendar_date)::int) bh where bh.holiday_date=ex.calendar_date)
  ) h left join public.store_financial_calendar_exceptions ex
  on ex.store_id=p_store_id and ex.calendar_date=h.holiday_date
 ),'[]'::jsonb));
end $function$;

CREATE OR REPLACE FUNCTION public.list_accounts_payable_due_alerts_safe(p_store_id uuid, p_days_ahead integer DEFAULT 5)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
declare v_today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if auth.uid() is null or not (
    public.app_is_store_owner(p_store_id)
    or public.user_has_store_permission(p_store_id, 'accounts_payable.view')
    or public.user_has_store_permission(p_store_id, 'accounts_payable.manage')
  ) then return jsonb_build_object('ok',false,'error','access_denied'); end if;
  return jsonb_build_object('ok',true,'items',coalesce((
    select jsonb_agg(to_jsonb(x) order by x.days_until_due,x.due_date,x.payable_code)
    from (
      select i.id as installment_id,p.id as payable_id,p.payable_code,p.description,
        i.installment_number,i.due_date,round(i.open_amount,2) as open_amount,
        (i.due_date-v_today) as days_until_due,
        (extract(isodow from i.due_date) in (6,7)
          or coalesce(
            (select ex.status='closed' from public.store_financial_calendar_exceptions ex where ex.store_id=p_store_id and ex.calendar_date=i.due_date),
            exists(select 1 from public.financial_banking_holidays_for_year(extract(year from i.due_date)::int) bh where bh.holiday_date=i.due_date)
            or exists(select 1 from public.store_financial_holidays h where h.store_id=p_store_id and h.holiday_date=i.due_date)
          )) as is_non_business_due_date,
        (select to_char(d::date,'YYYY-MM-DD')
           from generate_series(i.due_date,i.due_date+interval '20 days',interval '1 day') d
          where extract(isodow from d) not in (6,7)
            and not coalesce(
              (select ex.status='closed' from public.store_financial_calendar_exceptions ex where ex.store_id=p_store_id and ex.calendar_date=d::date),
              exists(select 1 from public.financial_banking_holidays_for_year(extract(year from d)::int) bh where bh.holiday_date=d::date)
              or exists(select 1 from public.store_financial_holidays h where h.store_id=p_store_id and h.holiday_date=d::date)
            )
          order by d limit 1) as next_business_date,
        case when i.due_date < v_today then 'overdue'
             when i.due_date=v_today then 'today'
             else 'upcoming' end as urgency
      from public.accounts_payable_installments i
      join public.accounts_payable p on p.id=i.accounts_payable_id and p.store_id=i.store_id
      where p.store_id=p_store_id and p.status <> 'cancelled'
        and i.status not in ('paid','cancelled') and i.open_amount>0
        and i.due_date <= v_today + least(greatest(coalesce(p_days_ahead,5),0),30)
      order by i.due_date,p.payable_code limit 150
    ) x
  ),'[]'::jsonb),'as_of',v_today);
end $function$;