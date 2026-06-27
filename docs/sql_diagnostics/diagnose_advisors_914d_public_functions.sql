-- Fase 9.14D — Diagnóstico de funções públicas intencionais
--
-- Rode no SQL Editor do Supabase.
-- Este arquivo NÃO altera dados.
--
-- Objetivo:
-- Auditar as funções que permanecem com anon por design para loja pública,
-- pedido público, OTP/login de cliente e consultas públicas por slug.

with target_functions(function_name) as (
    values
      ('cancel_reserved_public_order'),
      ('create_public_order_by_slug'),
      ('customer_login_with_password'),
      ('get_public_catalog_by_slug'),
      ('get_public_customer_loyalty_by_phone'),
      ('get_public_delivery_methods_by_slug'),
      ('get_public_payment_methods_by_slug'),
      ('get_public_sales_channels_by_slug'),
      ('get_public_storefront_by_slug'),
      ('get_store_by_slug'),
      ('send_customer_otp'),
      ('verify_customer_otp')
), classified as (
    select
      function_name,
      case
        when function_name in ('create_public_order_by_slug', 'cancel_reserved_public_order') then 'public_order_flow'
        when function_name in (
          'get_store_by_slug',
          'get_public_storefront_by_slug',
          'get_public_catalog_by_slug',
          'get_public_delivery_methods_by_slug',
          'get_public_payment_methods_by_slug',
          'get_public_sales_channels_by_slug'
        ) then 'public_storefront_catalog'
        when function_name in (
          'get_public_customer_loyalty_by_phone',
          'send_customer_otp',
          'verify_customer_otp',
          'customer_login_with_password'
        ) then 'public_customer_auth_loyalty'
        else 'public_review'
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
    c.proposed_classification,
    case
      when p.proname in ('send_customer_otp', 'verify_customer_otp', 'customer_login_with_password')
        then 'auditar normalizacao de telefone, mensagens de erro, tentativas repetidas e escopo por loja'
      when p.proname = 'get_public_customer_loyalty_by_phone'
        then 'auditar se retorno expõe dados de cliente alem do necessario e se exige validacao suficiente'
      when p.proname in ('get_store_by_slug', 'get_public_storefront_by_slug', 'get_public_catalog_by_slug')
        then 'auditar se loja precisa estar publica/ativa e se payload nao inclui dados administrativos'
      when p.proname in ('get_public_delivery_methods_by_slug', 'get_public_payment_methods_by_slug', 'get_public_sales_channels_by_slug')
        then 'auditar se retorno contem somente opcoes publicas ativas'
      when p.proname in ('create_public_order_by_slug', 'cancel_reserved_public_order')
        then 'auditar validacao de itens, loja publica, estoque/reserva, telefone e abuso de criacao/cancelamento'
      else 'auditar excecao publica intencional'
    end as audit_focus,
    pg_get_functiondef(p.oid) as function_definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_language l on l.oid = p.prolang
join classified c on c.function_name = p.proname
where n.nspname = 'public'
order by c.proposed_classification, p.proname, pg_get_function_identity_arguments(p.oid);
