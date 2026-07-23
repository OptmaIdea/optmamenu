create table if not exists public.order_message_events (
  id uuid primary key default extensions.gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  event_code text not null,
  direction text not null default 'store_to_customer',
  channel text not null default 'whatsapp',
  send_mode text not null default 'assisted',
  status text not null default 'prepared',
  recipient text,
  rendered_message text not null,
  provider_message_id text,
  error_message text,
  created_by uuid default auth.uid(),
  opened_at timestamptz,
  confirmed_sent_at timestamptz,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint order_message_events_direction_check check (direction in ('customer_to_store','store_to_customer','internal')),
  constraint order_message_events_channel_check check (channel in ('whatsapp','internal','email','sms','push')),
  constraint order_message_events_send_mode_check check (send_mode in ('manual','assisted','automatic')),
  constraint order_message_events_status_check check (status in ('prepared','opened','confirmed_sent','sent','failed','cancelled'))
);

create index if not exists order_message_events_order_idx on public.order_message_events(order_id, created_at desc);
create index if not exists order_message_events_store_idx on public.order_message_events(store_id, created_at desc);
create index if not exists order_message_events_status_idx on public.order_message_events(store_id, status, created_at desc);

alter table public.order_message_events enable row level security;
revoke all on public.order_message_events from anon, authenticated;

create or replace function public.log_order_message_event(
  p_order_id uuid,
  p_event_code text,
  p_rendered_message text,
  p_recipient text default null,
  p_status text default 'prepared',
  p_direction text default 'store_to_customer',
  p_channel text default 'whatsapp',
  p_send_mode text default 'assisted',
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_store_id uuid;
  v_event_id uuid;
begin
  select o.store_id into v_store_id
  from public.orders o
  where o.id = p_order_id;

  if v_store_id is null then
    return jsonb_build_object('ok', false, 'error', 'order_not_found');
  end if;

  if auth.uid() is null or not exists (
    select 1
    from public.store_members sm
    where sm.store_id = v_store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
  ) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  insert into public.order_message_events (
    store_id, order_id, event_code, direction, channel, send_mode,
    status, recipient, rendered_message, created_by, opened_at, metadata
  ) values (
    v_store_id, p_order_id, trim(p_event_code), p_direction, p_channel, p_send_mode,
    p_status, nullif(trim(coalesce(p_recipient, '')), ''), p_rendered_message, auth.uid(),
    case when p_status = 'opened' then now() else null end,
    coalesce(p_metadata, '{}'::jsonb)
  ) returning id into v_event_id;

  return jsonb_build_object('ok', true, 'event_id', v_event_id);
end;
$function$;

grant execute on function public.log_order_message_event(uuid,text,text,text,text,text,text,text,jsonb) to authenticated;

create or replace function public.get_order_message_events(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_store_id uuid;
  v_events jsonb;
begin
  select o.store_id into v_store_id from public.orders o where o.id = p_order_id;

  if v_store_id is null then
    return jsonb_build_object('ok', false, 'error', 'order_not_found');
  end if;

  if auth.uid() is null or not exists (
    select 1 from public.store_members sm
    where sm.store_id = v_store_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
  ) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id,
    'event_code', e.event_code,
    'direction', e.direction,
    'channel', e.channel,
    'send_mode', e.send_mode,
    'status', e.status,
    'recipient', e.recipient,
    'rendered_message', e.rendered_message,
    'created_by', e.created_by,
    'opened_at', e.opened_at,
    'confirmed_sent_at', e.confirmed_sent_at,
    'created_at', e.created_at,
    'metadata', e.metadata
  ) order by e.created_at desc), '[]'::jsonb)
  into v_events
  from public.order_message_events e
  where e.order_id = p_order_id;

  return jsonb_build_object('ok', true, 'events', v_events);
end;
$function$;

grant execute on function public.get_order_message_events(uuid) to authenticated;
notify pgrst, 'reload schema';
