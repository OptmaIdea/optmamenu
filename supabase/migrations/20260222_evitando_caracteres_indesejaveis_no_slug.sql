alter table public.stores
  add constraint stores_slug_format_check
  check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');