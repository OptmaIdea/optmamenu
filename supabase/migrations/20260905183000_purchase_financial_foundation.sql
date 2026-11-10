-- Bloco 1 — Fundação financeira de Compras e Contas a Pagar
-- Estrutura, segurança, condições de pagamento e contratos de compra/cotação.

create or replace function public._purchase_term_offsets_valid(p_offsets integer[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_offsets is not null
    and cardinality(p_offsets) > 0
    and not exists (
      select 1
      from unnest(p_offsets) with ordinality as x(value, ord)
      where value < 0
         or (ord > 1 and value <= p_offsets[ord - 1])
    );
$$;
revoke all on function public._purchase_term_offsets_valid(integer[]) from public, anon, authenticated;

create table if not exists public.purchase_payment_terms (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  code text not null,
  name text not null,
  payment_mode text not null check (payment_mode in ('cash','term')),
  installment_count integer not null check (installment_count > 0 and installment_count <= 60),
  offset_days integer[] not null,
  payment_method_code text null,
  active boolean not null default true,
  is_default boolean not null default false,
  is_system_preset boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchase_payment_terms_code_nonblank check (btrim(code) <> ''),
  constraint purchase_payment_terms_name_nonblank check (btrim(name) <> ''),
  constraint purchase_payment_terms_offsets_count check (cardinality(offset_days) = installment_count),
  constraint purchase_payment_terms_offsets_valid check (public._purchase_term_offsets_valid(offset_days)),
  constraint purchase_payment_terms_cash_shape check (payment_mode <> 'cash' or (installment_count = 1 and offset_days = array[0]::integer[])),
  constraint purchase_payment_terms_store_code_unique unique (store_id, code),
  constraint purchase_payment_terms_store_id_unique unique (store_id, id)
);
create unique index if not exists purchase_payment_terms_one_default_per_store on public.purchase_payment_terms(store_id) where is_default and active;
create index if not exists purchase_payment_terms_store_active_idx on public.purchase_payment_terms(store_id, active, name);

insert into public.purchase_payment_terms
  (store_id, code, name, payment_mode, installment_count, offset_days, is_default, is_system_preset, metadata)
select s.id, preset.code, preset.name, preset.payment_mode, cardinality(preset.offsets), preset.offsets,
       preset.code = 'cash', true, jsonb_build_object('seed','block_1_financial_foundation')
from public.stores s
cross join (
  values
    ('cash'::text, 'À vista'::text, 'cash'::text, array[0]::integer[]),
    ('d7', '7 dias', 'term', array[7]::integer[]),
    ('d15', '15 dias', 'term', array[15]::integer[]),
    ('d30', '30 dias', 'term', array[30]::integer[]),
    ('d45', '45 dias', 'term', array[45]::integer[]),
    ('d30_60', '30/60', 'term', array[30,60]::integer[]),
    ('d30_60_90', '30/60/90', 'term', array[30,60,90]::integer[])
) as preset(code, name, payment_mode, offsets)
on conflict (store_id, code) do nothing;

create unique index if not exists suppliers_id_store_unique on public.suppliers(id, store_id);
create unique index if not exists purchase_documents_id_store_unique on public.purchase_documents(id, store_id);
create unique index if not exists purchase_quotations_id_store_unique on public.purchase_quotations(id, store_id);
create unique index if not exists store_financial_accounts_id_store_unique on public.store_financial_accounts(id, store_id);
create unique index if not exists purchase_receipt_issues_id_store_unique on public.purchase_receipt_issues(id, store_id);

alter table public.suppliers add column if not exists preferred_purchase_payment_term_id uuid null;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='suppliers_preferred_purchase_payment_term_store_fkey') then
    alter table public.suppliers add constraint suppliers_preferred_purchase_payment_term_store_fkey
      foreign key (store_id, preferred_purchase_payment_term_id) references public.purchase_payment_terms(store_id,id);
  end if;
end $$;

alter table public.purchase_quotations
  add column if not exists suggested_payment_term_id uuid null,
  add column if not exists suggested_payment_term_snapshot jsonb null,
  add column if not exists payment_term_suggestion_source text null,
  add column if not exists sent_payment_term_id uuid null,
  add column if not exists sent_payment_term_snapshot jsonb null,
  add column if not exists sent_payment_method_code text null,
  add column if not exists supplier_payment_term_id uuid null,
  add column if not exists supplier_payment_term_snapshot jsonb null,
  add column if not exists supplier_payment_method_code text null,
  add column if not exists supplier_payment_notes text null,
  add column if not exists accepted_payment_term_id uuid null,
  add column if not exists accepted_payment_term_snapshot jsonb null,
  add column if not exists accepted_payment_method_code text null;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='purchase_quotations_suggested_term_store_fkey') then alter table public.purchase_quotations add constraint purchase_quotations_suggested_term_store_fkey foreign key (store_id,suggested_payment_term_id) references public.purchase_payment_terms(store_id,id); end if;
  if not exists (select 1 from pg_constraint where conname='purchase_quotations_sent_term_store_fkey') then alter table public.purchase_quotations add constraint purchase_quotations_sent_term_store_fkey foreign key (store_id,sent_payment_term_id) references public.purchase_payment_terms(store_id,id); end if;
  if not exists (select 1 from pg_constraint where conname='purchase_quotations_supplier_term_store_fkey') then alter table public.purchase_quotations add constraint purchase_quotations_supplier_term_store_fkey foreign key (store_id,supplier_payment_term_id) references public.purchase_payment_terms(store_id,id); end if;
  if not exists (select 1 from pg_constraint where conname='purchase_quotations_accepted_term_store_fkey') then alter table public.purchase_quotations add constraint purchase_quotations_accepted_term_store_fkey foreign key (store_id,accepted_payment_term_id) references public.purchase_payment_terms(store_id,id); end if;
