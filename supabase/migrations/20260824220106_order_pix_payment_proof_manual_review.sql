create table if not exists public.order_payment_proofs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null default 'upload_pending' check (status in ('upload_pending','submitted','confirmed','rejected','superseded','expired')),
  storage_bucket text not null default 'order-payment-proofs',
  storage_path text not null unique,
  original_file_name text,
  content_type text not null,
  declared_amount numeric(14,2),
  declared_paid_at timestamptz,
  upload_expires_at timestamptz,
  submitted_at timestamptz,
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null,
  decision_source text,
  decision_notes text,
  cashbook_entry_id uuid references public.cashbook_entries(id) on delete set null,
  financial_account_id uuid references public.store_financial_accounts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_order_payment_proofs_store_order_created
  on public.order_payment_proofs(store_id, order_id, created_at desc);
create index if not exists idx_order_payment_proofs_status
  on public.order_payment_proofs(store_id, status, created_at desc);

alter table public.order_payment_proofs enable row level security;
revoke all on public.order_payment_proofs from public, anon, authenticated;
grant all on public.order_payment_proofs to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'order-payment-proofs',
  'order-payment-proofs',
  false,
  8388608,
  array['image/jpeg','image/png','image/webp','application/pdf']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  updated_at = now();

create or replace function public.can_upload_order_payment_proof_object(p_name text)
returns boolean
language sql
security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (
    select 1
    from public.order_payment_proofs p
    where p.storage_bucket = 'order-payment-proofs'
      and p.storage_path = p_name
      and p.status = 'upload_pending'
      and p.upload_expires_at > now()
  );
$$;

create or replace function public.can_view_order_payment_proof_object(p_name text)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $$
declare
  v_store_id uuid;
begin
  if auth.uid() is null then return false; end if;

  select p.store_id
  into v_store_id
  from public.order_payment_proofs p
  where p.storage_bucket = 'order-payment-proofs'
    and p.storage_path = p_name
  limit 1;

  if v_store_id is null then return false; end if;

  return public.app_is_store_owner(v_store_id)
    or public.user_has_store_permission_v2(v_store_id, 'financial.manage')
    or public.user_has_store_permission_v2(v_store_id, 'cashbook.view')
    or public.user_has_store_permission_v2(v_store_id, 'orders.manage');
end;
$$;

revoke all on function public.can_upload_order_payment_proof_object(text) from public;
grant execute on function public.can_upload_order_payment_proof_object(text) to anon, authenticated, service_role;
revoke all on function public.can_view_order_payment_proof_object(text) from public, anon;
grant execute on function public.can_view_order_payment_proof_object(text) to authenticated, service_role;

drop policy if exists order_payment_proofs_public_upload on storage.objects;
create policy order_payment_proofs_public_upload
on storage.objects
for insert
to anon, authenticated
with check (
  bucket_id = 'order-payment-proofs'
  and public.can_upload_order_payment_proof_object(name)
);

drop policy if exists order_payment_proofs_staff_read on storage.objects;
create policy order_payment_proofs_staff_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'order-payment-proofs'
  and public.can_view_order_payment_proof_object(name)
);

