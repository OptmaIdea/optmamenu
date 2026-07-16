-- POS_9 / v0.9.14 — Registro de permissões faltantes no catálogo V3
-- Objetivo:
-- - Sanear o warning do diagnóstico validate_pos9_permissions_prepublish.sql.
-- - Registrar apenas as 7 chaves faltantes apontadas no pré-publicação.
-- - Usar o helper oficial register_store_permission_v3.
--
-- Uso: rode no SQL Editor do Supabase e depois rode novamente:
-- docs/sql_diagnostics/validate_pos9_permissions_prepublish.sql

DO $$
BEGIN
  IF to_regclass('public.store_permission_catalog') IS NULL THEN
    RAISE EXCEPTION 'Tabela public.store_permission_catalog não encontrada. Rode primeiro as migrations de permissões V3.';
  END IF;

  IF to_regprocedure('public.register_store_permission_v3(text,text,text,text,text,text,text,text,text,text,text,text,text,text,jsonb,integer,boolean)') IS NULL THEN
    RAISE EXCEPTION 'Função public.register_store_permission_v3(...) não encontrada. Rode primeiro as migrations de permissões V3.';
  END IF;
END $$;

SELECT public.register_store_permission_v3(
  'commercial_dashboard.view',
  'commercial',
  'Ver dashboard comercial',
  'Permite acessar o dashboard comercial com indicadores de vendas, canais, clientes, produtos, fidelidade e desempenho por período.',
  'medium',
  'Comercial',
  'commercial_dashboard',
  'Dashboard comercial',
  'commercial_dashboard',
  'Dashboard comercial',
  'view',
  'Visualizar',
  NULL,
  NULL,
  '{"owner": true, "admin": true, "manager": true, "cashier": false, "viewer": false}'::jsonb,
  1310,
  true
);

SELECT public.register_store_permission_v3(
  'direct_sales.view',
  'commercial',
  'Ver vendas diretas',
  'Permite visualizar vendas diretas e pedidos registrados fora do fluxo público tradicional.',
  'medium',
  'Comercial',
  'direct_sales',
  'Vendas diretas',
  'direct_sales',
  'Vendas diretas',
  'view',
  'Visualizar',
  NULL,
  NULL,
  '{"owner": true, "admin": true, "manager": true, "cashier": true, "viewer": false}'::jsonb,
  1320,
  true
);

SELECT public.register_store_permission_v3(
  'direct_sales.manage',
  'commercial',
  'Gerenciar vendas diretas',
  'Permite criar, editar, concluir e cancelar vendas diretas conforme as regras operacionais da loja.',
  'high',
  'Comercial',
  'direct_sales',
  'Vendas diretas',
  'direct_sales',
  'Vendas diretas',
  'manage',
  'Gerenciar',
  NULL,
  'direct_sales.view',
  '{"owner": true, "admin": true, "manager": true, "cashier": true, "viewer": false}'::jsonb,
  1321,
  true
);

SELECT public.register_store_permission_v3(
  'transfers.manage',
  'inventory',
  'Gerenciar transferências',
  'Permite criar, enviar, receber, cancelar e tratar divergências em transferências entre locais de estoque.',
  'high',
  'Estoque',
  'transfers',
  'Transferências',
  'transfers',
  'Transferências',
  'manage',
  'Gerenciar',
  'transfers.view',
  'transfers.view',
  '{"owner": true, "admin": true, "manager": true, "cashier": false, "viewer": false}'::jsonb,
  4231,
  true
);

SELECT public.register_store_permission_v3(
  'purchases.manage',
  'inventory',
  'Gerenciar compras',
  'Permite criar, editar, enviar, cancelar e aplicar compras ao estoque conforme as regras operacionais.',
  'high',
  'Estoque',
  'purchases',
  'Compras',
  'purchases',
  'Compras',
  'manage',
  'Gerenciar',
  'purchases.view',
  'purchases.view',
  '{"owner": true, "admin": true, "manager": true, "cashier": false, "viewer": false}'::jsonb,
  4311,
  true
);

SELECT public.register_store_permission_v3(
  'quotes.view',
  'inventory',
  'Ver cotações',
  'Permite visualizar cotações de fornecedores e seus status.',
  'medium',
  'Estoque',
  'quotes',
  'Cotações',
  'quotes',
  'Cotações',
  'view',
  'Visualizar',
  NULL,
  NULL,
  '{"owner": true, "admin": true, "manager": true, "cashier": false, "viewer": false}'::jsonb,
  4320,
  true
);

SELECT public.register_store_permission_v3(
  'quotes.manage',
  'inventory',
  'Gerenciar cotações',
  'Permite criar, aprovar, rejeitar e converter cotações em compras conforme as regras operacionais.',
  'high',
  'Estoque',
  'quotes',
  'Cotações',
  'quotes',
  'Cotações',
  'manage',
  'Gerenciar',
  'quotes.view',
  'quotes.view',
  '{"owner": true, "admin": true, "manager": true, "cashier": false, "viewer": false}'::jsonb,
  4321,
  true
);

-- Garante refresh da versão de permissões por loja, quando o helper existir.
DO $$
DECLARE
  v_store record;
BEGIN
  IF to_regprocedure('public.touch_store_permission_version(uuid,text)') IS NULL THEN
    RETURN;
  END IF;

  FOR v_store IN SELECT id FROM public.stores LOOP
    PERFORM public.touch_store_permission_version(v_store.id, 'pos9_prepublish_missing_permissions_registered');
  END LOOP;
END $$;

SELECT
  'missing_permissions_registered_check' AS section,
  c.permission_key,
  c.label,
  c.category,
  c.macro_group,
  c.group_key,
  c.item_key,
  c.action_key,
  c.show_in_permission_ui
FROM public.store_permission_catalog c
WHERE c.permission_key IN (
  'commercial_dashboard.view',
  'direct_sales.view',
  'direct_sales.manage',
  'transfers.manage',
  'purchases.manage',
  'quotes.view',
  'quotes.manage'
)
ORDER BY c.permission_key;
