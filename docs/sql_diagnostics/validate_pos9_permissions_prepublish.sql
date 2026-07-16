-- POS_9 / v0.9.14 — Diagnóstico de permissões de pré-publicação
-- Objetivo:
-- - Validar a base real de permissões V3 antes de seguir para slug, vendas online, WhatsApp básico, manual e Vercel.
-- - Não altera dados.
-- - Não exige tabelas legadas como public.permissions/custom_roles; usa a arquitetura atual store_*.

DROP TABLE IF EXISTS tmp_pos9_permissions_prepublish;

CREATE TEMP TABLE tmp_pos9_permissions_prepublish (
  section text NOT NULL,
  severity text NOT NULL,
  issue_count integer NOT NULL DEFAULT 0,
  details jsonb NOT NULL DEFAULT '[]'::jsonb
) ON COMMIT DROP;

-- 1) Inventário das tabelas esperadas no modelo atual.
WITH expected_tables AS (
  SELECT *
  FROM (VALUES
    ('public.stores', true, 'Loja/base multiempresa'),
    ('public.store_members', true, 'Vínculo usuário x loja'),
    ('public.profiles', true, 'Perfil do usuário'),
    ('public.store_permission_catalog', true, 'Catálogo V3 de permissões'),
    ('public.store_custom_roles', false, 'Papéis personalizados por loja, quando usado'),
    ('public.store_role_permissions', false, 'Permissões por papel padrão/customizado, quando usado'),
    ('public.store_member_invites', false, 'Convites de usuários, quando usado'),
    ('public.store_security_logs', false, 'Logs de segurança, quando usado'),
    ('public.permissions', false, 'Catálogo legado de permissões; não obrigatório'),
    ('public.custom_roles', false, 'Papéis legados; não obrigatório'),
    ('public.custom_role_permissions', false, 'Permissões legadas de papéis; não obrigatório')
  ) AS t(regclass_name, required, expected_role)
), table_status AS (
  SELECT
    regclass_name,
    required,
    expected_role,
    to_regclass(regclass_name) IS NOT NULL AS exists
  FROM expected_tables
)
INSERT INTO tmp_pos9_permissions_prepublish(section, severity, issue_count, details)
SELECT
  'security_expected_tables' AS section,
  CASE WHEN COUNT(*) FILTER (WHERE required IS TRUE AND exists IS FALSE) = 0 THEN 'ok' ELSE 'error' END AS severity,
  COUNT(*) FILTER (WHERE required IS TRUE AND exists IS FALSE)::integer AS issue_count,
  jsonb_agg(to_jsonb(table_status) ORDER BY required DESC, regclass_name) AS details
FROM table_status;

-- 2) Inventário de funções/helpers relacionadas a permissões, papéis e membros.
INSERT INTO tmp_pos9_permissions_prepublish(section, severity, issue_count, details)
SELECT
  'security_permission_helpers_inventory' AS section,
  'ok' AS severity,
  0 AS issue_count,
  COALESCE(jsonb_agg(
    jsonb_build_object(
      'schema', n.nspname,
      'function_name', p.proname,
      'arguments', pg_get_function_identity_arguments(p.oid),
      'security_definer', p.prosecdef,
      'execute_grants', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object('grantee', grantee, 'privilege_type', privilege_type) ORDER BY grantee), '[]'::jsonb)
        FROM information_schema.routine_privileges rp
        WHERE rp.specific_schema = n.nspname
          AND rp.routine_name = p.proname
      )
    )
    ORDER BY n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)
  ), '[]'::jsonb) AS details
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND (
    p.proname ILIKE '%permission%'
    OR p.proname ILIKE '%role%'
    OR p.proname ILIKE '%member%'
    OR p.proname ILIKE '%security%'
  );

-- 3) Catálogo V3 de permissões: existência, contagem e duplicidade de chave.
DO $$
DECLARE
  v_key_column text;
  v_total integer := 0;
  v_dup_count integer := 0;
  v_details jsonb := '[]'::jsonb;
