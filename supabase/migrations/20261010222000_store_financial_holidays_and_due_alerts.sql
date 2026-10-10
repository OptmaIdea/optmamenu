create table if not exists public.store_financial_holidays (
 id uuid primary key default gen_random_uuid(),
 store_id uuid not null references public.stores(id) on delete cascade,
 holiday_date date not null,
 name text not null,
 created_at timestamptz not null default now(),
 created_by uuid,
 unique(store_id,holiday_date)
);
alter table public.store_financial_holidays enable row level security;
revoke all on public.store_financial_holidays from anon,authenticated;

create or replace function public.list_store_financial_holidays_safe(p_store_id uuid,p_year integer default null)
returns jsonb language plpgsql security definer set search_path=public,auth,pg_temp as $$
begin
 if auth.uid() is null or not (
  public.app_is_store_owner(p_store_id)
  or public.user_has_store_permission(p_store_id,'accounts_payable.view')
  or public.user_has_store_permission(p_store_id,'accounts_payable.manage')
 ) then return jsonb_build_object('ok',false,'error','access_denied'); end if;
 return jsonb_build_object('ok',true,'items',coalesce((
  select jsonb_agg(jsonb_build_object('id',id,'date',holiday_date,'name',name) order by holiday_date)
  from public.store_financial_holidays
  where store_id=p_store_id and (p_year is null or extract(year from holiday_date)=p_year)
 ),'[]'::jsonb));
end $$;
revoke all on function public.list_store_financial_holidays_safe(uuid,integer) from public;
grant execute on function public.list_store_financial_holidays_safe(uuid,integer) to authenticated;

create or replace function public.save_store_financial_holiday_safe(p_store_id uuid,p_date date,p_name text)
returns jsonb language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare v_row public.store_financial_holidays%rowtype;
begin
 if auth.uid() is null or not (
   public.app_is_store_owner(p_store_id)
   or public.user_has_store_permission(p_store_id,'accounts_payable.manage')
 ) then return jsonb_build_object('ok',false,'error','access_denied'); end if;
 if p_date is null or length(trim(coalesce(p_name,'')))<2 then
   return jsonb_build_object('ok',false,'error','invalid_holiday'); end if;
 insert into public.store_financial_holidays(store_id,holiday_date,name,created_by)
 values(p_store_id,p_date,trim(p_name),auth.uid())
 on conflict(store_id,holiday_date) do update set name=excluded.name
 returning * into v_row;
 return jsonb_build_object('ok',true,'id',v_row.id);
end $$;
revoke all on function public.save_store_financial_holiday_safe(uuid,date,text) from public;
grant execute on function public.save_store_financial_holiday_safe(uuid,date,text) to authenticated;

create or replace function public.delete_store_financial_holiday_safe(p_store_id uuid,p_date date)
returns jsonb language plpgsql security definer set search_path=public,auth,pg_temp as $$
begin
 if auth.uid() is null or not (
   public.app_is_store_owner(p_store_id)
   or public.user_has_store_permission(p_store_id,'accounts_payable.manage')
 ) then return jsonb_build_object('ok',false,'error','access_denied'); end if;
 delete from public.store_financial_holidays where store_id=p_store_id and holiday_date=p_date;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.delete_store_financial_holiday_safe(uuid,date) from public;
grant execute on function public.delete_store_financial_holiday_safe(uuid,date) to authenticated;

create or replace function public.list_accounts_payable_due_alerts_safe(p_store_id uuid,p_days_ahead integer default 5)
returns jsonb language plpgsql security definer set search_path=public,auth,pg_temp as $$
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
          or exists(select 1 from public.store_financial_holidays h
                    where h.store_id=p_store_id and h.holiday_date=i.due_date)) as is_non_business_due_date,
        (select to_char(d::date,'YYYY-MM-DD')
           from generate_series(i.due_date,i.due_date+interval '20 days',interval '1 day') d
          where extract(isodow from d) not in (6,7)
            and not exists(select 1 from public.store_financial_holidays h
                           where h.store_id=p_store_id and h.holiday_date=d::date)
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
end $$;
revoke all on function public.list_accounts_payable_due_alerts_safe(uuid,integer) from public;
grant execute on function public.list_accounts_payable_due_alerts_safe(uuid,integer) to authenticated;