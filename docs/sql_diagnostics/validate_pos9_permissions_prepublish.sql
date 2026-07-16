-- POS_9 / v0.9.14 — Diagnóstico de permissões de pré-publicação
-- Objetivo:
-- - Validar a base de permissões antes de seguir para slug, vendas online, WhatsApp básico, manual e Vercel.
-- - Não altera dados.
-- - Foi escrito de forma defensiva: se alguma tabela/coluna não existir, registra como diagnóstico em vez de quebrar.

DROP TABLE IF EXISTS tmp_pos9_permissions_prepublish;

CREATE TEMP TABLE tmp_pos9_permissions_prepublish (
  section text NOT NULL,
  severity text NOT NULL,
  issue_count integer NOT NULL DEFAULT 0,
  details jsonb NOT NULL DEFAULT '[]'::jsonb
) ON COMMIT DROP;

-- 1) Inventário das tabelas esperadas/relacionadas a usuários e permissões.
WITH expected_tables AS (
  SELECT *
  FROM (VALUES
    ('public.stores', 'Loja/base multiempresa'),
    ('public.store_members', 'Vínculo usuário x loja'),
    ('public.profiles', 'Perfil do usuário'),
    ('public.permissions', 'Catálogo de permissões'),
    ('public.custom_roles', 'Papéis personalizados'),
    ('public.custom_role_permissions', 'Permissões dos papéis personalizados'),
    ('public.store_permissions', 'Permissões efetivas ou overrides por loja/usuário, quando usado'),
    ('public.store_member_invites', 'Convites de usuários, quando usado')
  ) AS t(regclass_name, expected_role)
), table_status AS (
  SELECT
    regclass_name,
    expected_role,
    to_regclass(regclass_name) IS NOT NULL AS exists
  FROM expected_tables
)
INSERT INTO tmp_pos9_permissions_prepublish(section, severity, issue_count, details)
SELECT
  'security_expected_tables' AS section,
  CASE WHEN COUNT(*) FILTER (WHERE exists IS FALSE AND regclass_name IN (
    'public.stores',
    'public.store_members',
    'public.profiles',
    'public.permissions',
    'public.custom_roles',
    'public.custom_role_permissions'
  )) = 0 THEN 'ok' ELSE 'error' END AS severity,
  COUNT(*) FILTER (WHERE exists IS FALSE AND regclass_name IN (
    'public.stores',
    'public.store_members',
    'public.profiles',
    'public.permissions',
    'public.custom_roles',
    'public.custom_role_permissions'
  ))::integer AS issue_count,
  jsonb_agg(to_jsonb(table_status) ORDER BY regclass_name) AS details
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
        SELECT jsonb_agg(jsonb_build_object('grantee', grantee, 'privilege_type', privilege_type) ORDER BY grantee)
        FROM information_schema.routine_privileges rp
        WHERE rp.specific_schema = n.nspname
          AND rp.routine_name = p.proname
      )
    )
    ORDER BY n.nspname, p.proname
  ), '[]'::jsonb) AS details
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND (
    p.proname ILIKE '%permission%'
    OR p.proname ILIKE '%permiss%'
    OR p.proname ILIKE '%role%'
    OR p.proname ILIKE '%member%'
    OR p.proname ILIKE '%security%'
  );

-- 3) Catálogo de permissões: existência, contagem e duplicidade de chave.
DO $$
DECLARE
  v_key_column text;
  v_total integer := 0;
  v_dup_count integer := 0;
  v_details jsonb := '[]'::jsonb;
BEGIN
  IF to_regclass('public.permissions') IS NULL THEN
    INSERT INTO tmp_pos9_permissions_prepublish(section, severity, issue_count, details)
    VALUES (
      'security_permissions_catalog',
      'error',
      1,
      jsonb_build_array(jsonb_build_object('issue', 'missing_table', 'table', 'public.permissions'))
    );
    RETURN;
  END IF;

  SELECT column_name
  INTO v_key_column
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'permissions'
    AND column_name IN ('key', 'permission_key', 'code', 'name')
  ORDER BY CASE column_name
    WHEN 'key' THEN 1
    WHEN 'permission_key' THEN 2
    WHEN 'code' THEN 3
    ELSE 4
  END
  LIMIT 1;

  EXECUTE 'SELECT COUNT(*)::integer FROM public.permissions' INTO v_total;

  IF v_key_column IS NULL THEN
    INSERT INTO tmp_pos9_permissions_prepublish(section, severity, issue_count, details)
    VALUES (
      'security_permissions_catalog',
      'warning',
      1,
      jsonb_build_array(jsonb_build_object(
        'issue', 'key_column_not_detected',
        'total_permissions', v_total,
        'expected_one_of', ARRAY['key','permission_key','code','name']
      ))
    );
    RETURN;
  END IF;

  EXECUTE format($sql$
    WITH duplicated AS (
      SELECT %1$I::text AS permission_key, COUNT(*)::integer AS occurrences
      FROM public.permissions
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
    'security_permissions_catalog',
    CASE WHEN v_total = 0 THEN 'error' WHEN v_dup_count > 0 THEN 'error' ELSE 'ok' END,
    CASE WHEN v_total = 0 THEN 1 ELSE v_dup_count END,
    jsonb_build_object(
      'total_permissions', v_total,
      'key_column', v_key_column,
      'duplicated_keys', v_details
    )
  );
END $$;

-- 4) Permissões esperadas pelo pré-lançamento: visão operacional, financeiro, comercial, clientes, usuários e configurações.
DO $$
DECLARE
  v_key_column text;
  v_missing_count integer := 0;
  v_details jsonb := '[]'::jsonb;