end $$;
alter table public.purchase_quotations drop constraint if exists purchase_quotations_payment_term_suggestion_source_check;
alter table public.purchase_quotations add constraint purchase_quotations_payment_term_suggestion_source_check check (payment_term_suggestion_source is null or payment_term_suggestion_source in ('recent_purchase','supplier_default','historical_pattern','store_default','manual'));

alter table public.purchase_documents
  add column if not exists source_quotation_id uuid null,
  add column if not exists commercial_status text not null default 'draft',
  add column if not exists physical_status text not null default 'not_received',
  add column if not exists financial_status text not null default 'not_defined',
  add column if not exists payment_term_id uuid null,
  add column if not exists payment_term_snapshot jsonb null,
  add column if not exists payment_term_source text null,
  add column if not exists payment_mode text null,
  add column if not exists payment_method_code text null,
  add column if not exists preferred_financial_account_id uuid null,
  add column if not exists financial_gross_amount numeric(14,2) null,
  add column if not exists financial_adjustment_amount numeric(14,2) null,
  add column if not exists financial_net_amount numeric(14,2) null,
  add column if not exists financial_notes text null;
alter table public.purchase_documents drop constraint if exists purchase_documents_commercial_status_check;
alter table public.purchase_documents add constraint purchase_documents_commercial_status_check check (commercial_status in ('draft','committed','cancelled'));
alter table public.purchase_documents drop constraint if exists purchase_documents_physical_status_check;
alter table public.purchase_documents add constraint purchase_documents_physical_status_check check (physical_status in ('not_received','partial','received','cancelled'));
alter table public.purchase_documents drop constraint if exists purchase_documents_financial_status_check;
alter table public.purchase_documents add constraint purchase_documents_financial_status_check check (financial_status in ('not_defined','draft','open','partially_paid','paid','cancelled'));
alter table public.purchase_documents drop constraint if exists purchase_documents_payment_mode_check;
alter table public.purchase_documents add constraint purchase_documents_payment_mode_check check (payment_mode is null or payment_mode in ('cash','term'));
alter table public.purchase_documents drop constraint if exists purchase_documents_payment_term_source_check;
alter table public.purchase_documents add constraint purchase_documents_payment_term_source_check check (payment_term_source is null or payment_term_source in ('quotation','supplier_response','supplier_default','recent_purchase','store_default','manual','legacy'));
do $$ begin
  if not exists (select 1 from pg_constraint where conname='purchase_documents_source_quotation_store_fkey') then alter table public.purchase_documents add constraint purchase_documents_source_quotation_store_fkey foreign key (store_id,source_quotation_id) references public.purchase_quotations(store_id,id); end if;
  if not exists (select 1 from pg_constraint where conname='purchase_documents_payment_term_store_fkey') then alter table public.purchase_documents add constraint purchase_documents_payment_term_store_fkey foreign key (store_id,payment_term_id) references public.purchase_payment_terms(store_id,id); end if;
  if not exists (select 1 from pg_constraint where conname='purchase_documents_preferred_account_store_fkey') then alter table public.purchase_documents add constraint purchase_documents_preferred_account_store_fkey foreign key (store_id,preferred_financial_account_id) references public.store_financial_accounts(store_id,id); end if;