create or replace function public.create_public_order_payment_proof_ticket(
  p_token text,
  p_file_name text,
  p_content_type text,
  p_declared_amount numeric default null,
  p_declared_paid_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_order record;
  v_method record;
  v_id uuid := gen_random_uuid();
  v_extension text;
  v_storage_path text;
  v_file_name text;
  v_recent_count integer := 0;
begin
  if length(trim(coalesce(p_token,''))) < 16 then
    return jsonb_build_object('ok',false,'error','invalid_token');
  end if;

  if p_content_type not in ('image/jpeg','image/png','image/webp','application/pdf') then
    return jsonb_build_object('ok',false,'error','invalid_content_type');
  end if;

  select o.id,o.store_id,o.order_code,o.status::text as status,o.payment_status,o.payment_method_code,o.total,o.created_at,o.public_order_token
  into v_order
  from public.orders o
  where o.public_order_token = trim(p_token)
  limit 1;

  if v_order.id is null then
    return jsonb_build_object('ok',false,'error','order_not_found');
  end if;

  if v_order.status not in ('reserved','confirmed','ready') then
    return jsonb_build_object('ok',false,'error','order_not_eligible','status',v_order.status);
  end if;

  if coalesce(v_order.payment_status,'pending') = 'paid' then
    return jsonb_build_object('ok',false,'error','payment_already_confirmed');
  end if;

  select pm.code,pm.name,coalesce(pm.base_code,pm.code) as base_code,pm.requires_proof,pm.active
  into v_method
  from public.store_payment_methods pm
  where pm.store_id = v_order.store_id
    and pm.code = v_order.payment_method_code
    and pm.active = true
  limit 1;

  if v_method.code is null or v_method.base_code <> 'pix' then
    return jsonb_build_object('ok',false,'error','not_pix_order');
  end if;

  if p_declared_amount is not null and p_declared_amount <= 0 then
    return jsonb_build_object('ok',false,'error','invalid_declared_amount');
  end if;

  if p_declared_paid_at is not null and p_declared_paid_at > now() + interval '10 minutes' then
    return jsonb_build_object('ok',false,'error','invalid_declared_paid_at');
  end if;

  update public.order_payment_proofs
  set status='expired',updated_at=now()
  where order_id=v_order.id
    and status='upload_pending'
    and upload_expires_at <= now();

  select count(*)
  into v_recent_count
  from public.order_payment_proofs p
  where p.order_id = v_order.id
    and p.created_at >= now() - interval '1 hour';

  if v_recent_count >= 5 then
    return jsonb_build_object('ok',false,'error','too_many_proof_attempts');
  end if;

  v_extension := case p_content_type
    when 'image/jpeg' then '.jpg'
    when 'image/png' then '.png'
    when 'image/webp' then '.webp'
    when 'application/pdf' then '.pdf'
  end;
  v_file_name := nullif(trim(regexp_replace(left(coalesce(p_file_name,'comprovante'),180),'[^a-zA-Z0-9._ -]','','g')), '');
  v_storage_path := v_order.store_id::text || '/' || v_order.id::text || '/' || v_id::text || v_extension;

  insert into public.order_payment_proofs (
    id,store_id,order_id,status,storage_bucket,storage_path,original_file_name,content_type,
    declared_amount,declared_paid_at,upload_expires_at,metadata
  ) values (
    v_id,v_order.store_id,v_order.id,'upload_pending','order-payment-proofs',v_storage_path,
    coalesce(v_file_name,'comprovante' || v_extension),p_content_type,
    coalesce(p_declared_amount,v_order.total),p_declared_paid_at,now()+interval '15 minutes',
    jsonb_build_object('created_from','public_order_tracking','order_code',v_order.order_code)
  );

  return jsonb_build_object(
    'ok',true,
    'proof_id',v_id,
    'storage_bucket','order-payment-proofs',
    'storage_path',v_storage_path,
    'upload_expires_at',now()+interval '15 minutes',
    'max_file_size',8388608,
    'allowed_content_types',jsonb_build_array('image/jpeg','image/png','image/webp','application/pdf')
  );
end;
$$;

create or replace function public.finalize_public_order_payment_proof(
  p_token text,
  p_proof_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'storage', 'pg_temp'
as $$
declare
  v_proof record;
  v_order record;
begin
  select p.*
  into v_proof
  from public.order_payment_proofs p
  where p.id=p_proof_id
  for update;

  if v_proof.id is null then
    return jsonb_build_object('ok',false,'error','proof_not_found');
  end if;

  select o.id,o.store_id,o.public_order_token,o.payment_status,o.status::text as status,o.order_code
  into v_order
  from public.orders o
  where o.id=v_proof.order_id
    and o.store_id=v_proof.store_id
  for update;

  if v_order.id is null or v_order.public_order_token <> trim(coalesce(p_token,'')) then
    return jsonb_build_object('ok',false,'error','invalid_token');
  end if;

  if v_proof.status in ('submitted','confirmed') then
    return jsonb_build_object('ok',true,'proof_id',v_proof.id,'status',v_proof.status,'already_finalized',true);
  end if;

  if v_proof.status <> 'upload_pending' then
    return jsonb_build_object('ok',false,'error','invalid_proof_status','status',v_proof.status);
  end if;

  if v_proof.upload_expires_at <= now() then
    update public.order_payment_proofs set status='expired',updated_at=now() where id=v_proof.id;
    return jsonb_build_object('ok',false,'error','upload_ticket_expired');
  end if;

  if not exists (
    select 1 from storage.objects so
    where so.bucket_id=v_proof.storage_bucket and so.name=v_proof.storage_path
  ) then
    return jsonb_build_object('ok',false,'error','proof_file_not_found');
  end if;

  update public.order_payment_proofs
  set status='superseded',
      decision_source='customer_replaced_proof',
      decision_notes='Substituído por comprovante mais recente.',
      decided_at=now(),
      updated_at=now()
  where order_id=v_order.id
    and id<>v_proof.id
    and status='submitted';

  update public.order_payment_proofs
  set status='submitted',submitted_at=now(),upload_expires_at=null,updated_at=now()
  where id=v_proof.id;

  update public.orders
  set proof_url='storage://' || v_proof.storage_bucket || '/' || v_proof.storage_path,
      payment_metadata=coalesce(payment_metadata,'{}'::jsonb)||jsonb_build_object(
        'payment_proof_id',v_proof.id,
        'proof_status','submitted',
        'proof_submitted_at',now()
      )
  where id=v_order.id;

  return jsonb_build_object('ok',true,'proof_id',v_proof.id,'status','submitted','submitted_at',now());
end;
$$;

create or replace function public.get_public_order_payment_proof_state(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_order record;
  v_method record;
  v_proofs jsonb := '[]'::jsonb;
  v_eligible boolean := false;
begin
  select o.id,o.store_id,o.order_code,o.status::text as status,o.payment_status,o.payment_method_code,o.total
  into v_order
  from public.orders o
  where o.public_order_token=trim(coalesce(p_token,''))
  limit 1;

  if v_order.id is null then return jsonb_build_object('ok',false,'error','order_not_found'); end if;

  select pm.code,pm.name,coalesce(pm.base_code,pm.code) as base_code,pm.requires_proof
  into v_method
  from public.store_payment_methods pm
  where pm.store_id=v_order.store_id and pm.code=v_order.payment_method_code
  limit 1;

  v_eligible := v_order.status in ('reserved','confirmed','ready')
    and coalesce(v_order.payment_status,'pending') <> 'paid'
    and coalesce(v_method.base_code,'')='pix';

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,
    'status',p.status,
    'original_file_name',p.original_file_name,
    'declared_amount',p.declared_amount,
    'declared_paid_at',p.declared_paid_at,
    'submitted_at',p.submitted_at,
    'decided_at',p.decided_at,
    'decision_notes',case when p.status='rejected' then p.decision_notes else null end
  ) order by p.created_at desc),'[]'::jsonb)
  into v_proofs
  from public.order_payment_proofs p
  where p.order_id=v_order.id
    and p.status <> 'upload_pending';

  return jsonb_build_object(
    'ok',true,
    'eligible',v_eligible,
    'order_code',v_order.order_code,
    'order_status',v_order.status,
    'payment_status',v_order.payment_status,
    'payment_method_code',v_method.code,
    'payment_method_name',v_method.name,
    'requires_proof',coalesce(v_method.requires_proof,false),
    'order_total',v_order.total,
    'proofs',v_proofs
  );