BEGIN
  IF to_regclass('public.store_permission_catalog') IS NULL THEN
    INSERT INTO tmp_pos9_permissions_prepublish(section, severity, issue_count, details)
    VALUES (
      'security_permission_catalog_v3',
      'error',
      1,
      jsonb_build_array(jsonb_build_object('issue', 'missing_table', 'table', 'public.store_permission_catalog'))
    );
    RETURN;
  END IF;

  SELECT column_name
  INTO v_key_column
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'store_permission_catalog'
    AND column_name IN ('permission_key', 'code', 'key', 'name')
  ORDER BY CASE column_name
    WHEN 'permission_key' THEN 1
    WHEN 'code' THEN 2
    WHEN 'key' THEN 3
    ELSE 4
  END
  LIMIT 1;

  EXECUTE 'SELECT COUNT(*)::integer FROM public.store_permission_catalog' INTO v_total;

  IF v_key_column IS NULL THEN
    INSERT INTO tmp_pos9_permissions_prepublish(section, severity, issue_count, details)
    VALUES (
      'security_permission_catalog_v3',
      'warning',
      1,
      jsonb_build_object(
        'issue', 'key_column_not_detected',
        'total_permissions', v_total,
        'expected_one_of', ARRAY['permission_key','code','key','name']
      )
    );
    RETURN;
  END IF;

  EXECUTE format($sql$
    WITH duplicated AS (
      SELECT %1$I::text AS permission_key, COUNT(*)::integer AS occurrences
      FROM public.store_permission_catalog
      GROUP BY %1$I::text
      HAVING COUNT(*) > 1
    )
    SELECT COUNT(*)::integer,
           COALESCE(jsonb_agg(to_jsonb(duplicated) ORDER BY permission_key), '[]'::jsonb)
    FROM duplicated
  $sql$, v_key_column)
  INTO v_dup_count, v_details;

  INSERT INTO tmp_pos9_permissions_prepublish(section, severity, issue_count, details)
  VALUES (
    'security_permission_catalog_v3',
    CASE WHEN v_total = 0 THEN 'error' WHEN v_dup_count > 0 THEN 'error' ELSE 'ok' END,
    CASE WHEN v_total = 0 THEN 1 ELSE v_dup_count END,
    jsonb_build_object(
      'total_permissions', v_total,
      'key_column', v_key_column,
      'duplicated_keys', v_details
    )
  );
END $$;

-- 4) Permissões esperadas pelo pré-lançamento dentro do catálogo V3.
DO $$
DECLARE
  v_key_column text;
  v_missing_count integer := 0;
  v_details jsonb := '[]'::jsonb;
BEGIN
  IF to_regclass('public.store_permission_catalog') IS NULL THEN
    RETURN;
  END IF;

  SELECT column_name
  INTO v_key_column
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'store_permission_catalog'
    AND column_name IN ('permission_key', 'code', 'key', 'name')
  ORDER BY CASE column_name
    WHEN 'permission_key' THEN 1
    WHEN 'code' THEN 2
    WHEN 'key' THEN 3
    ELSE 4
  END
  LIMIT 1;

  IF v_key_column IS NULL THEN
    RETURN;
  END IF;

  EXECUTE format($sql$
    WITH expected(permission_key, area) AS (
      VALUES
        ('dashboard.view', 'Painel operacional'),
        ('commercial_dashboard.view', 'Dashboard comercial'),
        ('products.view', 'Produtos'),
        ('products.manage', 'Produtos'),
        ('categories.view', 'Categorias'),
        ('categories.manage', 'Categorias'),
        ('stock.view', 'Estoque'),
        ('stock.manage', 'Estoque'),
        ('transfers.view', 'Transferências'),
        ('transfers.manage', 'Transferências'),
        ('purchases.view', 'Compras'),
        ('purchases.manage', 'Compras'),
        ('quotes.view', 'Cotações'),
        ('quotes.manage', 'Cotações'),
        ('suppliers.view', 'Fornecedores'),
        ('suppliers.manage', 'Fornecedores'),
        ('cashbook.view', 'Livro diário'),
        ('cashbook.create', 'Livro diário'),
        ('cashbook.cancel', 'Livro diário'),
        ('reports.export', 'Relatórios'),
        ('customers.view', 'Clientes'),
        ('customers.manage', 'Clientes'),
        ('orders.view', 'Pedidos'),
        ('orders.manage', 'Pedidos'),
        ('direct_sales.view', 'Vendas diretas'),
        ('direct_sales.manage', 'Vendas diretas'),
        ('loyalty.view', 'Fidelidade'),
        ('loyalty.manage', 'Fidelidade'),
        ('marketing.view', 'Marketing e mensagens'),
        ('marketing.manage', 'Marketing e mensagens'),
        ('users.view', 'Usuários'),
        ('users.manage', 'Usuários'),
        ('settings.view', 'Configurações'),
        ('settings.manage', 'Configurações')
    ), catalog AS (
      SELECT %1$I::text AS permission_key
      FROM public.store_permission_catalog
    ), missing AS (
      SELECT e.*
      FROM expected e
      LEFT JOIN catalog c ON c.permission_key = e.permission_key
      WHERE c.permission_key IS NULL
    )
    SELECT COUNT(*)::integer,
           COALESCE(jsonb_agg(to_jsonb(missing) ORDER BY area, permission_key), '[]'::jsonb)
    FROM missing
  $sql$, v_key_column)
  INTO v_missing_count, v_details;

  INSERT INTO tmp_pos9_permissions_prepublish(section, severity, issue_count, details)
  VALUES (
    'security_expected_permission_keys_v3',
    CASE WHEN v_missing_count = 0 THEN 'ok' ELSE 'warning' END,
    v_missing_count,
    v_details
  );
END $$;

-- 5) Membros de loja: vínculos sem loja/usuário.
DO $$
DECLARE
  v_issue_count integer := 0;
  v_details jsonb := '[]'::jsonb;