end $$;
update public.purchase_documents set
  commercial_status=case when status in ('cancelled','canceled') then 'cancelled' when status in ('partially_received','confirmed') then 'committed' else 'draft' end,
  physical_status=case when status in ('cancelled','canceled') then 'cancelled' when status='partially_received' then 'partial' when status='confirmed' then 'received' else 'not_received' end;

create table if not exists public.accounts_payable (
  id uuid primary key default gen_random_uuid(),
  payable_code text not null,
  store_id uuid not null,
  supplier_id uuid not null,
  purchase_document_id uuid not null,
  document_number text null,
  description text not null,
  original_amount numeric(14,2) not null check (original_amount >= 0),
  net_amount numeric(14,2) not null check (net_amount >= 0),
  paid_amount numeric(14,2) not null default 0 check (paid_amount >= 0),
  adjustment_amount numeric(14,2) generated always as (net_amount-original_amount) stored,
  open_amount numeric(14,2) generated always as (greatest(net_amount-paid_amount,0::numeric)) stored,
  status text not null default 'draft' check (status in ('draft','open','partially_paid','paid','cancelled')),
  payment_term_id uuid not null,
  payment_term_snapshot jsonb not null,
  payment_method_code text null,
  preferred_financial_account_id uuid null,
  issue_date date not null default current_date,
  notes text null,
  created_by uuid null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_by uuid null,
  cancelled_at timestamptz null,
  cancellation_reason text null,
  constraint accounts_payable_store_purchase_unique unique (store_id,purchase_document_id),
  constraint accounts_payable_store_code_unique unique (store_id,payable_code),
  constraint accounts_payable_store_id_unique unique (store_id,id),
  constraint accounts_payable_purchase_store_fkey foreign key (store_id,purchase_document_id) references public.purchase_documents(store_id,id),
  constraint accounts_payable_supplier_store_fkey foreign key (store_id,supplier_id) references public.suppliers(store_id,id),
  constraint accounts_payable_term_store_fkey foreign key (store_id,payment_term_id) references public.purchase_payment_terms(store_id,id),
  constraint accounts_payable_preferred_account_store_fkey foreign key (store_id,preferred_financial_account_id) references public.store_financial_accounts(store_id,id)
);

create table if not exists public.accounts_payable_installments (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  accounts_payable_id uuid not null,
  installment_number integer not null check (installment_number>0),
  due_date date not null,
  original_amount numeric(14,2) not null check (original_amount>=0),
  net_amount numeric(14,2) not null check (net_amount>=0),
  paid_amount numeric(14,2) not null default 0 check (paid_amount>=0),
  adjustment_amount numeric(14,2) generated always as (net_amount-original_amount) stored,
  open_amount numeric(14,2) generated always as (greatest(net_amount-paid_amount,0::numeric)) stored,
  status text not null default 'pending' check (status in ('pending','partially_paid','paid','cancelled')),
  payment_method_code text null,
  preferred_financial_account_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accounts_payable_installments_unique_number unique (accounts_payable_id,installment_number),
  constraint accounts_payable_installments_store_id_unique unique (store_id,id),
  constraint accounts_payable_installments_payable_store_fkey foreign key (store_id,accounts_payable_id) references public.accounts_payable(store_id,id) on delete cascade,
  constraint accounts_payable_installments_account_store_fkey foreign key (store_id,preferred_financial_account_id) references public.store_financial_accounts(store_id,id)
);