end;
$$;

create or replace function public.get_order_payment_proofs_safe(
  p_store_id uuid,
  p_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $$
declare
  v_can_view boolean := false;
  v_can_review boolean := false;
  v_rows jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then return jsonb_build_object('ok',false,'error','access_denied'); end if;

  if not exists(select 1 from public.orders o where o.id=p_order_id and o.store_id=p_store_id) then
    return jsonb_build_object('ok',false,'error','order_not_found');
  end if;

  v_can_review := public.app_is_store_owner(p_store_id)
    or public.user_has_store_permission_v2(p_store_id,'financial.manage')
    or public.user_has_store_permission_v2(p_store_id,'cashbook.create');

  v_can_view := v_can_review
    or public.user_has_store_permission_v2(p_store_id,'cashbook.view')
    or public.user_has_store_permission_v2(p_store_id,'orders.manage');

  if not v_can_view then return jsonb_build_object('ok',false,'error','access_denied'); end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,'status',p.status,'storage_bucket',p.storage_bucket,'storage_path',p.storage_path,
    'original_file_name',p.original_file_name,'content_type',p.content_type,
    'declared_amount',p.declared_amount,'declared_paid_at',p.declared_paid_at,
    'submitted_at',p.submitted_at,'decided_at',p.decided_at,'decided_by',p.decided_by,
    'decision_source',p.decision_source,'decision_notes',p.decision_notes,
    'cashbook_entry_id',p.cashbook_entry_id,'financial_account_id',p.financial_account_id,
    'created_at',p.created_at
  ) order by p.created_at desc),'[]'::jsonb)
  into v_rows
  from public.order_payment_proofs p
  where p.store_id=p_store_id and p.order_id=p_order_id;

  return jsonb_build_object('ok',true,'can_review',v_can_review,'proofs',v_rows);
