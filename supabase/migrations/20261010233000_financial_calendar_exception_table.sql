create table if not exists public.store_financial_calendar_exceptions (
 id uuid primary key default gen_random_uuid(),
 store_id uuid not null references public.stores(id) on delete cascade,
 calendar_date date not null,
 status text not null check (status in ('open','closed','optional','special_hours')),
 reason text not null check(length(trim(reason))>=8),
 created_by uuid, created_at timestamptz default now(),updated_at timestamptz default now(),
 unique(store_id,calendar_date)
);
alter table public.store_financial_calendar_exceptions enable row level security;
revoke all on public.store_financial_calendar_exceptions from anon,authenticated;
create or replace function public.save_store_financial_calendar_exception_safe(p_store_id uuid,p_date date,p_status text,p_reason text)
returns jsonb language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare v_id uuid;
begin
 if auth.uid() is null or not (public.app_is_store_owner(p_store_id) or public.user_has_store_permission(p_store_id,'accounts_payable.manage')) then
 return jsonb_build_object('ok',false,'error','access_denied'); end if;
 if p_date is null or p_status not in ('open','closed','optional','special_hours') or length(trim(coalesce(p_reason,'')))<8 then
 return jsonb_build_object('ok',false,'error','invalid_calendar_exception'); end if;
 insert into public.store_financial_calendar_exceptions(store_id,calendar_date,status,reason,created_by)
 values(p_store_id,p_date,p_status,trim(p_reason),auth.uid())
 on conflict(store_id,calendar_date) do update set status=excluded.status,reason=excluded.reason,updated_at=now(),created_by=auth.uid()
 returning id into v_id;
 return jsonb_build_object('ok',true,'id',v_id);
end $$;
revoke all on function public.save_store_financial_calendar_exception_safe(uuid,date,text,text) from public;
grant execute on function public.save_store_financial_calendar_exception_safe(uuid,date,text,text) to authenticated;
create or replace function public.delete_store_financial_calendar_exception_safe(p_store_id uuid,p_date date)
returns jsonb language plpgsql security definer set search_path=public,auth,pg_temp as $$
begin
 if auth.uid() is null or not (public.app_is_store_owner(p_store_id) or public.user_has_store_permission(p_store_id,'accounts_payable.manage')) then
 return jsonb_build_object('ok',false,'error','access_denied'); end if;
 delete from public.store_financial_calendar_exceptions where store_id=p_store_id and calendar_date=p_date;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.delete_store_financial_calendar_exception_safe(uuid,date) from public;
grant execute on function public.delete_store_financial_calendar_exception_safe(uuid,date) to authenticated;