BEGIN
  IF to_regclass('public.store_members') IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'store_members' AND column_name IN ('store_id', 'user_id')
  ) THEN
    EXECUTE $sql$
      WITH sample AS (
        SELECT id, store_id, user_id, role, status, created_at
        FROM public.store_members
        WHERE (store_id IS NULL OR user_id IS NULL)
        LIMIT 50
      )
      SELECT COUNT(*)::integer,
             COALESCE(jsonb_agg(to_jsonb(sample)), '[]'::jsonb)
      FROM sample
    $sql$
    INTO v_issue_count, v_details;

    INSERT INTO tmp_pos9_permissions_prepublish(section, severity, issue_count, details)
    VALUES (
      'security_store_members_integrity',
      CASE WHEN v_issue_count = 0 THEN 'ok' ELSE 'error' END,
      v_issue_count,
      v_details
    );
  ELSE
    INSERT INTO tmp_pos9_permissions_prepublish(section, severity, issue_count, details)
    VALUES (
      'security_store_members_integrity',
      'warning',
      1,
      jsonb_build_array(jsonb_build_object('issue', 'expected_columns_not_detected', 'expected_columns', ARRAY['store_id','user_id']))
    );
  END IF;
END $$;

-- 6) Papéis personalizados duplicados por loja/nome no modelo atual.
DO $$
DECLARE
  v_issue_count integer := 0;
  v_details jsonb := '[]'::jsonb;
BEGIN
  IF to_regclass('public.store_custom_roles') IS NULL THEN
    INSERT INTO tmp_pos9_permissions_prepublish(section, severity, issue_count, details)
    VALUES (
      'security_custom_roles_duplicates_v3',
      'ok',
      0,
      jsonb_build_array(jsonb_build_object('note', 'store_custom_roles_not_present_or_not_used'))
    );
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'store_custom_roles' AND column_name = 'store_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'store_custom_roles' AND column_name = 'name'
  ) THEN
    EXECUTE $sql$
      WITH duplicated AS (
        SELECT store_id, lower(trim(name)) AS normalized_name, COUNT(*)::integer AS occurrences
        FROM public.store_custom_roles
        GROUP BY store_id, lower(trim(name))
        HAVING COUNT(*) > 1
      )
      SELECT COUNT(*)::integer,
             COALESCE(jsonb_agg(to_jsonb(duplicated) ORDER BY normalized_name), '[]'::jsonb)
      FROM duplicated
    $sql$
    INTO v_issue_count, v_details;

    INSERT INTO tmp_pos9_permissions_prepublish(section, severity, issue_count, details)
    VALUES (
      'security_custom_roles_duplicates_v3',
      CASE WHEN v_issue_count = 0 THEN 'ok' ELSE 'warning' END,
      v_issue_count,
      v_details
    );
  ELSE
    INSERT INTO tmp_pos9_permissions_prepublish(section, severity, issue_count, details)
    VALUES (
      'security_custom_roles_duplicates_v3',
      'warning',
      1,
      jsonb_build_array(jsonb_build_object('issue', 'expected_columns_not_detected', 'expected_columns', ARRAY['store_id','name']))
    );
  END IF;
END $$;

-- 7) Grants públicos/anon em helpers sensíveis: inventário para revisão, não erro automático.
WITH risky_public_grants AS (
  SELECT
    n.nspname AS schema,
    p.proname AS function_name,
    pg_get_function_identity_arguments(p.oid) AS arguments,
    p.prosecdef AS security_definer,
    rp.grantee,
    rp.privilege_type
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  JOIN information_schema.routine_privileges rp
    ON rp.specific_schema = n.nspname
   AND rp.routine_name = p.proname
  WHERE n.nspname = 'public'
    AND rp.grantee IN ('PUBLIC', 'anon')
    AND (
      p.proname ILIKE '%permission%'
      OR p.proname ILIKE '%role%'
      OR p.proname ILIKE '%member%'
      OR p.proname ILIKE '%security%'
    )
    AND p.proname NOT IN (
      'app_role_rank',
      'resolve_permission_section_v3',
      'get_security_log_visibility_defaults',
      'set_store_permission_catalog_updated_at',
      'set_store_security_settings_updated_at'
    )
)
INSERT INTO tmp_pos9_permissions_prepublish(section, severity, issue_count, details)
SELECT
  'security_public_grants_review' AS section,
  CASE WHEN COUNT(*) = 0 THEN 'ok' ELSE 'warning' END AS severity,
  COUNT(*)::integer AS issue_count,
  COALESCE(jsonb_agg(to_jsonb(risky_public_grants) ORDER BY function_name, grantee), '[]'::jsonb) AS details
FROM risky_public_grants;

SELECT section, severity, issue_count, details
FROM tmp_pos9_permissions_prepublish
ORDER BY
  CASE severity
    WHEN 'error' THEN 1
    WHEN 'warning' THEN 2
    ELSE 3
  END,
  section;