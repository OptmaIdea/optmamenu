-- Fase 9.13.1J — Ajustes finos de permissões personalizadas e realtime
-- Corrige o cálculo efetivo de permissões para considerar funções personalizadas.
--
-- Escopo desta migration:
-- - substituir `get_effective_store_permissions(p_store_id uuid)` preservando assinatura e retorno;
-- - considerar `store_members.custom_role_id` e `store_custom_roles.permissions`;
-- - aplicar precedência correta: owner > override individual > função personalizada > papel base > negado;
-- - tocar `store_permission_versions` para forçar refresh dos usuários conectados.
--
-- Não altera tabelas, RLS, Advisors ou políticas.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_effective_store_permissions(p_store_id uuid)
RETURNS TABLE(
    permission_code text,
    module text,
    action text,
    label text,
    description text,
    risk_level text,
    allowed boolean,
    source text,
    role text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_role text;
    v_member_permissions jsonb;
    v_custom_role_permissions jsonb;
    v_is_owner boolean;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN;
    END IF;

    SELECT
        sm.role,
        COALESCE(sm.permissions, '{}'::jsonb),
        COALESCE(scr.permissions, '{}'::jsonb),
        (sm.role = 'owner')
    INTO
        v_role,
        v_member_permissions,
        v_custom_role_permissions,
        v_is_owner
    FROM public.store_members sm
    LEFT JOIN public.store_custom_roles scr
        ON scr.id = sm.custom_role_id
       AND scr.store_id = sm.store_id
       AND scr.active = true
    WHERE sm.store_id = p_store_id
      AND sm.user_id = auth.uid()
      AND sm.status = 'active'
    ORDER BY
        CASE sm.role
            WHEN 'owner' THEN 1
            WHEN 'admin' THEN 2
            WHEN 'manager' THEN 3
            WHEN 'stock_operator' THEN 4
            WHEN 'cashier' THEN 5
            WHEN 'sales' THEN 6
            WHEN 'staff' THEN 7
            WHEN 'viewer' THEN 8
            ELSE 99
        END
    LIMIT 1;

    IF v_role IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        c.code AS permission_code,
        c.module,
        c.action,
        c.label,
        c.description,
        c.risk_level,
        CASE
            WHEN v_is_owner THEN true
            WHEN COALESCE((v_member_permissions ->> 'all')::boolean, false) THEN true
            WHEN v_member_permissions ? c.code THEN COALESCE((v_member_permissions ->> c.code)::boolean, false)
            WHEN v_custom_role_permissions ? c.code THEN COALESCE((v_custom_role_permissions ->> c.code)::boolean, false)
            ELSE COALESCE(t.allowed, false)
        END AS allowed,
        CASE
            WHEN v_is_owner THEN 'owner'
            WHEN COALESCE((v_member_permissions ->> 'all')::boolean, false) THEN 'member_override_all'
            WHEN v_member_permissions ? c.code THEN 'member_override'
            WHEN v_custom_role_permissions ? c.code THEN 'custom_role_override'
            WHEN t.source IS NOT NULL THEN t.source
            ELSE 'default_denied'
        END AS source,
        v_role AS role
    FROM public.security_permission_catalog c
    LEFT JOIN public.store_role_permission_templates t
        ON t.store_id = p_store_id
       AND t.role = v_role
       AND t.permission_code = c.code
    WHERE c.active = true
    ORDER BY c.sort_order, c.code;
END;
$function$;

-- Força refresh das permissões efetivas nos usuários conectados.
INSERT INTO public.store_permission_versions (
    store_id,
    version,
    reason,
    changed_by,
    changed_at
)
SELECT
    s.id,
    1,
    'get_effective_store_permissions:custom_roles_fix',
    auth.uid(),
    now()
FROM public.stores s
ON CONFLICT (store_id) DO UPDATE
SET
    version = public.store_permission_versions.version + 1,
    reason = EXCLUDED.reason,
    changed_by = EXCLUDED.changed_by,
    changed_at = now();

COMMIT;
