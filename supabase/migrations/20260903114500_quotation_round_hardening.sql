create index if not exists purchase_quotation_rounds_created_by_idx
  on public.purchase_quotation_rounds (created_by)
  where created_by is not null;

create index if not exists purchase_quotation_rounds_generated_by_idx
  on public.purchase_quotation_rounds (generated_by)
  where generated_by is not null;

alter function public.get_purchase_quotation_rounds_by_store(uuid, integer)
  security invoker;

notify pgrst, 'reload schema';
