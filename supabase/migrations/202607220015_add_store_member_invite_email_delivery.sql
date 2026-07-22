alter table public.store_member_invites
  add column if not exists email_status text not null default 'pending',
  add column if not exists email_sent_at timestamptz,
  add column if not exists email_error text,
  add column if not exists email_attempts integer not null default 0,
  add column if not exists auth_user_id uuid,
  add column if not exists email_mode text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'store_member_invites_email_status_check'
      and conrelid = 'public.store_member_invites'::regclass
  ) then
    alter table public.store_member_invites
      add constraint store_member_invites_email_status_check
      check (email_status in ('pending', 'sending', 'sent', 'failed', 'not_required'));
  end if;
end $$;

create index if not exists idx_store_member_invites_email_delivery
  on public.store_member_invites (store_id, email_status, invited_at desc);

comment on column public.store_member_invites.email_status is
  'Estado técnico do envio do convite por e-mail.';
comment on column public.store_member_invites.email_mode is
  'invite para usuário novo ou magic_link para usuário já cadastrado.';
