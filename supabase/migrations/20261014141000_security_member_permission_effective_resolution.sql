-- Alinha a visualização das permissões individuais à resolução efetiva v2.
-- A RPC anterior ignorava store_custom_roles e exibia negativas como concessões.
-- Não modifica registros ou concessões existentes.
BEGIN;
CREATE OR REPLACE FUNCTION public.get_store_member_permission_detail(p_member_id uuid)
RETURNS TABLE(
 member_id uuid, store_id uuid, user_id uuid, user_name text, user_email text,
 role text, status text, permission_code text, module text, action text,
 label text, description text, risk_level text, role_allowed boolean,
 override_value boolean, effective_allowed boolean, source text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public','auth','pg_temp'
AS $function$
 WITH member_base AS (
   SELECT sm.id AS member_id,sm.store_id,sm.user_id,
     COALESCE(p.name,au.email::text,sm.user_id::text)::text AS user_name,
     au.email::text AS user_email,
     sm.role,sm.status
   FROM public.store_members sm
   LEFT JOIN public.profiles p ON p.id=sm.user_id
   LEFT JOIN auth.users au ON au.id=sm.user_id
   WHERE sm.id=p_member_id
 )
 SELECT
   mb.member_id,mb.store_id,mb.user_id,mb.user_name,mb.user_email,
   mb.role,mb.status,
   c.code::text AS permission_code,
   c.module::text,c.action::text,c.label::text,c.description::text,
   c.risk_level::text,
   effective.role_allowed,
   effective.individual_override AS override_value,
   effective.effective_allowed,
   effective.source
 FROM member_base mb
 CROSS JOIN LATERAL public.get_effective_store_member_permissions_v2(mb.store_id,mb.member_id) effective
 JOIN public.security_permission_catalog c ON c.code=effective.permission_code AND c.active=true
 WHERE public.can_access_security_section_v3(mb.store_id,'user_permissions',false)
 ORDER BY c.sort_order,c.module,c.action,c.code
$function$;
COMMIT;
