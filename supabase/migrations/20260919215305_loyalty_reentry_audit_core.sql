
alter table public.fidelity_programs
  add column if not exists reentry_bonus_mode text not null default 'percentage',
  add column if not exists reentry_bonus_percentage numeric(5,2) not null default 30,
  add column if not exists reentry_bonus_fixed_points integer not null default 0,
  add column if not exists reentry_bonus_cooldown_days integer not null default 30,
  add column if not exists reentry_bonus_max_awards integer default 1,
  add column if not exists loyalty_audit_retention_months integer not null default 60;

alter table public.fidelity_programs drop constraint if exists fidelity_programs_reentry_bonus_mode_check;
alter table public.fidelity_programs add constraint fidelity_programs_reentry_bonus_mode_check
  check (reentry_bonus_mode in ('none','percentage','fixed'));
alter table public.fidelity_programs drop constraint if exists fidelity_programs_reentry_bonus_percentage_check;
alter table public.fidelity_programs add constraint fidelity_programs_reentry_bonus_percentage_check
  check (reentry_bonus_percentage between 0 and 100);
alter table public.fidelity_programs drop constraint if exists fidelity_programs_reentry_bonus_fixed_points_check;
alter table public.fidelity_programs add constraint fidelity_programs_reentry_bonus_fixed_points_check
  check (reentry_bonus_fixed_points >= 0);
alter table public.fidelity_programs drop constraint if exists fidelity_programs_reentry_bonus_cooldown_days_check;
alter table public.fidelity_programs add constraint fidelity_programs_reentry_bonus_cooldown_days_check
  check (reentry_bonus_cooldown_days between 0 and 3650);
alter table public.fidelity_programs drop constraint if exists fidelity_programs_reentry_bonus_max_awards_check;
alter table public.fidelity_programs add constraint fidelity_programs_reentry_bonus_max_awards_check
  check (reentry_bonus_max_awards is null or reentry_bonus_max_awards >= 0);
alter table public.fidelity_programs drop constraint if exists fidelity_programs_loyalty_audit_retention_months_check;
alter table public.fidelity_programs add constraint fidelity_programs_loyalty_audit_retention_months_check
  check (loyalty_audit_retention_months between 1 and 120);

create table if not exists public.loyalty_participation_audit (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  cpf_hash text not null,
  cpf_last4 text,
  first_joined_at timestamptz not null default clock_timestamp(),
  last_joined_at timestamptz not null default clock_timestamp(),
  last_left_at timestamptz,
  join_count integer not null default 0,
  first_join_bonus_points integer not null default 0,
  bonified_reentry_count integer not null default 0,
  last_bonus_at timestamptz,
  last_bonus_points integer not null default 0,
  last_bonus_rule jsonb not null default '{}'::jsonb,
  purpose text not null default 'loyalty_reentry_antifraud_audit',
  retention_until timestamptz not null default (clock_timestamp() + interval '60 months'),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique(store_id, cpf_hash),
  check (join_count >= 0),
  check (bonified_reentry_count >= 0),
  check (first_join_bonus_points >= 0),
  check (last_bonus_points >= 0)
);

create table if not exists public.loyalty_membership_audit_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  cpf_hash text not null,
  cpf_last4 text,
  event_type text not null,
  join_sequence integer,
  bonus_points integer not null default 0,
  applied_rule jsonb not null default '{}'::jsonb,
  reason text,
  actor_user_id uuid references auth.users(id) on delete set null,
  source text not null default 'loyalty',
  purpose text not null default 'loyalty_reentry_antifraud_audit',
  occurred_at timestamptz not null default clock_timestamp(),
  retention_until timestamptz not null,
  check (event_type in ('first_join','reentry','leave','admin_remove','ban','unban')),
  check (bonus_points >= 0)
);

create index if not exists loyalty_participation_audit_store_customer_idx
  on public.loyalty_participation_audit(store_id, customer_id);