end;
$$;

create or replace function public.review_order_payment_proof_safe(
  p_store_id uuid,
  p_proof_id uuid,
  p_decision text,
  p_financial_account_id uuid default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $$
declare
  v_proof record;
  v_order record;
  v_method record;
  v_account_id uuid;
  v_account_active boolean;
  v_account_has_routes boolean := false;
  v_account_accepts boolean := false;
  v_entry_id uuid;
  v_entry_code text;
  v_existing_entry_id uuid;
  v_existing_entry_code text;
begin
  if auth.uid() is null then return jsonb_build_object('ok',false,'error','access_denied'); end if;

  if not (
    public.app_is_store_owner(p_store_id)
    or public.user_has_store_permission_v2(p_store_id,'financial.manage')
    or public.user_has_store_permission_v2(p_store_id,'cashbook.create')
  ) then
    return jsonb_build_object('ok',false,'error','access_denied');
  end if;

  if p_decision not in ('confirm','reject') then
    return jsonb_build_object('ok',false,'error','invalid_decision');
  end if;

  select p.* into v_proof
  from public.order_payment_proofs p
  where p.id=p_proof_id and p.store_id=p_store_id
  for update;

  if v_proof.id is null then return jsonb_build_object('ok',false,'error','proof_not_found'); end if;

  select o.id,o.store_id,o.order_code,o.status::text as status,o.payment_status,o.payment_method_code,o.total,o.customer_id,o.customer_name
  into v_order
  from public.orders o
  where o.id=v_proof.order_id and o.store_id=p_store_id
  for update;

  if v_order.id is null then return jsonb_build_object('ok',false,'error','order_not_found'); end if;

  if v_proof.status='confirmed' then
    return jsonb_build_object('ok',true,'already_confirmed',true,'proof_id',v_proof.id,'cashbook_entry_id',v_proof.cashbook_entry_id);
  end if;

  if v_proof.status <> 'submitted' then
    return jsonb_build_object('ok',false,'error','proof_not_submitted','status',v_proof.status);
  end if;

  if p_decision='reject' then
    if length(trim(coalesce(p_notes,''))) < 3 then
      return jsonb_build_object('ok',false,'error','rejection_reason_required');
    end if;

    update public.order_payment_proofs
    set status='rejected',decided_at=now(),decided_by=auth.uid(),decision_source='manual_proof_review',
        decision_notes=trim(p_notes),updated_at=now()
    where id=v_proof.id;

    update public.orders
    set payment_metadata=coalesce(payment_metadata,'{}'::jsonb)||jsonb_build_object(
      'payment_proof_id',v_proof.id,'proof_status','rejected','proof_reviewed_at',now(),
      'proof_reviewed_by',auth.uid(),'proof_rejection_reason',trim(p_notes)
    )
    where id=v_order.id;

    return jsonb_build_object('ok',true,'proof_id',v_proof.id,'status','rejected');
  end if;

  if v_order.status not in ('reserved','confirmed','ready') then
    return jsonb_build_object('ok',false,'error','order_not_eligible','status',v_order.status);
  end if;

  if coalesce(v_order.payment_status,'pending')='paid' then
    return jsonb_build_object('ok',false,'error','payment_already_confirmed');
  end if;

  select pm.code,pm.name,coalesce(pm.base_code,pm.code) as base_code,pm.preferred_financial_account_id
  into v_method
  from public.store_payment_methods pm
  where pm.store_id=p_store_id and pm.code=v_order.payment_method_code and pm.active=true
  limit 1;

  if v_method.code is null or v_method.base_code <> 'pix' then
    return jsonb_build_object('ok',false,'error','not_pix_order');
  end if;

  v_account_id := p_financial_account_id;
  if v_account_id is null then
    select a.id into v_account_id
    from public.store_financial_accounts a
    where a.store_id=p_store_id and a.active=true and a.id=v_method.preferred_financial_account_id
    limit 1;
  end if;

  if v_account_id is null then
    select a.id into v_account_id
    from public.store_financial_accounts a
    where a.store_id=p_store_id and a.active=true and a.is_sales_clearing_default=true
    order by a.sort_order,a.name
    limit 1;
  end if;

  if v_account_id is null then
    select a.id into v_account_id
    from public.store_financial_accounts a
    where a.store_id=p_store_id and a.active=true
      and (
        not exists(select 1 from public.store_financial_account_payment_methods ap0 where ap0.store_id=p_store_id and ap0.account_id=a.id and ap0.active=true)
        or exists(select 1 from public.store_financial_account_payment_methods ap where ap.store_id=p_store_id and ap.account_id=a.id and ap.active=true and ap.payment_method_code in (v_method.code,v_method.base_code))
      )
    order by a.sort_order,a.name
    limit 1;
  end if;

  if v_account_id is null then return jsonb_build_object('ok',false,'error','financial_account_required'); end if;

  select a.active into v_account_active
  from public.store_financial_accounts a
  where a.id=v_account_id and a.store_id=p_store_id;
  if not found then return jsonb_build_object('ok',false,'error','invalid_financial_account'); end if;
  if v_account_active is not true then return jsonb_build_object('ok',false,'error','financial_account_inactive'); end if;

  select exists(select 1 from public.store_financial_account_payment_methods ap where ap.store_id=p_store_id and ap.account_id=v_account_id and ap.active=true)
  into v_account_has_routes;
  if v_account_has_routes then
    select exists(select 1 from public.store_financial_account_payment_methods ap where ap.store_id=p_store_id and ap.account_id=v_account_id and ap.active=true and ap.payment_method_code in (v_method.code,v_method.base_code))
    into v_account_accepts;
    if not v_account_accepts then return jsonb_build_object('ok',false,'error','account_does_not_accept_pix'); end if;
  end if;

  select ce.id,ce.entry_code into v_existing_entry_id,v_existing_entry_code
  from public.cashbook_entries ce
  where ce.store_id=p_store_id and ce.order_id=v_order.id and ce.type='sale' and ce.direction='in'
    and ce.status='confirmed' and ce.affects_balance=true
  order by ce.created_at desc limit 1;

  if v_existing_entry_id is not null then
    return jsonb_build_object('ok',false,'error','financial_entry_already_exists','cashbook_entry_id',v_existing_entry_id,'cashbook_entry_code',v_existing_entry_code);
  end if;

  v_entry_code := public.generate_cashbook_entry_code();
  insert into public.cashbook_entries (
    store_id,entry_code,entry_date,occurred_at,type,direction,amount,description,notes,
    payment_method,payment_method_code,source,source_id,order_id,customer_id,status,affects_balance,
    metadata,created_by,destination_financial_account_id,is_transfer
  ) values (
    p_store_id,v_entry_code,current_date,now(),'sale','in',v_order.total,
    'Pagamento antecipado confirmado do pedido '||v_order.order_code,
    nullif(trim(coalesce(p_notes,'')),''),v_method.name,v_method.code,'order',v_order.id,v_order.id,v_order.customer_id,
    'confirmed',true,
    jsonb_build_object(
      'order_code',v_order.order_code,'customer_name',v_order.customer_name,
      'payment_confirmation_source','manual_proof_review','payment_proof_id',v_proof.id,
      'payment_proof_storage_path',v_proof.storage_path,'declared_amount',v_proof.declared_amount,
      'declared_paid_at',v_proof.declared_paid_at,'reviewed_by',auth.uid(),'reviewed_at',now(),
      'financial_account_id',v_account_id
    ),auth.uid(),v_account_id,false
  ) returning id into v_entry_id;

  update public.order_payment_proofs
  set status='confirmed',decided_at=now(),decided_by=auth.uid(),decision_source='manual_proof_review',
      decision_notes=nullif(trim(coalesce(p_notes,'')),''),cashbook_entry_id=v_entry_id,financial_account_id=v_account_id,updated_at=now()
  where id=v_proof.id;

  update public.order_payment_proofs
  set status='superseded',decision_source='payment_confirmed_with_other_proof',
      decision_notes='Outro comprovante deste pedido foi confirmado.',decided_at=now(),updated_at=now()
  where order_id=v_order.id and id<>v_proof.id and status='submitted';

  update public.orders
  set payment_status='paid',payment_method='pix'::public.payment_method,payment_method_code=v_method.code,
      proof_url='storage://'||v_proof.storage_bucket||'/'||v_proof.storage_path,
      payment_metadata=coalesce(payment_metadata,'{}'::jsonb)||jsonb_build_object(
        'paid_at',now(),'paid_by_source','manual_proof_review','confirmed_at',now(),'confirmed_by',auth.uid(),
        'payment_method_code',v_method.code,'payment_proof_id',v_proof.id,'proof_status','confirmed',
        'proof_reviewed_at',now(),'proof_reviewed_by',auth.uid(),'cashbook_entry_id',v_entry_id,'cashbook_entry_code',v_entry_code,
        'financial_account_id',v_account_id
      ),
      commercial_metadata=coalesce(commercial_metadata,'{}'::jsonb)||jsonb_build_object(
        'cashbook_entry_id',v_entry_id,'cashbook_entry_code',v_entry_code,'financial_posted',true,
        'payment_confirmation_source','manual_proof_review'
      )
  where id=v_order.id and store_id=p_store_id;

  return jsonb_build_object(
    'ok',true,'proof_id',v_proof.id,'status','confirmed','payment_status','paid',
    'cashbook_entry_id',v_entry_id,'cashbook_entry_code',v_entry_code,'financial_account_id',v_account_id,
    'payment_method_code',v_method.code,'payment_method_name',v_method.name,'amount',v_order.total
  );
end;
$$;

revoke all on function public.create_public_order_payment_proof_ticket(text,text,text,numeric,timestamptz) from public;
grant execute on function public.create_public_order_payment_proof_ticket(text,text,text,numeric,timestamptz) to anon, authenticated, service_role;
revoke all on function public.finalize_public_order_payment_proof(text,uuid) from public;
grant execute on function public.finalize_public_order_payment_proof(text,uuid) to anon, authenticated, service_role;
revoke all on function public.get_public_order_payment_proof_state(text) from public;
grant execute on function public.get_public_order_payment_proof_state(text) to anon, authenticated, service_role;
revoke all on function public.get_order_payment_proofs_safe(uuid,uuid) from public, anon;
grant execute on function public.get_order_payment_proofs_safe(uuid,uuid) to authenticated, service_role;
revoke all on function public.review_order_payment_proof_safe(uuid,uuid,text,uuid,text) from public, anon;
grant execute on function public.review_order_payment_proof_safe(uuid,uuid,text,uuid,text) to authenticated, service_role;