create table if not exists public.accounts_payable_adjustments (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  accounts_payable_id uuid not null,
  installment_id uuid null,
  purchase_receipt_issue_id uuid null,
  adjustment_type text not null check (adjustment_type in ('discount','supplier_credit','return','correction','other')),
  direction text not null check (direction in ('increase','decrease')),
  amount numeric(14,2) not null check (amount>0),
  status text not null default 'active' check (status in ('active','reversed')),
  notes text null,
  created_by uuid null default auth.uid(),
  created_at timestamptz not null default now(),
  reversed_by uuid null,
  reversed_at timestamptz null,
  reversal_reason text null,
  constraint accounts_payable_adjustments_payable_store_fkey foreign key (store_id,accounts_payable_id) references public.accounts_payable(store_id,id) on delete cascade,
  constraint accounts_payable_adjustments_installment_store_fkey foreign key (store_id,installment_id) references public.accounts_payable_installments(store_id,id),
  constraint accounts_payable_adjustments_issue_store_fkey foreign key (store_id,purchase_receipt_issue_id) references public.purchase_receipt_issues(store_id,id)
);
create unique index if not exists accounts_payable_adjustments_one_active_per_issue on public.accounts_payable_adjustments(purchase_receipt_issue_id) where purchase_receipt_issue_id is not null and status='active';

create table if not exists public.accounts_payable_payments (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  accounts_payable_id uuid not null,
  installment_id uuid not null,
  amount numeric(14,2) not null check (amount>0),
  paid_at timestamptz not null default now(),
  financial_account_id uuid not null,
  payment_method_code text not null,
  reference text null,
  notes text null,
  cashbook_entry_id uuid null references public.cashbook_entries(id),
  status text not null default 'confirmed' check (status in ('confirmed','reversed')),
  created_by uuid null default auth.uid(),
  created_at timestamptz not null default now(),
  reversed_by uuid null,
  reversed_at timestamptz null,
  reversal_reason text null,
  reversal_cashbook_entry_id uuid null references public.cashbook_entries(id),
  constraint accounts_payable_payments_payable_store_fkey foreign key (store_id,accounts_payable_id) references public.accounts_payable(store_id,id) on delete cascade,
  constraint accounts_payable_payments_installment_store_fkey foreign key (store_id,installment_id) references public.accounts_payable_installments(store_id,id),
  constraint accounts_payable_payments_account_store_fkey foreign key (store_id,financial_account_id) references public.store_financial_accounts(store_id,id)
);

create table if not exists public.accounts_payable_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  accounts_payable_id uuid not null,
  event_type text not null,
  title text not null,
  description text null,
  old_data jsonb null,
  new_data jsonb null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint accounts_payable_events_payable_store_fkey foreign key (store_id,accounts_payable_id) references public.accounts_payable(store_id,id) on delete cascade
);

