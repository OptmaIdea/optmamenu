-- Homologação 0D — auditoria read-only de EXECUTE, search_path e fronteiras internas.
-- Executar no projeto HML. Não altera dados nem grants.
--
-- Observação: PUBLIC é pseudo-role; para detectar o grant default/explicito usamos
-- aclexplode(coalesce(proacl, acldefault(...))) em vez de has_function_privilege('public', ...).

-- 1) Resumo geral da superfície public.
WITH f AS (
  SELECT
    p.oid,
    p.proname,
    p.prosecdef,
    p.proconfig,
    EXISTS (
      SELECT 1
      FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
      WHERE a.grantee = 0
        AND a.privilege_type = 'EXECUTE'
    ) AS public_exec,
    has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec,
    has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
)
SELECT
  count(*) AS public_functions_total,
  count(*) FILTER (WHERE prosecdef) AS secdef_total,
  count(*) FILTER (WHERE prosecdef AND anon_exec) AS secdef_anon_exec,
  count(*) FILTER (WHERE prosecdef AND auth_exec) AS secdef_auth_exec,
  count(*) FILTER (WHERE prosecdef AND public_exec) AS secdef_public_exec,
  count(*) FILTER (
    WHERE prosecdef
      AND NOT EXISTS (
        SELECT 1
        FROM unnest(COALESCE(proconfig, ARRAY[]::text[])) c
        WHERE c LIKE 'search_path=%'
      )
  ) AS secdef_without_search_path,
  count(*) FILTER (
    WHERE NOT prosecdef
      AND NOT EXISTS (
        SELECT 1
        FROM unnest(COALESCE(proconfig, ARRAY[]::text[])) c
        WHERE c LIKE 'search_path=%'
      )
  ) AS invoker_without_search_path
FROM f;

-- 2) Invariante: trigger SECURITY DEFINER nunca deve ser RPC externa.
WITH f AS (
  SELECT
    p.oid,
    p.proname,
    pg_get_function_identity_arguments(p.oid) AS identity_args,
    EXISTS (
      SELECT 1
      FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
      WHERE a.grantee = 0
        AND a.privilege_type = 'EXECUTE'
    ) AS public_exec,
    has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec,
    has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef
    AND pg_get_function_result(p.oid) = 'trigger'
)
SELECT *
FROM f
WHERE public_exec OR anon_exec OR auth_exec
ORDER BY proname, identity_args;

-- 3) Invariante: nenhuma SECURITY DEFINER deve depender de PUBLIC EXECUTE.
SELECT
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS identity_args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef
  AND EXISTS (
    SELECT 1
    FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
    WHERE a.grantee = 0
      AND a.privilege_type = 'EXECUTE'
  )
ORDER BY p.proname, identity_args;

-- 4) Maintenance crítica deve ser apenas service_role entre os papeis externos.
SELECT
  has_function_privilege('anon', 'public.reconcile_inventory_reservations(uuid,boolean)', 'EXECUTE') AS reconcile_anon_exec,
  has_function_privilege('authenticated', 'public.reconcile_inventory_reservations(uuid,boolean)', 'EXECUTE') AS reconcile_auth_exec,
  has_function_privilege('service_role', 'public.reconcile_inventory_reservations(uuid,boolean)', 'EXECUTE') AS reconcile_service_exec;

-- 5) Implementações *_internal_0d não podem ficar expostas a anon/authenticated/PUBLIC.
WITH f AS (
  SELECT
    p.oid,
    p.proname,
    pg_get_function_identity_arguments(p.oid) AS identity_args,
    EXISTS (
      SELECT 1
      FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
      WHERE a.grantee = 0
        AND a.privilege_type = 'EXECUTE'
    ) AS public_exec,
    has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec,
    has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname LIKE '%\_internal\_0d' ESCAPE '\'
)
SELECT *
FROM f
WHERE public_exec OR anon_exec OR auth_exec
ORDER BY proname, identity_args;

-- 6) Qualquer função public sem search_path explícito deve ser revisada.
SELECT
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS identity_args,
  p.prosecdef,
  p.proconfig
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND NOT EXISTS (
    SELECT 1
    FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) c
    WHERE c LIKE 'search_path=%'
  )
ORDER BY p.prosecdef DESC, p.proname, identity_args;

-- 7) Lista residual de SECURITY DEFINER expostas a anon para classificação explícita.
SELECT
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS identity_args,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec,
  COALESCE(array_to_string(p.proconfig, ','), '') AS proconfig
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef
  AND has_function_privilege('anon', p.oid, 'EXECUTE')
ORDER BY p.proname, identity_args;

-- 8) Heurística: mutações SECURITY DEFINER acessíveis por authenticated que não
-- mostram guard explícito/conhecido no corpo. A lista esperada após 0D é restrita
-- às operações deliberadamente públicas/customer; qualquer RPC administrativa aqui
-- exige revisão manual.
WITH f AS (
  SELECT
    p.oid,
    p.proname,
    pg_get_function_identity_arguments(p.oid) AS identity_args,
    pg_get_functiondef(p.oid) AS definition
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef
    AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
)
SELECT proname, identity_args
FROM f
WHERE definition ~* '\m(insert|update|delete|merge)\M'
  AND definition !~* '(auth\.uid\s*\(|app_is_store_owner\s*\(|user_has_store_permission|can_access_security_section|user_can_purchase_action|is_store_member|is_store_user|app_current_role\s*\(|app_current_customer_id\s*\(|app_current_store_id\s*\(|assert_store|require_store|internal_0d\s*\()'
ORDER BY proname, identity_args;
