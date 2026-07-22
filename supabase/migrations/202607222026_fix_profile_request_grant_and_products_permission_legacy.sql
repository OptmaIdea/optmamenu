grant execute on function public.create_my_profile_change_request_v2(uuid, text, jsonb, text, boolean, jsonb) to authenticated;

update public.store_members
set permissions = (coalesce(permissions, '{}'::jsonb) - 'products.view') || jsonb_build_object('products.manage', true),
    updated_at = now()
where coalesce(permissions, '{}'::jsonb) ->> 'products.view' = 'true';

update public.store_permission_catalog
set show_in_permission_ui = false,
    updated_at = now()
where permission_key = 'products.view';

notify pgrst, 'reload schema';