create index if not exists loyalty_participation_audit_retention_idx
  on public.loyalty_participation_audit(retention_until);
create index if not exists loyalty_membership_audit_events_store_customer_idx
  on public.loyalty_membership_audit_events(store_id, customer_id, occurred_at desc);
create index if not exists loyalty_membership_audit_events_retention_idx
  on public.loyalty_membership_audit_events(retention_until);

alter table public.loyalty_participation_audit enable row level security;
alter table public.loyalty_participation_audit force row level security;
alter table public.loyalty_membership_audit_events enable row level security;
alter table public.loyalty_membership_audit_events force row level security;
revoke all on public.loyalty_participation_audit from public, anon, authenticated;
revoke all on public.loyalty_membership_audit_events from public, anon, authenticated;
grant select, insert, update, delete on public.loyalty_participation_audit to service_role;
grant select, insert, update, delete on public.loyalty_membership_audit_events to service_role;

insert into public.loyalty_participation_audit(
  store_id, customer_id, cpf_hash, cpf_last4,
  first_joined_at, last_joined_at, join_count,
  first_join_bonus_points, bonified_reentry_count,
  last_bonus_at, last_bonus_points, last_bonus_rule,
  retention_until
)
select
  c.store_id,
  c.id,
  public.fidelity_cpf_hash(c.store_id,c.cpf),
  right(regexp_replace(c.cpf,'\D','','g'),4),
  coalesce(jb.first_joined_at,c.created_at),
  coalesce(jb.last_joined_at,c.updated_at,c.created_at),
  1,
  coalesce(jb.first_bonus_points,fp.join_bonus_points,0),
  0,
  jb.last_bonus_at,
  coalesce(jb.last_bonus_points,0),
  jsonb_build_object('backfilled',true,'reason','existing_participant_or_known_history'),
  clock_timestamp() + make_interval(months => coalesce(fp.loyalty_audit_retention_months,60))
from public.customers c
left join lateral (
  select
    min(lt.created_at) as first_joined_at,
    max(lt.created_at) as last_joined_at,
    (array_agg(lt.points order by lt.created_at asc))[1]::integer as first_bonus_points,
    max(lt.created_at) filter (where lt.points > 0) as last_bonus_at,
    (array_agg(lt.points order by lt.created_at desc))[1]::integer as last_bonus_points
  from public.loyalty_transactions lt
  where lt.customer_id=c.id and lt.type='join_bonus'
) jb on true
left join lateral (
  select fp0.* from public.fidelity_programs fp0
  where fp0.store_id=c.store_id
  order by fp0.updated_at desc limit 1
) fp on true
where length(regexp_replace(coalesce(c.cpf,''),'\D','','g'))=11
  and (
    coalesce(c.loyalty_opt_in,false)
    or jb.first_joined_at is not null
    or exists(
      select 1 from public.fidelity_membership_blocks b
      where b.store_id=c.store_id and b.customer_id=c.id
    )
  )
on conflict (store_id,cpf_hash) do nothing;

insert into public.loyalty_participation_audit(
  store_id,customer_id,cpf_hash,cpf_last4,
  first_joined_at,last_joined_at,join_count,first_join_bonus_points,
  bonified_reentry_count,last_bonus_points,last_bonus_rule,retention_until
)
select
  b.store_id,b.customer_id,b.cpf_hash,b.cpf_last4,
  b.blocked_at,b.blocked_at,1,coalesce(fp.join_bonus_points,0),
  0,0,jsonb_build_object('backfilled',true,'reason','existing_membership_block'),
  clock_timestamp()+make_interval(months=>coalesce(fp.loyalty_audit_retention_months,60))
from public.fidelity_membership_blocks b
left join lateral (
  select fp0.* from public.fidelity_programs fp0
  where fp0.store_id=b.store_id order by fp0.updated_at desc limit 1
) fp on true
on conflict (store_id,cpf_hash) do nothing;

