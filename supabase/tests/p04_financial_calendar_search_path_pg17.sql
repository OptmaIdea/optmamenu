\set ON_ERROR_STOP on
\echo 'P04: financial calendar search_path test against original function definitions'
create role anon nologin;
create role authenticated nologin;
grant usage on schema public to anon, authenticated;

CREATE OR REPLACE FUNCTION public.financial_easter_sunday(y integer)
 RETURNS date
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
declare a int;b int;c int;d int;e int;f int;g int;h int;i int;k int;l int;m int;mm int;dd int;
begin
if y<1900 or y>2199 then raise exception 'Ano fora do intervalo'; end if;
a:=mod(y,19);b:=y/100;c:=mod(y,100);d:=b/4;e:=mod(b,4);f:=(b+8)/25;g:=(b-f+1)/3;
h:=mod(19*a+b-d-g+15,30);i:=c/4;k:=mod(c,4);l:=mod(32+2*e+2*i-h-k,7);m:=(a+11*h+22*l)/451;
mm:=(h+l-7*m+114)/31;dd:=mod(h+l-7*m+114,31)+1;
return make_date(y,mm,dd); end $function$;

CREATE OR REPLACE FUNCTION public.financial_banking_holidays_for_year(y integer)
 RETURNS TABLE(holiday_date date, name text, category text)
 LANGUAGE sql
 STABLE
AS $function$
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
select dt,nm,category from days order by dt $function$;

create temporary table p04_before as
select y, public.financial_easter_sunday(y) easter,
  (select count(*) from public.financial_banking_holidays_for_year(y)) holidays,
  (select min(holiday_date) from public.financial_banking_holidays_for_year(y)) first_holiday,
  (select max(holiday_date) from public.financial_banking_holidays_for_year(y)) last_holiday
from (values (2025),(2026),(2027),(2100)) a(y);
\echo 'P04 apply exact versioned migration in isolated PostgreSQL'
\ir ../migrations/20261022001000_financial_calendar_pin_search_path.sql
create temporary table p04_after as
select y, public.financial_easter_sunday(y) easter,
  (select count(*) from public.financial_banking_holidays_for_year(y)) holidays,
  (select min(holiday_date) from public.financial_banking_holidays_for_year(y)) first_holiday,
  (select max(holiday_date) from public.financial_banking_holidays_for_year(y)) last_holiday
from (values (2025),(2026),(2027),(2100)) a(y);
do $verify$
begin
  if exists (select * from p04_before except select * from p04_after)
   or exists (select * from p04_after except select * from p04_before) then
    raise exception 'P04 calendar changed after search_path hardening';
  end if;
  if exists(select 1 from p04_after where holidays<>14) then
    raise exception 'P04 holiday count changed';
  end if;
  if not exists(select 1 from p04_after where y=2026 and easter=date '2026-04-05') or
     not exists(select 1 from p04_after where y=2027 and easter=date '2027-03-28') then
    raise exception 'P04 known Easter dates changed';
  end if;
  if not has_function_privilege('anon','public.financial_easter_sunday(integer)','EXECUTE') or
     not has_function_privilege('authenticated','public.financial_banking_holidays_for_year(integer)','EXECUTE') then
    raise exception 'P04 function grants changed unexpectedly';
  end if;
end $verify$;
set role anon;
select public.financial_easter_sunday(2026);
select count(*) as public_calendar_rows from public.financial_banking_holidays_for_year(2026);
reset role;
\echo 'P04 PASS — business dates unchanged; function access preserved; search_path pinned'