BEGIN
  IF to_regclass('public.permissions') IS NULL THEN
    RETURN;
  END IF;

  SELECT column_name
  INTO v_key_column
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'permissions'
    AND column_name IN ('key', 'permission_key', 'code', 'name')
  ORDER BY CASE column_name
    WHEN 'key' THEN 1
    WHEN 'permission_key' THEN 2
    WHEN 'code' THEN 3
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
      FROM public.permissions
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
    'security_expected_permission_keys',
    CASE WHEN v_missing_count = 0 THEN 'ok' ELSE 'warning' END,
    v_missing_count,
    v_details
  );
END $$;

-- 5) Membros de loja: vínculos sem loja/usuário, quando a tabela/colunas existirem.
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
        SELECT *
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

-- 6) Papéis personalizados duplicados por loja/nome, quando possível.
DO $$
DECLARE
  v_issue_count integer := 0;
  v_details jsonb := '[]'::jsonb;
BEGIN
  IF to_regclass('public.custom_roles') IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'custom_roles' AND column_name = 'store_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'custom_roles' AND column_name = 'name'
  ) THEN
    EXECUTE $sql$
      WITH duplicated AS (
        SELECT store_id, lower(trim(name)) AS normalized_name, COUNT(*)::integer AS occurrences
        FROM public.custom_roles
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
      'security_custom_roles_duplicates',
      CASE WHEN v_issue_count = 0 THEN 'ok' ELSE 'warning' END,
      v_issue_count,
      v_details
    );
  ELSE
    INSERT INTO tmp_pos9_permissions_prepublish(section, severity, issue_count, details)
    VALUES (
      'security_custom_roles_duplicates',
      'warning',
      1,
      jsonb_build_array(jsonb_build_object('issue', 'expected_columns_not_detected', 'expected_columns', ARRAY['store_id','name']))
    );
  END IF;
END $$;

-- 7) Permissões de papéis personalizados órfãs, quando o modelo permitir validar.
DO $$
DECLARE
  v_issue_count integer := 0;
  v_details jsonb := '[]'::jsonb;
  v_perm_key_column text;
BEGIN
  IF to_regclass('public.custom_role_permissions') IS NULL THEN
    RETURN;
  END IF;

  SELECT column_name
  INTO v_perm_key_column
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'permissions'
    AND column_name IN ('key', 'permission_key', 'code', 'name')
  ORDER BY CASE column_name
    WHEN 'key' THEN 1
    WHEN 'permission_key' THEN 2
    WHEN 'code' THEN 3
    ELSE 4
  END
  LIMIT 1;

  IF to_regclass('public.custom_roles') IS NOT NULL
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'custom_role_permissions' AND column_name = 'custom_role_id') THEN
    EXECUTE $sql$
      WITH orphan_roles AS (
        SELECT crp.*
        FROM public.custom_role_permissions crp
        LEFT JOIN public.custom_roles cr ON cr.id = crp.custom_role_id
        WHERE cr.id IS NULL
        LIMIT 50
      )
      SELECT COUNT(*)::integer,
             COALESCE(jsonb_agg(to_jsonb(orphan_roles)), '[]'::jsonb)
      FROM orphan_roles
    $sql$
    INTO v_issue_count, v_details;

    INSERT INTO tmp_pos9_permissions_prepublish(section, severity, issue_count, details)
    VALUES (
      'security_custom_role_permissions_orphan_roles',
      CASE WHEN v_issue_count = 0 THEN 'ok' ELSE 'error' END,
      v_issue_count,
      v_details
    );
  END IF;

  IF to_regclass('public.permissions') IS NOT NULL
     AND v_perm_key_column IS NOT NULL
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'custom_role_permissions' AND column_name = 'permission_key') THEN
    EXECUTE format($sql$
      WITH orphan_permissions AS (
        SELECT crp.*
        FROM public.custom_role_permissions crp
        LEFT JOIN public.permissions p ON p.%1$I::text = crp.permission_key::text
        WHERE p.%1$I IS NULL
        LIMIT 50
      )
      SELECT COUNT(*)::integer,
             COALESCE(jsonb_agg(to_jsonb(orphan_permissions)), '[]'::jsonb)
      FROM orphan_permissions
    $sql$, v_perm_key_column)
    INTO v_issue_count, v_details;

    INSERT INTO tmp_pos9_permissions_prepublish(section, severity, issue_count, details)
    VALUES (
      'security_custom_role_permissions_orphan_permissions',
      CASE WHEN v_issue_count = 0 THEN 'ok' ELSE 'error' END,
      v_issue_count,
      v_details
    );
  END IF;
END $$;

-- 8) Resultado final.
SELECT
  section,
  severity,
  issue_count,
  details
FROM tmp_pos9_permissions_prepublish
ORDER BY
  CASE severity
    WHEN 'error' THEN 1
    WHEN 'warning' THEN 2
    ELSE 3
  END,
  section;