create index if not exists suppliers_preferred_purchase_payment_term_idx on public.suppliers(preferred_purchase_payment_term_id) where preferred_purchase_payment_term_id is not null;
create index if not exists purchase_documents_source_quotation_idx on public.purchase_documents(source_quotation_id) where source_quotation_id is not null;
create index if not exists purchase_documents_payment_term_idx on public.purchase_documents(payment_term_id) where payment_term_id is not null;
create index if not exists purchase_documents_preferred_financial_account_idx on public.purchase_documents(preferred_financial_account_id) where preferred_financial_account_id is not null;
create index if not exists purchase_quotations_suggested_payment_term_idx on public.purchase_quotations(suggested_payment_term_id) where suggested_payment_term_id is not null;
create index if not exists purchase_quotations_sent_payment_term_idx on public.purchase_quotations(sent_payment_term_id) where sent_payment_term_id is not null;
create index if not exists purchase_quotations_supplier_payment_term_idx on public.purchase_quotations(supplier_payment_term_id) where supplier_payment_term_id is not null;
create index if not exists purchase_quotations_accepted_payment_term_idx on public.purchase_quotations(accepted_payment_term_id) where accepted_payment_term_id is not null;
create index if not exists accounts_payable_store_status_due_idx on public.accounts_payable(store_id,status,issue_date);
create index if not exists accounts_payable_supplier_status_idx on public.accounts_payable(store_id,supplier_id,status);
create index if not exists accounts_payable_purchase_document_idx on public.accounts_payable(purchase_document_id);
create index if not exists accounts_payable_payment_term_idx on public.accounts_payable(payment_term_id);
create index if not exists accounts_payable_preferred_financial_account_idx on public.accounts_payable(preferred_financial_account_id) where preferred_financial_account_id is not null;
create index if not exists accounts_payable_installments_due_idx on public.accounts_payable_installments(store_id,due_date,status);
create index if not exists accounts_payable_installments_payable_idx on public.accounts_payable_installments(accounts_payable_id);
create index if not exists accounts_payable_installments_preferred_financial_account_idx on public.accounts_payable_installments(preferred_financial_account_id) where preferred_financial_account_id is not null;
create index if not exists accounts_payable_adjustments_payable_idx on public.accounts_payable_adjustments(accounts_payable_id,status);
create index if not exists accounts_payable_adjustments_installment_idx on public.accounts_payable_adjustments(installment_id) where installment_id is not null;
create index if not exists accounts_payable_adjustments_issue_idx on public.accounts_payable_adjustments(purchase_receipt_issue_id) where purchase_receipt_issue_id is not null;
create index if not exists accounts_payable_payments_payable_idx on public.accounts_payable_payments(accounts_payable_id,status);
create index if not exists accounts_payable_payments_installment_idx on public.accounts_payable_payments(installment_id,status);
create index if not exists accounts_payable_payments_account_idx on public.accounts_payable_payments(store_id,financial_account_id,paid_at);
create index if not exists accounts_payable_payments_cashbook_entry_idx on public.accounts_payable_payments(cashbook_entry_id) where cashbook_entry_id is not null;
create index if not exists accounts_payable_payments_reversal_cashbook_entry_idx on public.accounts_payable_payments(reversal_cashbook_entry_id) where reversal_cashbook_entry_id is not null;
create index if not exists accounts_payable_events_payable_time_idx on public.accounts_payable_events(accounts_payable_id,created_at desc);

alter table public.purchase_payment_terms enable row level security;
alter table public.accounts_payable enable row level security;
alter table public.accounts_payable_installments enable row level security;
alter table public.accounts_payable_adjustments enable row level security;
alter table public.accounts_payable_payments enable row level security;
alter table public.accounts_payable_events enable row level security;

drop policy if exists purchase_payment_terms_select_safe on public.purchase_payment_terms;
create policy purchase_payment_terms_select_safe on public.purchase_payment_terms for select to authenticated using (public.app_is_store_owner(store_id) or public.user_has_store_permission(store_id,'accounts_payable.view') or public.user_has_store_permission(store_id,'accounts_payable.manage') or public.user_has_store_permission(store_id,'purchases.view') or public.user_has_store_permission(store_id,'purchases.create') or public.user_has_store_permission(store_id,'quotes.view') or public.user_has_store_permission(store_id,'quotes.manage'));
drop policy if exists accounts_payable_select_safe on public.accounts_payable;
create policy accounts_payable_select_safe on public.accounts_payable for select to authenticated using (public.app_is_store_owner(store_id) or public.user_has_store_permission(store_id,'accounts_payable.view') or public.user_has_store_permission(store_id,'accounts_payable.manage') or public.user_has_store_permission(store_id,'accounts_payable.pay') or public.user_has_store_permission(store_id,'accounts_payable.reverse_payment'));
drop policy if exists accounts_payable_installments_select_safe on public.accounts_payable_installments;
create policy accounts_payable_installments_select_safe on public.accounts_payable_installments for select to authenticated using (public.app_is_store_owner(store_id) or public.user_has_store_permission(store_id,'accounts_payable.view') or public.user_has_store_permission(store_id,'accounts_payable.manage') or public.user_has_store_permission(store_id,'accounts_payable.pay') or public.user_has_store_permission(store_id,'accounts_payable.reverse_payment'));
drop policy if exists accounts_payable_adjustments_select_safe on public.accounts_payable_adjustments;
create policy accounts_payable_adjustments_select_safe on public.accounts_payable_adjustments for select to authenticated using (public.app_is_store_owner(store_id) or public.user_has_store_permission(store_id,'accounts_payable.view') or public.user_has_store_permission(store_id,'accounts_payable.manage'));
drop policy if exists accounts_payable_payments_select_safe on public.accounts_payable_payments;
create policy accounts_payable_payments_select_safe on public.accounts_payable_payments for select to authenticated using (public.app_is_store_owner(store_id) or public.user_has_store_permission(store_id,'accounts_payable.view') or public.user_has_store_permission(store_id,'accounts_payable.manage') or public.user_has_store_permission(store_id,'accounts_payable.pay') or public.user_has_store_permission(store_id,'accounts_payable.reverse_payment'));
drop policy if exists accounts_payable_events_select_safe on public.accounts_payable_events;
create policy accounts_payable_events_select_safe on public.accounts_payable_events for select to authenticated using (public.app_is_store_owner(store_id) or public.user_has_store_permission(store_id,'accounts_payable.view') or public.user_has_store_permission(store_id,'accounts_payable.manage') or public.user_has_store_permission(store_id,'accounts_payable.pay') or public.user_has_store_permission(store_id,'accounts_payable.reverse_payment'));

