-- Fase 9.13.1K — Label de função personalizada no login
--
-- Corrige a RPC get_login_store_options para retornar dados da função personalizada
-- vinculada ao membro, permitindo que a tela de escolha de loja exiba, por exemplo,
-- "Subgerente Nível I" em vez de apenas o papel base "Gerente".
--
-- Observação técnica:
-- Como a assinatura de retorno muda, é necessário remover e recriar a função.
-- A lógica anterior foi preservada e apenas foram adicionados:
-- - custom_role_id
-- - custom_role_name
-- - custom_role_base_role

BEGIN;

DROP FUNCTION IF EXISTS public.get_login_store_options();

CREATE OR REPLACE FUNCTION public.get_login_store_options()
RETURNS TABLE(
    store_id uuid,
    store_name text,
    store_slug text,
    store_logo_url text,
    role text,
    custom_role_id uuid,
    custom_role_name text,
    custom_role_base_role text,
    status text,
    status_reason text,
    is_owner boolean,
    is_primary_owner boolean,
    access_blocked boolean,
    access_message text,
    sort_order integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
    SELECT
        sm.store_id,
        COALESCE(s.name, s.slug, sm.store_id::text)::text AS store_name,
        s.slug::text AS store_slug,
        s.logo_url::text AS store_logo_url,
        sm.role::text AS role,
        scr.id AS custom_role_id,
        scr.name::text AS custom_role_name,
        scr.base_role::text AS custom_role_base_role,
        sm.status::text AS status,
        sm.status_reason::text AS status_reason,
        (sm.role = 'owner') AS is_owner,
        COALESCE(s.user_id = sm.user_id, false) AS is_primary_owner,
        (sm.status = 'suspended') AS access_blocked,
        CASE
            WHEN sm.status = 'suspended'
                THEN COALESCE(
                    NULLIF(trim(sm.status_reason), ''),
                    'Seu acesso a esta loja está suspenso. Procure o responsável pela empresa.'
                )
            ELSE NULL
        END::text AS access_message,
        CASE
            WHEN sm.status = 'active' AND sm.role = 'owner' THEN 1
            WHEN sm.status = 'active' AND sm.role = 'admin' THEN 2
            WHEN sm.status = 'active' AND sm.role = 'manager' THEN 3
            WHEN sm.status = 'active' THEN 4
            WHEN sm.status = 'suspended' THEN 20
            ELSE 99
        END AS sort_order
    FROM public.store_members sm
    JOIN public.stores s
        ON s.id = sm.store_id
    LEFT JOIN public.store_custom_roles scr
        ON scr.id = sm.custom_role_id
       AND scr.store_id = sm.store_id
       AND scr.active = true
    WHERE sm.user_id = auth.uid()
      AND sm.status IN ('active', 'suspended')
    ORDER BY
        sort_order,
        store_name;
$function$;

GRANT EXECUTE ON FUNCTION public.get_login_store_options() TO authenticated;

COMMIT;
