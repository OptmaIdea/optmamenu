-- POS_9 / v0.9.14 — Ocultar permissões manage de abas visuais de Segurança
-- Objetivo:
-- - Contexto de acesso e Histórico de atividades são áreas de leitura/visualização.
-- - Evitar que a matriz exiba permissões de gerenciamento sem ação real de edição.
-- - Não remove permissões, apenas oculta da UI de permissões e documenta a decisão.
--
-- Uso: rode no SQL Editor do Supabase.

DO $$
BEGIN
  IF to_regclass('public.store_permission_catalog') IS NULL THEN
    RAISE EXCEPTION 'Tabela public.store_permission_catalog não encontrada.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'store_permission_catalog'
      AND column_name = 'permission_key'
  ) THEN
    RAISE EXCEPTION 'Coluna public.store_permission_catalog.permission_key não encontrada.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'store_permission_catalog'
      AND column_name = 'show_in_permission_ui'
  ) THEN
    UPDATE public.store_permission_catalog
       SET show_in_permission_ui = false,
           updated_at = CASE
             WHEN EXISTS (
               SELECT 1
               FROM information_schema.columns
               WHERE table_schema = 'public'
                 AND table_name = 'store_permission_catalog'
                 AND column_name = 'updated_at'
             ) THEN now()
             ELSE updated_at
           END
     WHERE permission_key IN (
       'security.context.manage',
       'security.logs.manage'
     );
  ELSE
    RAISE NOTICE 'Coluna show_in_permission_ui não encontrada; nada foi alterado.';
  END IF;
END $$;

-- Atualiza versão de permissões por loja para forçar recarregamento quando o helper existir.
DO $$
DECLARE
  v_store record;
BEGIN
  IF to_regprocedure('public.touch_store_permission_version(uuid,text)') IS NULL THEN
    RETURN;
  END IF;

  FOR v_store IN SELECT id FROM public.stores LOOP
    PERFORM public.touch_store_permission_version(
      v_store.id,
      'prepublish_hide_visual_security_manage_permissions_v0.9.14'
    );
  END LOOP;
END $$;

-- Pós-checagem.
SELECT
  'visual_security_manage_permissions' AS section,
  permission_key,
  label,
  show_in_permission_ui
FROM public.store_permission_catalog
WHERE permission_key IN (
  'security.context.view',
  'security.context.manage',
  'security.logs.view',
  'security.logs.manage'
)
ORDER BY permission_key;
