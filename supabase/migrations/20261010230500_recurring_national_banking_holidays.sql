create or replace function public.financial_easter_sunday(y integer) returns date language plpgsql immutable as $$
declare a int;b int;c int;d int;e int;f int;g int;h int;i int;k int;l int;m int;mm int;dd int;
begin
if y<1900 or y>2199 then raise exception 'Ano fora do intervalo'; end if;
a:=mod(y,19);b:=y/100;c:=mod(y,100);d:=b/4;e:=mod(b,4);f:=(b+8)/25;g:=(b-f+1)/3;
h:=mod(19*a+b-d-g+15,30);i:=c/4;k:=mod(c,4);l:=mod(32+2*e+2*i-h-k,7);m:=(a+11*h+22*l)/451;
mm:=(h+l-7*m+114)/31;dd:=mod(h+l-7*m+114,31)+1;
return make_date(y,mm,dd); end $$;

create or replace function public.financial_banking_holidays_for_year(y integer)
returns table(holiday_date date,name text,category text) language sql stable as $$
with easter as (select public.financial_easter_sunday(y) easter_date),
days as (
select make_date(y,1,1) as dt,'Confraternização Universal'::text as nm,'nacional'::text as category
union all select make_date(y,4,21),'Tiradentes','nacional'
union all select make_date(y,5,1),'Dia do Trabalho','nacional'
union all select make_date(y,9,7),'Independência do Brasil','nacional'
union all select make_date(y,10,12),'Nossa Senhora Aparecida','nacional'
union all select make_date(y,11,2),'Finados','nacional'
union all select make_date(y,11,15),'Proclamação da República','nacional'
union all select make_date(y,11,20),'Consciência Negra','nacional'
union all select make_date(y,12,25),'Natal','nacional'
union all select easter_date-48,'Carnaval — segunda-feira','bancario' from easter
union all select easter_date-47,'Carnaval — terça-feira','bancario' from easter
union all select easter_date-2,'Sexta-feira da Paixão','bancario' from easter
union all select easter_date+60,'Corpus Christi','bancario' from easter
union all select make_date(y,12,31)-(case extract(isodow from make_date(y,12,31)) when 6 then 1 when 7 then 2 else 0 end)::integer,
'Último dia útil do ano — sem atendimento ao público','expediente_especial'
)
select dt,nm,category from days order by dt $$;

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
  select jsonb_agg(jsonb_build_object('id',id,'date',holiday_date,'name',name,'automatic',automatic,'category',category) order by holiday_date)
  from (
   select id,holiday_date,name,false as automatic,'local'::text category from public.store_financial_holidays
   where store_id=p_store_id and extract(year from holiday_date)=coalesce(p_year,extract(year from current_date)::int)
   union all select null::uuid,holiday_date,name,true,category from public.financial_banking_holidays_for_year(coalesce(p_year,extract(year from current_date)::int))
  ) h
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
          or exists(select 1 from public.financial_banking_holidays_for_year(extract(year from i.due_date)::int) bh where bh.holiday_date=i.due_date)
          or exists(select 1 from public.store_financial_holidays h
                    where h.store_id=p_store_id and h.holiday_date=i.due_date)) as is_non_business_due_date,
        (select to_char(d::date,'YYYY-MM-DD')
           from generate_series(i.due_date,i.due_date+interval '20 days',interval '1 day') d
          where extract(isodow from d) not in (6,7)
            and not exists(select 1 from public.financial_banking_holidays_for_year(extract(year from d)::int) bh where bh.holiday_date=d::date)
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
end $function$;