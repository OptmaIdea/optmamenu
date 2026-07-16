-- POS_9 / v0.9.14 — Registro de permissões administrativas financeiras
-- Objetivo:
-- - Separar permissões de Plano de Contas e Contas Financeiras no catálogo V3.
-- - Evitar que a permissão ampla financial.manage seja a única opção de gestão financeira.
-- - Manter o padrão do helper oficial register_store_permission_v3.
--
-- Uso: rode no SQL Editor do Supabase e depois atualize a tela:
-- Segurança > Senhas e Acesso > Permissões por papel

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
  'financial.account_plan.view',
  'financial',
  'Ver plano de contas',
  'Permite visualizar o plano de contas financeiro usado para classificar entradas, saídas, ajustes, transferências e eventos financeiros.',
  'medium',
  'Operacional',
  'financial',
  'Financeiro',
  'financial_account_plan',
  'Plano de Contas',
  'view',
  'Ver',
  'financial.view',
  'financial.view',
  '{"owner": true, "admin": true, "manager": true, "cashier": false, "viewer": false}'::jsonb,
  3510,
  true
);

SELECT public.register_store_permission_v3(
  'financial.account_plan.manage',
  'financial',
  'Gerenciar plano de contas',
  'Permite criar, editar, ativar, inativar e organizar contas do plano de contas financeiro.',
  'high',
  'Operacional',
  'financial',
  'Financeiro',
  'financial_account_plan',
  'Plano de Contas',
  'manage',
  'Gerenciar',
  'financial.account_plan.view',
  'financial.account_plan.view',
  '{"owner": true, "admin": true, "manager": false, "cashier": false, "viewer": false}'::jsonb,
  3511,
  true
);

SELECT public.register_store_permission_v3(
  'financial.accounts.view',
  'financial',
  'Ver contas financeiras',
  'Permite visualizar contas financeiras como gaveta de caixa, bancos, carteiras digitais e contas usadas nos lançamentos.',
  'medium',
  'Operacional',
  'financial',
  'Financeiro',
  'financial_accounts',
  'Contas Financeiras',
  'view',
  'Ver',
  'financial.view',
  'financial.view',
  '{"owner": true, "admin": true, "manager": true, "cashier": false, "viewer": false}'::jsonb,
  3520,
  true
);

SELECT public.register_store_permission_v3(
  'financial.accounts.manage',
  'financial',
  'Gerenciar contas financeiras',
  'Permite criar, editar, ativar, inativar e definir contas financeiras padrão para movimentos financeiros.',
  'high',
  'Operacional',
  'financial',
  'Financeiro',
  'financial_accounts',
  'Contas Financeiras',
  'manage',
  'Gerenciar',
  'financial.accounts.view',
  'financial.accounts.view',
  '{"owner": true, "admin": true, "manager": false, "cashier": false, "viewer": false}'::jsonb,
  3521,
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
    PERFORM public.touch_store_permission_version(v_store.id, 'financial_admin_permissions_registered');
  END LOOP;
END $$;

SELECT
  'financial_admin_permissions_check' AS section,
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
  'financial.account_plan.view',
  'financial.account_plan.manage',
  'financial.accounts.view',
  'financial.accounts.manage'
)
ORDER BY c.sort_order, c.permission_key;