revoke all on public.purchase_payment_terms,public.accounts_payable,public.accounts_payable_installments,public.accounts_payable_adjustments,public.accounts_payable_payments,public.accounts_payable_events from anon;
revoke insert,update,delete on public.purchase_payment_terms,public.accounts_payable,public.accounts_payable_installments,public.accounts_payable_adjustments,public.accounts_payable_payments,public.accounts_payable_events from authenticated;
grant select on public.purchase_payment_terms,public.accounts_payable,public.accounts_payable_installments,public.accounts_payable_adjustments,public.accounts_payable_payments,public.accounts_payable_events to authenticated;

select public.register_store_permission_v3('accounts_payable.view','financial','Ver contas a pagar','Permite visualizar obrigações, parcelas, vencimentos, ajustes e pagamentos de fornecedores.','medium','Operacional','financial','Financeiro','accounts_payable','Contas a Pagar','view','Ver','financial.view','financial.view','{"owner":true,"admin":true,"manager":true,"cashier":false,"viewer":false}'::jsonb,3530,true);
select public.register_store_permission_v3('accounts_payable.manage','financial','Gerenciar contas a pagar','Permite definir condições, gerar parcelas, aplicar ajustes e cancelar obrigações ainda não liquidadas.','high','Operacional','financial','Financeiro','accounts_payable','Contas a Pagar','manage','Gerenciar','accounts_payable.view','accounts_payable.view','{"owner":true,"admin":true,"manager":true,"cashier":false,"viewer":false}'::jsonb,3531,true);
select public.register_store_permission_v3('accounts_payable.pay','financial','Baixar contas a pagar','Permite registrar pagamentos efetivos e movimentar a conta financeira escolhida.','high','Operacional','financial','Financeiro','accounts_payable','Contas a Pagar','pay','Pagar','accounts_payable.view','accounts_payable.view','{"owner":true,"admin":true,"manager":false,"cashier":false,"viewer":false}'::jsonb,3532,true);
select public.register_store_permission_v3('accounts_payable.reverse_payment','financial','Estornar pagamentos de contas a pagar','Permite estornar baixas financeiras preservando o histórico e gerando movimento financeiro inverso.','critical','Operacional','financial','Financeiro','accounts_payable','Contas a Pagar','reverse_payment','Estornar pagamento','accounts_payable.pay','accounts_payable.view','{"owner":true,"admin":true,"manager":false,"cashier":false,"viewer":false}'::jsonb,3533,true);
do $$ declare v_store record; begin if to_regprocedure('public.touch_store_permission_version(uuid,text)') is not null then for v_store in select id from public.stores loop perform public.touch_store_permission_version(v_store.id,'accounts_payable_permissions_registered'); end loop; end if; end $$;

comment on table public.accounts_payable is 'Obrigação financeira de uma compra. Criar a obrigação não movimenta saldo; a saída ocorre somente em accounts_payable_payments.';
comment on table public.accounts_payable_installments is 'Parcelas e vencimentos de uma obrigação financeira de fornecedor.';
comment on table public.accounts_payable_adjustments is 'Ajustes auditáveis sem sobrescrever o valor original.';
