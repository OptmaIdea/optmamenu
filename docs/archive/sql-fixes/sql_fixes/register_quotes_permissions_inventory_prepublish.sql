-- POS_9 / v0.9.14 — Hotfix catálogo de permissões: Cotações em Produtos e Estoque
-- Objetivo:
-- - Garantir que quotes.view e quotes.manage apareçam na árvore Operacional > Produtos e Estoque.
-- - Alinhar a tela de Cotações ao script apply_quotes_readonly_ux.cjs.
--
-- Uso:
-- 1. Rode no Supabase SQL Editor.
-- 2. Atualize a tela Segurança > Permissões por papel.

DO $$
BEGIN
  IF to_regclass('public.store_permission_catalog') IS NULL THEN
    RAISE EXCEPTION 'Tabela public.store_permission_catalog não encontrada.';
  END IF;

  IF to_regprocedure('public.register_store_permission_v3(text,text,text,text,text,text,text,text,text,text,text,text,text,text,jsonb,integer,boolean)') IS NULL THEN
    RAISE EXCEPTION 'Função public.register_store_permission_v3(...) não encontrada.';
  END IF;
END $$;

SELECT public.register_store_permission_v3(
  'quotes.view',
  'inventory',
  'Ver cotações',
  'Permite visualizar cotações de fornecedores, mensagens, respostas, histórico e status dentro de Produtos e Estoque.',
  'medium',
  'Produtos e Estoque',
  'quotes',
  'Cotações',
  'quotes',
  'Cotações',
  'view',
  'Ver',
  NULL,
  NULL,
  '{"owner": true, "admin": true, "manager": true, "inventory": true, "cashier": false, "sales": false, "support": false, "viewer": false}'::jsonb,
  4320,
  true
);

SELECT public.register_store_permission_v3(
  'quotes.manage',
  'inventory',
  'Gerenciar cotações',
  'Permite criar cotações, registrar resposta do fornecedor, aprovar, rejeitar/cancelar e converter cotação aprovada em rascunho de compra.',
  'high',
  'Produtos e Estoque',
  'quotes',
  'Cotações',
  'quotes',
  'Cotações',
  'manage',
  'Gerenciar',
  'quotes.view',
  'quotes.view',
  '{"owner": true, "admin": true, "manager": true, "inventory": true, "cashier": false, "sales": false, "support": false, "viewer": false}'::jsonb,
  4321,
  true
);

-- Garante correção direta caso as permissões já existissem com rótulo/grupo antigo.
UPDATE public.store_permission_catalog
SET
  category = 'inventory',
  macro_group = 'Produtos e Estoque',
  group_key = 'quotes',
  group_label = 'Cotações',
  item_key = 'quotes',
  item_label = 'Cotações',
  show_in_permission_ui = true,
  sort_order = CASE permission_key
    WHEN 'quotes.view' THEN 4320
    WHEN 'quotes.manage' THEN 4321
    ELSE sort_order
  END,
  updated_at = now()
WHERE permission_key IN ('quotes.view', 'quotes.manage');

DO $$
DECLARE
  v_store record;
BEGIN
  IF to_regprocedure('public.touch_store_permission_version(uuid,text)') IS NULL THEN
    RETURN;
  END IF;

  FOR v_store IN SELECT id FROM public.stores LOOP
    PERFORM public.touch_store_permission_version(v_store.id, 'quotes_permissions_inventory_hotfix');
  END LOOP;
END $$;

SELECT
  'quotes_permissions_inventory_check' AS section,
  permission_key,
  label,
  category,
  macro_group,
  group_key,
  group_label,
  item_key,
  item_label,
  action_key,
  action_label,
  sort_order,
  show_in_permission_ui,
  default_by_role
FROM public.store_permission_catalog
WHERE permission_key IN ('quotes.view', 'quotes.manage')
ORDER BY sort_order;
