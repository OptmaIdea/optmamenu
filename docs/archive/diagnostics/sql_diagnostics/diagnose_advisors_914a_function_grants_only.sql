-- Fase 9.14A — Diagnóstico separado: grants de funções
--
-- Rode no SQL Editor do Supabase.
-- Este arquivo NÃO altera dados.
--
-- Objetivo: obter apenas a matriz de EXECUTE por role para funções apontadas no Advisor.

with target_functions(function_name) as (
    values
      ('can_access_security_section'),
      ('can_access_security_section_v3'),
      ('can_access_settings_section'),
      ('can_access_settings_section_v3'),
      ('cancel_reserved_public_order'),
      ('create_public_order_by_slug'),
      ('customer_login_with_password'),
      ('get_default_admin_landing_path_v3'),
      ('get_effective_store_member_permissions_v2'),
      ('get_login_store_options'),
      ('get_my_visible_activity_logs'),
      ('get_public_catalog_by_slug'),
      ('get_public_customer_loyalty_by_phone'),
      ('get_public_delivery_methods_by_slug'),
      ('get_public_payment_methods_by_slug'),
      ('get_public_sales_channels_by_slug'),
      ('get_public_storefront_by_slug'),
      ('get_store_by_slug'),
      ('get_store_permission_catalog'),
      ('get_store_permission_matrix'),
      ('get_store_permission_matrix_v3'),
      ('get_store_security_activity_logs'),
      ('get_store_security_settings'),
      ('get_store_settings_center'),
      ('register_store_permission_v3'),
      ('seed_store_role_permissions_for_new_store_v3'),
      ('send_customer_otp'),
      ('set_store_role_permission_v3'),
      ('set_store_role_permissions_bulk_v3'),
      ('sync_permission_catalog_v3'),
      ('touch_store_permission_version'),
      ('trg_touch_store_permission_version'),
      ('update_security_log_member_visibility'),
      ('update_store_identity_settings'),
      ('update_store_idle_timeout_settings'),
      ('update_store_member_permissions'),
      ('update_store_role_permission_template'),
      ('update_store_settings_section'),
      ('validate_store_slug')
), classified as (
    select
      function_name,
      case
        when function_name in (
          'get_store_by_slug',
          'get_public_storefront_by_slug',
          'get_public_catalog_by_slug',
          'get_public_delivery_methods_by_slug',
          'get_public_payment_methods_by_slug',
          'get_public_sales_channels_by_slug',
          'get_public_customer_loyalty_by_phone',
          'create_public_order_by_slug',
          'cancel_reserved_public_order',
          'send_customer_otp',
          'customer_login_with_password'
        ) then 'public_intentional_review'
        when function_name in (
          'register_store_permission_v3',
          'seed_store_role_permissions_for_new_store_v3',
          'sync_permission_catalog_v3',
          'touch_store_permission_version',
          'trg_touch_store_permission_version',
          'set_store_role_permission_v3',
          'set_store_role_permissions_bulk_v3'
        ) then 'internal_or_admin_only'
        when function_name in ('validate_store_slug') then 'depends_on_usage'
        else 'authenticated_only_candidate'
      end as proposed_classification
    from target_functions
)
select
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as identity_arguments,
    pg_get_function_result(p.oid) as result_type,
    l.lanname as language,
    p.prosecdef as security_definer,
    has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
    has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
    has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_can_execute,
    c.proposed_classification
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_language l on l.oid = p.prolang
join classified c on c.function_name = p.proname
where n.nspname = 'public'
order by c.proposed_classification, p.proname, pg_get_function_identity_arguments(p.oid);
