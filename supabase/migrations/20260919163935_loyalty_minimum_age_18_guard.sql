create or replace function public.enforce_customer_loyalty_adult_safe()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if coalesce(new.loyalty_opt_in,false)
     and (new.birth_date is null or new.birth_date > (current_date - interval '18 years')::date) then
    raise exception using
      errcode='P0001',
      message='loyalty_requires_adult_customer',
      detail='O programa de fidelidade exige idade mínima de 18 anos.';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_customers_loyalty_adult_guard on public.customers;
create trigger trg_customers_loyalty_adult_guard
before insert or update of loyalty_opt_in,birth_date
on public.customers
for each row
execute function public.enforce_customer_loyalty_adult_safe();

alter function public.join_customer_self_loyalty_safe(boolean,boolean,boolean,boolean,boolean)
  rename to join_customer_self_loyalty_profile_safe_internal;

revoke all on function public.join_customer_self_loyalty_profile_safe_internal(boolean,boolean,boolean,boolean,boolean)
from public,anon,authenticated;
grant execute on function public.join_customer_self_loyalty_profile_safe_internal(boolean,boolean,boolean,boolean,boolean)
to service_role;

create or replace function public.join_customer_self_loyalty_safe(
  p_accept_terms boolean,
  p_data_responsibility boolean,
  p_marketing_whatsapp boolean default false,
  p_marketing_email boolean default false,
  p_marketing_sms boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_customer_id uuid:=public.app_current_customer_id();
  v_store_id uuid:=public.app_current_store_id();
  v_birth_date date;
begin
  if public.app_current_role()<>'customer' or v_customer_id is null or v_store_id is null then
    return jsonb_build_object('ok',false,'error','access_denied');
  end if;

  select birth_date into v_birth_date
  from public.customers
  where id=v_customer_id and store_id=v_store_id;

  if not found then
    return jsonb_build_object('ok',false,'error','customer_not_found');
  end if;

  if v_birth_date is null then
    return jsonb_build_object(
      'ok',false,
      'error','loyalty_profile_incomplete',
      'missing_fields',jsonb_build_array('data de nascimento'),
      'message','Informe sua data de nascimento antes de participar do programa.'
    );
  end if;

  if v_birth_date > (current_date - interval '18 years')::date then
    return jsonb_build_object(
      'ok',false,
      'error','loyalty_age_restricted',
      'message','O programa de fidelidade desta loja é destinado apenas a clientes com 18 anos ou mais.'
    );
  end if;

  return public.join_customer_self_loyalty_profile_safe_internal(
    p_accept_terms,
    p_data_responsibility,
    p_marketing_whatsapp,
    p_marketing_email,
    p_marketing_sms
  );
end;
$function$;

revoke all on function public.join_customer_self_loyalty_safe(boolean,boolean,boolean,boolean,boolean) from public,anon;
grant execute on function public.join_customer_self_loyalty_safe(boolean,boolean,boolean,boolean,boolean) to authenticated,service_role;
