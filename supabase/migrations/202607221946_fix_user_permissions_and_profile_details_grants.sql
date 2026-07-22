-- Corrige permissões de execução para RPCs usadas na gestão de usuários e permissões.

grant execute on function public.update_store_member_profile_details(
  uuid, text, text, text, text, text, date, text, text, text, text,
  text, text, text, text, text, text, text, text, text, text, text
) to authenticated;

grant execute on function public.get_effective_store_member_permissions_v2(uuid, uuid)
  to authenticated;

grant execute on function public.get_store_permission_catalog()
  to authenticated;

grant execute on function public.get_store_permission_matrix(uuid)
  to authenticated;

select pg_notify('pgrst', 'reload schema');
