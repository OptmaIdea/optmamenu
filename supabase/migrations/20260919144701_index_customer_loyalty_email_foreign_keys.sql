create index if not exists customer_email_verification_customer_id_idx
  on public.customer_email_verification_challenges(customer_id);

create index if not exists fidelity_membership_blocks_customer_id_idx
  on public.fidelity_membership_blocks(customer_id);

create index if not exists fidelity_membership_blocks_blocked_by_idx
  on public.fidelity_membership_blocks(blocked_by);

create index if not exists fidelity_membership_blocks_unblocked_by_idx
  on public.fidelity_membership_blocks(unblocked_by);
