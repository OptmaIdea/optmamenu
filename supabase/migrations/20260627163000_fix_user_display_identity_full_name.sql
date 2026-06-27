-- Fase 9.13.1J — Ajustes finos de permissões personalizadas e realtime
-- Corrige o fallback de nome exibido em listas administrativas de usuários.
--
-- Escopo desta migration:
-- - substituir `get_user_display_identity(p_user_id uuid)` preservando assinatura e retorno;
-- - manter `public.profiles.name` como origem principal;
-- - adicionar `auth.users.raw_user_meta_data->>'full_name'` antes do fallback para e-mail;
-- - manter `auth.users.raw_user_meta_data->>'name'` como fallback secundário;
-- - evitar strings vazias usando NULLIF(btrim(...), '').
--
-- Não altera tabelas, RLS, policies, Advisors ou estrutura de dados.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_user_display_identity(p_user_id uuid)
RETURNS TABLE(user_name text, user_email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
    SELECT
        COALESCE(
            NULLIF(btrim(p.name), ''),
            NULLIF(btrim(au.raw_user_meta_data->>'full_name'), ''),
            NULLIF(btrim(au.raw_user_meta_data->>'name'), ''),
            au.email
        )::text AS user_name,
        au.email::text AS user_email
    FROM auth.users au
    LEFT JOIN public.profiles p
        ON p.id = au.id
    WHERE au.id = p_user_id
    LIMIT 1;
$function$;

COMMIT;