create or replace function public.loyalty_join_bonus_preview_internal(
  p_store_id uuid,
  p_customer_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_program public.fidelity_programs%rowtype;
  v_customer public.customers%rowtype;
  v_audit public.loyalty_participation_audit%rowtype;
  v_hash text;
  v_is_reentry boolean:=false;
  v_bonus integer:=0;
  v_original integer:=0;
  v_cooldown_until timestamptz;
  v_cooldown_ok boolean:=true;
  v_limit_ok boolean:=true;
  v_rule jsonb:='{}'::jsonb;
  v_explanation text;
begin
  select * into v_customer from public.customers
  where id=p_customer_id and store_id=p_store_id;
  if not found then return jsonb_build_object('ok',false,'error','customer_not_found'); end if;

  select * into v_program from public.fidelity_programs
  where store_id=p_store_id order by updated_at desc limit 1;
  if not found then return jsonb_build_object('ok',false,'error','loyalty_program_not_found'); end if;

  if length(regexp_replace(coalesce(v_customer.cpf,''),'\D','','g'))=11 then
    v_hash:=public.fidelity_cpf_hash(p_store_id,v_customer.cpf);
    select * into v_audit from public.loyalty_participation_audit
    where store_id=p_store_id and cpf_hash=v_hash;
  end if;

  v_is_reentry:=v_audit.id is not null and coalesce(v_audit.join_count,0)>0;
  v_original:=case
    when v_is_reentry and coalesce(v_audit.first_join_bonus_points,0)>0 then v_audit.first_join_bonus_points
    else greatest(coalesce(v_program.join_bonus_points,0),0)
  end;

  if not coalesce(v_program.enable_join_bonus,false) then
    v_bonus:=0;
    v_explanation:='O programa não concede bônus de adesão neste momento.';
  elsif not v_is_reentry then
    v_bonus:=greatest(coalesce(v_program.join_bonus_points,0),0);
    v_explanation:=case when v_bonus>0
      then format('Primeira adesão: bônus integral de %s ponto(s).',v_bonus)
      else 'Primeira adesão sem bônus de pontos.' end;
  else
    if v_audit.last_bonus_at is not null and coalesce(v_program.reentry_bonus_cooldown_days,0)>0 then
      v_cooldown_until:=v_audit.last_bonus_at + make_interval(days=>v_program.reentry_bonus_cooldown_days);
      v_cooldown_ok:=clock_timestamp()>=v_cooldown_until;
    end if;

    v_limit_ok:=v_program.reentry_bonus_max_awards is null
      or coalesce(v_audit.bonified_reentry_count,0)<v_program.reentry_bonus_max_awards;

    if coalesce(v_program.reentry_bonus_mode,'none')='none' then
      v_bonus:=0;
      v_explanation:='Reentrada permitida, sem novo bônus de adesão.';
    elsif not v_limit_ok then
      v_bonus:=0;
      v_explanation:='Reentrada permitida, mas o limite de reentradas bonificadas já foi atingido.';
    elsif not v_cooldown_ok then
      v_bonus:=0;
      v_explanation:=format('Reentrada permitida sem bônus agora. Nova elegibilidade a bônus após %s.',to_char(v_cooldown_until,'DD/MM/YYYY'));
    elsif v_program.reentry_bonus_mode='percentage' then
      v_bonus:=greatest(round(v_original*coalesce(v_program.reentry_bonus_percentage,0)/100.0)::integer,0);
      v_explanation:=format('Reentrada: %s%% do bônus original (%s ponto(s)), totalizando %s ponto(s).',trim(to_char(v_program.reentry_bonus_percentage,'FM999990D##')),v_original,v_bonus);
    elsif v_program.reentry_bonus_mode='fixed' then
      v_bonus:=greatest(coalesce(v_program.reentry_bonus_fixed_points,0),0);
      v_explanation:=format('Reentrada: bônus fixo de %s ponto(s).',v_bonus);
    else
      v_bonus:=0;
      v_explanation:='Reentrada permitida, sem novo bônus de adesão.';
    end if;
  end if;

  v_rule:=jsonb_build_object(
    'is_reentry',v_is_reentry,
    'mode',case when v_is_reentry then v_program.reentry_bonus_mode else 'first_join_full' end,
    'original_bonus_points',v_original,
    'percentage',v_program.reentry_bonus_percentage,
    'fixed_points',v_program.reentry_bonus_fixed_points,
    'cooldown_days',v_program.reentry_bonus_cooldown_days,
    'cooldown_until',v_cooldown_until,
    'cooldown_satisfied',v_cooldown_ok,
    'max_bonified_reentries',v_program.reentry_bonus_max_awards,
    'bonified_reentries_used',coalesce(v_audit.bonified_reentry_count,0),
    'expected_bonus_points',v_bonus
  );

  return jsonb_build_object(
    'ok',true,
    'is_reentry',v_is_reentry,
    'expected_bonus_points',v_bonus,
    'explanation',v_explanation,
    'rule',v_rule
  );
end;
$function$;
revoke all on function public.loyalty_join_bonus_preview_internal(uuid,uuid) from public,anon,authenticated;
grant execute on function public.loyalty_join_bonus_preview_internal(uuid,uuid) to service_role;

create or replace function public.grant_loyalty_join_bonus()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_program public.fidelity_programs%rowtype;
  v_preview jsonb;
  v_bonus integer:=0;
  v_is_reentry boolean:=false;
  v_hash text;
  v_last4 text;
  v_audit public.loyalty_participation_audit%rowtype;
  v_join_sequence integer:=1;
  v_retention timestamptz;
  v_rule jsonb:='{}'::jsonb;
  v_explanation text;
begin
  if tg_op='INSERT' then
    if coalesce(new.loyalty_opt_in,false)=false then return new; end if;
  elsif tg_op='UPDATE' then
    if coalesce(new.loyalty_opt_in,false)=false or coalesce(old.loyalty_opt_in,false)=true then return new; end if;
  else
    return new;
  end if;

  if length(regexp_replace(coalesce(new.cpf,''),'\D','','g'))<>11 then
    return new;
  end if;

  select * into v_program from public.fidelity_programs
  where store_id=new.store_id order by updated_at desc limit 1;
  if not found then return new; end if;

  v_hash:=public.fidelity_cpf_hash(new.store_id,new.cpf);
  v_last4:=right(regexp_replace(new.cpf,'\D','','g'),4);
  v_preview:=public.loyalty_join_bonus_preview_internal(new.store_id,new.id);
  v_bonus:=greatest(coalesce((v_preview->>'expected_bonus_points')::integer,0),0);
  v_is_reentry:=coalesce((v_preview->>'is_reentry')::boolean,false);
  v_rule:=coalesce(v_preview->'rule','{}'::jsonb);
  v_explanation:=coalesce(v_preview->>'explanation','');
  v_retention:=clock_timestamp()+make_interval(months=>coalesce(v_program.loyalty_audit_retention_months,60));

  select * into v_audit from public.loyalty_participation_audit
  where store_id=new.store_id and cpf_hash=v_hash for update;

  if found then
    v_join_sequence:=coalesce(v_audit.join_count,0)+1;
    update public.loyalty_participation_audit
       set customer_id=new.id,
           cpf_last4=v_last4,
           last_joined_at=clock_timestamp(),
           join_count=v_join_sequence,
           bonified_reentry_count=coalesce(bonified_reentry_count,0)+case when v_is_reentry and v_bonus>0 then 1 else 0 end,
           last_bonus_at=case when v_bonus>0 then clock_timestamp() else last_bonus_at end,
           last_bonus_points=case when v_bonus>0 then v_bonus else last_bonus_points end,
           last_bonus_rule=v_rule||jsonb_build_object('explanation',v_explanation),
           retention_until=v_retention,
           updated_at=clock_timestamp()
     where id=v_audit.id;
  else
    v_join_sequence:=1;
    insert into public.loyalty_participation_audit(
      store_id,customer_id,cpf_hash,cpf_last4,first_joined_at,last_joined_at,join_count,
      first_join_bonus_points,bonified_reentry_count,last_bonus_at,last_bonus_points,last_bonus_rule,retention_until
    ) values (
      new.store_id,new.id,v_hash,v_last4,clock_timestamp(),clock_timestamp(),1,
      v_bonus,0,case when v_bonus>0 then clock_timestamp() else null end,v_bonus,
      v_rule||jsonb_build_object('explanation',v_explanation),v_retention
    );
  end if;

  insert into public.loyalty_membership_audit_events(
    store_id,customer_id,cpf_hash,cpf_last4,event_type,join_sequence,bonus_points,
    applied_rule,actor_user_id,source,retention_until
  ) values (
    new.store_id,new.id,v_hash,v_last4,case when v_is_reentry then 'reentry' else 'first_join' end,
    v_join_sequence,v_bonus,v_rule||jsonb_build_object('explanation',v_explanation),auth.uid(),
    'loyalty_opt_in',v_retention
  );

  if v_bonus>0 then
    update public.customers
       set loyalty_points=coalesce(loyalty_points,0)+v_bonus,
           last_point_activity_at=clock_timestamp(),
           updated_at=clock_timestamp()
     where id=new.id and store_id=new.store_id;

    insert into public.loyalty_transactions(program_id,customer_id,type,points,description,created_by,created_at)
    values(
      v_program.id,new.id,'join_bonus',v_bonus,
      case when v_is_reentry then 'Bônus de reentrada no programa de fidelidade' else 'Bônus de boas-vindas ao programa de fidelidade' end,
      auth.uid(),clock_timestamp()
    );

    insert into public.customer_notifications(customer_id,store_id,title,message,type)
    values(new.id,new.store_id,
      case when v_is_reentry then 'Bônus de reentrada' else 'Bem-vindo ao programa de fidelidade!' end,
      v_explanation,'success');
  elsif v_is_reentry then
    insert into public.customer_notifications(customer_id,store_id,title,message,type)
    values(new.id,new.store_id,'Reentrada no programa de fidelidade',v_explanation,'info');
  end if;

  return new;
end;
$function$;
revoke all on function public.grant_loyalty_join_bonus() from public,anon,authenticated;
grant execute on function public.grant_loyalty_join_bonus() to service_role;

drop trigger if exists trg_grant_loyalty_join_bonus on public.customers;
create trigger trg_grant_loyalty_join_bonus
after insert or update of loyalty_opt_in on public.customers
for each row execute function public.grant_loyalty_join_bonus();

create or replace function public.record_loyalty_exit_audit_internal(
  p_store_id uuid,
  p_customer_id uuid,
  p_event_type text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_customer public.customers%rowtype;
  v_program public.fidelity_programs%rowtype;
  v_hash text;
  v_last4 text;
  v_retention timestamptz;
  v_audit public.loyalty_participation_audit%rowtype;
begin
  if p_event_type not in ('leave','admin_remove','ban','unban') then return; end if;
  select * into v_customer from public.customers where id=p_customer_id and store_id=p_store_id;
  if not found or length(regexp_replace(coalesce(v_customer.cpf,''),'\D','','g'))<>11 then return; end if;
  select * into v_program from public.fidelity_programs where store_id=p_store_id order by updated_at desc limit 1;
  v_hash:=public.fidelity_cpf_hash(p_store_id,v_customer.cpf);
  v_last4:=right(regexp_replace(v_customer.cpf,'\D','','g'),4);
  v_retention:=clock_timestamp()+make_interval(months=>coalesce(v_program.loyalty_audit_retention_months,60));

  select * into v_audit from public.loyalty_participation_audit
  where store_id=p_store_id and cpf_hash=v_hash for update;
  if found then
    update public.loyalty_participation_audit
       set customer_id=p_customer_id,cpf_last4=v_last4,
           last_left_at=case when p_event_type in ('leave','admin_remove','ban') then clock_timestamp() else last_left_at end,
           retention_until=v_retention,updated_at=clock_timestamp()
     where id=v_audit.id;
  else
    insert into public.loyalty_participation_audit(
      store_id,customer_id,cpf_hash,cpf_last4,first_joined_at,last_joined_at,last_left_at,join_count,
      first_join_bonus_points,last_bonus_rule,retention_until
    ) values(
      p_store_id,p_customer_id,v_hash,v_last4,coalesce(v_customer.created_at,clock_timestamp()),coalesce(v_customer.updated_at,clock_timestamp()),
      case when p_event_type in ('leave','admin_remove','ban') then clock_timestamp() else null end,1,
      greatest(coalesce(v_program.join_bonus_points,0),0),jsonb_build_object('inferred',true),v_retention
    ) returning * into v_audit;
  end if;

  insert into public.loyalty_membership_audit_events(
    store_id,customer_id,cpf_hash,cpf_last4,event_type,join_sequence,bonus_points,applied_rule,reason,actor_user_id,source,retention_until
  ) values(
    p_store_id,p_customer_id,v_hash,v_last4,p_event_type,coalesce(v_audit.join_count,1),0,'{}'::jsonb,
    nullif(trim(coalesce(p_reason,'')),''),auth.uid(),
    case when public.app_current_role()='customer' then 'customer_self_service' else 'admin_loyalty' end,
    v_retention
  );
end;
$function$;
revoke all on function public.record_loyalty_exit_audit_internal(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.record_loyalty_exit_audit_internal(uuid,uuid,text,text) to service_role;

create or replace function public.purge_customer_loyalty_data_internal(p_store_id uuid,p_customer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_vouchers integer:=0;
  v_transactions integer:=0;
  v_consents integer:=0;
begin
  delete from public.fidelity_vouchers where store_id=p_store_id and customer_id=p_customer_id;
  get diagnostics v_vouchers=row_count;
  delete from public.loyalty_transactions lt
   where lt.customer_id=p_customer_id
     and (lt.program_id is null
       or exists(select 1 from public.fidelity_programs fp where fp.id=lt.program_id and fp.store_id=p_store_id)
       or exists(select 1 from public.orders o where o.id=lt.order_id and o.store_id=p_store_id));
  get diagnostics v_transactions=row_count;
  delete from public.customer_consent_logs
   where customer_id=p_customer_id and store_id=p_store_id
     and consent_type in ('loyalty_program','loyalty_data_responsibility');
  get diagnostics v_consents=row_count;
  update public.customers
     set loyalty_opt_in=false,loyalty_points=0,loyalty_tier='Bronze',current_tier_id=null,
         current_stamps=0,last_point_activity_at=null,updated_at=clock_timestamp()
   where id=p_customer_id and store_id=p_store_id;
  return jsonb_build_object('ok',true,'deleted_vouchers',v_vouchers,'deleted_transactions',v_transactions,
    'deleted_loyalty_consents',v_consents,'preserved_audit_marker',true);
end;
$function$;
revoke all on function public.purge_customer_loyalty_data_internal(uuid,uuid) from public,anon,authenticated;
grant execute on function public.purge_customer_loyalty_data_internal(uuid,uuid) to service_role;

create or replace function public.leave_customer_self_loyalty_safe()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_customer_id uuid:=public.app_current_customer_id();
  v_store_id uuid:=public.app_current_store_id();
  v_result jsonb;
begin
  if public.app_current_role()<>'customer' or v_customer_id is null or v_store_id is null then
    return jsonb_build_object('ok',false,'error','access_denied');
  end if;
  if not exists(select 1 from public.customers c where c.id=v_customer_id and c.store_id=v_store_id and c.status not in ('merged','anonymized')) then
    return jsonb_build_object('ok',false,'error','customer_not_found');
  end if;
  perform public.record_loyalty_exit_audit_internal(v_store_id,v_customer_id,'leave','Saída voluntária do programa');
  v_result:=public.purge_customer_loyalty_data_internal(v_store_id,v_customer_id);
  return coalesce(v_result,'{}'::jsonb)||jsonb_build_object(
    'ok',true,'membership','left','can_rejoin',true,
    'message','Participação encerrada e dados operacionais do programa removidos. Um marcador mínimo antifraude de participação anterior é mantido pelo prazo informado no regulamento.'
  );
end;
$function$;
revoke all on function public.leave_customer_self_loyalty_safe() from public,anon;
grant execute on function public.leave_customer_self_loyalty_safe() to authenticated,service_role;

create or replace function public.get_customer_self_loyalty_program_safe()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_customer_id uuid:=public.app_current_customer_id();
  v_store_id uuid:=public.app_current_store_id();
  v_customer public.customers%rowtype;
  v_program public.fidelity_programs%rowtype;
  v_store_name text;
  v_blocked boolean:=false;
  v_block_reason text;
  v_terms text;
  v_voucher_terms text;
  v_voucher_days integer:=15;
  v_preview jsonb;
begin
  if public.app_current_role()<>'customer' or v_customer_id is null or v_store_id is null then
    return jsonb_build_object('ok',false,'error','access_denied');
  end if;
  select * into v_customer from public.customers where id=v_customer_id and store_id=v_store_id limit 1;
  if not found then return jsonb_build_object('ok',false,'error','customer_not_found'); end if;
  select * into v_program from public.fidelity_programs where store_id=v_store_id order by is_active desc,updated_at desc limit 1;
  select s.name into v_store_name from public.stores s where s.id=v_store_id;
  select exists(
    select 1 from public.fidelity_membership_blocks b
    where b.store_id=v_store_id and b.unblocked_at is null and (
      b.customer_id=v_customer_id or (
        length(regexp_replace(coalesce(v_customer.cpf,''),'\D','','g'))=11
        and b.cpf_hash=public.fidelity_cpf_hash(v_store_id,v_customer.cpf)
      )
    )
  ) into v_blocked;
  select b.reason into v_block_reason from public.fidelity_membership_blocks b
  where b.store_id=v_store_id and b.unblocked_at is null and (
    b.customer_id=v_customer_id or (
      length(regexp_replace(coalesce(v_customer.cpf,''),'\D','','g'))=11
      and b.cpf_hash=public.fidelity_cpf_hash(v_store_id,v_customer.cpf)
    )
  ) order by b.blocked_at desc limit 1;
  if v_program.id is null then
    return jsonb_build_object('ok',true,'program',null,'membership_blocked',v_blocked,'block_reason',v_block_reason);
  end if;
  select coalesce(max(fr.voucher_validity_days),15) into v_voucher_days
  from public.fidelity_rewards fr where fr.program_id=v_program.id and coalesce(fr.is_active,true)=true;
  v_terms:=coalesce(v_program.program_terms,'');
  v_voucher_terms:=coalesce(v_program.voucher_terms,'');
  v_terms:=replace(replace(replace(replace(v_terms,'{{STORE_NAME}}',coalesce(v_store_name,'Loja')),'{{CURRENT_DATE}}',to_char(current_date,'DD/MM/YYYY')),'{{POINTS_VALIDITY_MONTHS}}',coalesce(v_program.points_validity_months,0)::text),'{{VOUCHER_VALIDITY_DAYS}}',coalesce(v_voucher_days,15)::text);
  v_voucher_terms:=replace(replace(replace(replace(v_voucher_terms,'{{STORE_NAME}}',coalesce(v_store_name,'Loja')),'{{CURRENT_DATE}}',to_char(current_date,'DD/MM/YYYY')),'{{POINTS_VALIDITY_MONTHS}}',coalesce(v_program.points_validity_months,0)::text),'{{VOUCHER_VALIDITY_DAYS}}',coalesce(v_voucher_days,15)::text);
  v_preview:=public.loyalty_join_bonus_preview_internal(v_store_id,v_customer_id);
  return jsonb_build_object(
    'ok',true,'membership_blocked',v_blocked,'block_reason',v_block_reason,'join_policy',v_preview,
    'audit_retention_months',v_program.loyalty_audit_retention_months,
    'audit_purpose','Prevenção de abuso de bônus de reentrada, segurança e auditoria do programa.',
    'program',jsonb_build_object(
      'id',v_program.id,'name',v_program.name,'is_active',v_program.is_active,
      'points_per_currency',v_program.points_per_currency,'min_order_value',v_program.min_order_value,
      'enable_join_bonus',v_program.enable_join_bonus,'join_bonus_points',v_program.join_bonus_points,
      'reentry_bonus_mode',v_program.reentry_bonus_mode,'reentry_bonus_percentage',v_program.reentry_bonus_percentage,
      'reentry_bonus_fixed_points',v_program.reentry_bonus_fixed_points,'reentry_bonus_cooldown_days',v_program.reentry_bonus_cooldown_days,
      'reentry_bonus_max_awards',v_program.reentry_bonus_max_awards,
      'enable_birthday_bonus',v_program.enable_birthday_bonus,'birthday_bonus_points',v_program.birthday_bonus_points,
      'points_validity_months',v_program.points_validity_months,'min_points_redemption',v_program.min_points_redemption,
      'program_terms',v_terms,'voucher_terms',v_voucher_terms,'updated_at',v_program.updated_at
    )
  );
end;
$function$;
revoke all on function public.get_customer_self_loyalty_program_safe() from public,anon;
grant execute on function public.get_customer_self_loyalty_program_safe() to authenticated,service_role;

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
  v_result jsonb;
  v_event jsonb;
begin
  if public.app_current_role()<>'customer' or v_customer_id is null or v_store_id is null then
    return jsonb_build_object('ok',false,'error','access_denied');
  end if;
  select birth_date into v_birth_date from public.customers where id=v_customer_id and store_id=v_store_id;
  if not found then return jsonb_build_object('ok',false,'error','customer_not_found'); end if;
  if v_birth_date is null then
    return jsonb_build_object('ok',false,'error','loyalty_profile_incomplete','missing_fields',jsonb_build_array('data de nascimento'),'message','Informe sua data de nascimento antes de participar do programa.');
  end if;
  if v_birth_date>(current_date-interval '18 years')::date then
    return jsonb_build_object('ok',false,'error','loyalty_age_restricted','message','O programa de fidelidade desta loja é destinado apenas a clientes com 18 anos ou mais.');
  end if;
  v_result:=public.join_customer_self_loyalty_profile_safe_internal(
    p_accept_terms,p_data_responsibility,p_marketing_whatsapp,p_marketing_email,p_marketing_sms
  );
  if coalesce((v_result->>'ok')::boolean,false) then
    select jsonb_build_object(
      'event_type',e.event_type,'bonus_points',e.bonus_points,'applied_rule',e.applied_rule,'occurred_at',e.occurred_at
    ) into v_event
    from public.loyalty_membership_audit_events e
    where e.store_id=v_store_id and e.customer_id=v_customer_id and e.event_type in ('first_join','reentry')
    order by e.occurred_at desc limit 1;
    v_result:=v_result||jsonb_build_object('join_bonus_result',coalesce(v_event,'null'::jsonb));
  end if;
  return v_result;
end;
$function$;
revoke all on function public.join_customer_self_loyalty_safe(boolean,boolean,boolean,boolean,boolean) from public,anon;
grant execute on function public.join_customer_self_loyalty_safe(boolean,boolean,boolean,boolean,boolean) to authenticated,service_role;
