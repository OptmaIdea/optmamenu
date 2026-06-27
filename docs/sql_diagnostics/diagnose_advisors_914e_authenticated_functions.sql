-- Fase 9.14E — Diagnóstico de funções SECURITY DEFINER autenticadas
--
-- Rode no SQL Editor do Supabase.
-- Este arquivo NÃO altera dados.
--
-- Objetivo:
-- Listar funções SECURITY DEFINER executáveis por authenticated,
-- classificar preliminarmente por módulo/risco e trazer definição SQL
-- para auditoria antes de qualquer migration corretiva.
--
-- Observação:
-- O resultado pode ser grande. Se necessário, filtre por proposed_group
-- nas rodadas seguintes.

with functions_base as (
    select
        n.nspname as schema_name,
        p.oid,
        p.proname as function_name,
        pg_get_function_identity_arguments(p.oid) as identity_arguments,
        pg_get_function_result(p.oid) as result_type,
        l.lanname as language,
        p.prosecdef as security_definer,
        has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
        has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
        has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_can_execute
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_language l on l.oid = p.prolang
    where n.nspname = 'public'
      and p.prosecdef = true
      and has_function_privilege('authenticated', p.oid, 'EXECUTE') = true
), classified as (
    select
        fb.*,
        case
          when function_name like 'trg_%'
            or function_name like 'touch_%'
            or function_name like 'sync_%'
            or function_name like 'seed_%'
            or function_name like 'register_%'
            or function_name like 'set_store_role_permission%'
            then 'internal_technical_candidate'

          when function_name like '%permission%'
            or function_name like 'can_access_%'
            or function_name like 'can_manage_%'
            or function_name like '%security%'
            or function_name like '%member%'
            or function_name like '%invite%'
            or function_name like '%profile%'
            then 'users_security_permissions'

          when function_name like '%stock%'
            or function_name like '%inventory%'
            or function_name like '%transfer%'
            or function_name like '%reservation%'
            then 'inventory_stock_transfer'

          when function_name like '%purchase%'
            or function_name like '%quotation%'
            or function_name like '%supplier%'
            then 'purchases_suppliers_quotations'

          when function_name like '%order%'
            or function_name like '%sale%'
            or function_name like '%customer%'
            or function_name like '%loyalty%'
            or function_name like '%fidelity%'
            then 'commercial_orders_customers_loyalty'

          when function_name like '%setting%'
            or function_name like '%store_%identity%'
            or function_name like '%idle_timeout%'
            or function_name like '%landing_path%'
            then 'settings_configuration'

          else 'uncategorized_review'
        end as proposed_group,
        case
          when function_name like 'trg_%'
            then 'verificar se é trigger e remover authenticated se não houver chamada direta pelo frontend'
          when function_name like 'touch_%'
            or function_name like 'sync_%'
            or function_name like 'seed_%'
            or function_name like 'register_%'
            then 'função técnica: confirmar dependências e considerar revogar authenticated'
          when function_name like '%permission%'
            or function_name like 'can_access_%'
            or function_name like 'can_manage_%'
            then 'auditar auth.uid, store_id, vínculo e permissões granulares'
          when function_name like '%stock%'
            or function_name like '%inventory%'
            or function_name like '%transfer%'
            then 'auditar escopo de loja/local, vínculo e permissão operacional'
          when function_name like '%purchase%'
            or function_name like '%quotation%'
            or function_name like '%supplier%'
            then 'auditar store_id, status, permissão de compras/fornecedores e efeitos colaterais'
          when function_name like '%order%'
            or function_name like '%customer%'
            or function_name like '%loyalty%'
            then 'auditar dados sensíveis de cliente, escopo de loja e permissões comerciais'
          when function_name like '%setting%'
            then 'auditar settings.view/manage e seções permitidas'
          else 'auditoria manual necessária'
        end as audit_focus
    from functions_base fb
)
select
    schema_name,
    function_name,
    identity_arguments,
    result_type,
    language,
    security_definer,
    anon_can_execute,
    authenticated_can_execute,
    service_role_can_execute,
    proposed_group,
    audit_focus,
    pg_get_functiondef(oid) as function_definition
from classified
order by proposed_group, function_name, identity_arguments;
