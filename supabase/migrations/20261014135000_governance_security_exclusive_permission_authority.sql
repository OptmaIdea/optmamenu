-- Segurança como autoridade única de autorização; preserva papéis e concessões atuais.
BEGIN;
CREATE OR REPLACE FUNCTION public.add_store_member_by_email(p_store_id uuid, p_email text, p_role text DEFAULT 'staff'::text, p_status text DEFAULT 'active'::text, p_permissions jsonb DEFAULT '{}'::jsonb, p_sensitive_actions jsonb DEFAULT '{}'::jsonb)
 RETURNS TABLE(member_id uuid, store_id uuid, user_id uuid, user_email text, role text, status text, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_target_user_id uuid;
  v_target_email text;
  v_member_id uuid;
  v_actor_email text;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if p_store_id is null then
    raise exception 'Loja não informada.';
  end if;

  if p_email is null or btrim(p_email) = '' then
    raise exception 'E-mail do usuário é obrigatório.';
  end if;

  if p_role not in (
    'admin',
    'manager',
    'stock_operator',
    'cashier',
    'sales',
    'viewer',
    'staff'
  ) then
    raise exception 'Papel inválido para novo membro: %', p_role;
  end if;

  if p_status not in ('active', 'inactive', 'suspended', 'invited') then
    raise exception 'Status inválido para novo membro: %', p_status;
  end if;

  if not (
    public.app_is_store_owner(p_store_id)
    or public.user_has_store_permission(p_store_id, 'users.manage')
  ) then
    raise exception 'Você não tem permissão para adicionar usuários.';
  end if;

  select
    au.id,
    au.email::text
  into
    v_target_user_id,
    v_target_email
  from auth.users au
  where lower(au.email::text) = lower(btrim(p_email))
  limit 1;

  if v_target_user_id is null then
    raise exception 'Usuário não encontrado no Auth com este e-mail: %', p_email;
  end if;

  if v_target_user_id = auth.uid() then
    raise exception 'Você não pode adicionar ou alterar seu próprio vínculo por esta rotina.';
  end if;

  if not public.can_access_security_section_v3(p_store_id, 'user_permissions', true)
    and (p_role <> 'staff' or coalesce(p_permissions,'{}'::jsonb) <> '{}'::jsonb
       or coalesce(p_sensitive_actions,'{}'::jsonb) <> '{}'::jsonb or exists (select 1 from public.store_members sm where sm.store_id=p_store_id and sm.user_id=v_target_user_id)) then
    raise exception 'Alterar papel/permissões exige autorização da Central de Segurança.';
  end if;

  select email::text
  into v_actor_email
  from auth.users
  where id = auth.uid();

  insert into public.store_members (
    store_id,
    user_id,
    role,
    status,
    permissions,
    sensitive_actions,
    invited_by,
    invited_at,
    accepted_at
  )
  values (
    p_store_id,
    v_target_user_id,
    p_role,
    p_status,
    coalesce(p_permissions, '{}'::jsonb),
    coalesce(p_sensitive_actions, '{}'::jsonb),
    auth.uid(),
    now(),
    case when p_status = 'active' then now() else null end
  )
  on conflict (store_id, user_id)
  do update set
    role = excluded.role,
    status = excluded.status,
    permissions = excluded.permissions,
    sensitive_actions = excluded.sensitive_actions,
    updated_at = now()
  returning id
  into v_member_id;

  insert into public.store_security_logs (
    store_id,
    user_id,
    user_email,
    action,
    details,
    outcome,
    created_at
  )
  values (
    p_store_id,
    auth.uid(),
    v_actor_email,
    'store_member_added_or_updated_by_email',
    jsonb_build_object(
      'member_id', v_member_id,
      'target_user_id', v_target_user_id,
      'target_email', v_target_email,
      'role', p_role,
      'status', p_status
    ),
    'success',
    now()
  );

  return query
  select
    sm.id as member_id,
    sm.store_id,
    sm.user_id,
    v_target_email as user_email,
    sm.role,
    sm.status,
    sm.created_at,
    sm.updated_at
  from public.store_members sm
  where sm.id = v_member_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.assign_store_custom_role_to_member(p_member_id uuid, p_custom_role_id uuid DEFAULT NULL::uuid, p_reason text DEFAULT NULL::text, p_clear_individual_overrides boolean DEFAULT false, p_create_occurrence boolean DEFAULT true)
 RETURNS TABLE(member_id uuid, store_id uuid, user_id uuid, role text, custom_role_id uuid, custom_role_name text, custom_role_base_role text, permissions jsonb, sensitive_actions jsonb, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_member public.store_members%ROWTYPE;
  v_custom_role public.store_custom_roles%ROWTYPE;
  v_old_custom_role_id uuid;
  v_old_custom_role_name text;
  v_actor_name text;
  v_actor_email text;
  v_target_name text;
  v_target_email text;
  v_old_permissions jsonb;
  v_old_sensitive_actions jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  IF p_member_id IS NULL THEN
    RAISE EXCEPTION 'Membro não informado.';
  END IF;

  SELECT sm.*
  INTO v_member
  FROM public.store_members sm
  WHERE sm.id = p_member_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membro não encontrado.';
  END IF;

  IF v_member.role = 'owner' THEN
    RAISE EXCEPTION 'Não é permitido atribuir função personalizada ao proprietário.';
  END IF;

  IF v_member.user_id = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode alterar sua própria função personalizada.';
  END IF;

  IF NOT public.can_access_security_section_v3(v_member.store_id, 'user_permissions', true) THEN
    RAISE EXCEPTION 'Sem permissão para atribuir função personalizada.';
  END IF;

  v_old_custom_role_id := v_member.custom_role_id;
  v_old_permissions := COALESCE(v_member.permissions, '{}'::jsonb);
  v_old_sensitive_actions := COALESCE(v_member.sensitive_actions, '{}'::jsonb);

  IF v_old_custom_role_id IS NOT NULL THEN
    SELECT scr.name
    INTO v_old_custom_role_name
    FROM public.store_custom_roles scr
    WHERE scr.id = v_old_custom_role_id;
  END IF;

  IF p_custom_role_id IS NOT NULL THEN
    SELECT scr.*
    INTO v_custom_role
    FROM public.store_custom_roles scr
    WHERE scr.id = p_custom_role_id
      AND scr.store_id = v_member.store_id
      AND scr.active = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Função personalizada não encontrada, inativa ou pertence a outra loja.';
    END IF;

    UPDATE public.store_members sm
    SET
      role = v_custom_role.base_role,
      custom_role_id = p_custom_role_id,
      permissions = CASE
        WHEN p_clear_individual_overrides THEN '{}'::jsonb
        ELSE COALESCE(sm.permissions, '{}'::jsonb)
      END,
      sensitive_actions = CASE
        WHEN p_clear_individual_overrides THEN '{}'::jsonb
        ELSE COALESCE(sm.sensitive_actions, '{}'::jsonb)
      END,
      updated_at = now()
    WHERE sm.id = p_member_id;
  ELSE
    UPDATE public.store_members sm
    SET
      custom_role_id = NULL,
      permissions = CASE
        WHEN p_clear_individual_overrides THEN '{}'::jsonb
        ELSE COALESCE(sm.permissions, '{}'::jsonb)
      END,
      sensitive_actions = CASE
        WHEN p_clear_individual_overrides THEN '{}'::jsonb
        ELSE COALESCE(sm.sensitive_actions, '{}'::jsonb)
      END,
      updated_at = now()
    WHERE sm.id = p_member_id;
  END IF;

  SELECT
    identity_row.user_name,
    identity_row.user_email
  INTO
    v_actor_name,
    v_actor_email
  FROM public.get_user_display_identity(auth.uid()) AS identity_row;

  SELECT
    identity_row.user_name,
    identity_row.user_email
  INTO
    v_target_name,
    v_target_email
  FROM public.get_user_display_identity(v_member.user_id) AS identity_row;

  INSERT INTO public.store_security_logs (
    store_id,
    user_id,
    user_name,
    user_email,
    action,
    details,
    outcome,
    created_at
  )
  VALUES (
    v_member.store_id,
    auth.uid(),
    v_actor_name,
    v_actor_email,
    CASE
      WHEN p_custom_role_id IS NULL THEN 'store_custom_role_removed'
      ELSE 'store_custom_role_assigned'
    END,
    jsonb_build_object(
      'member_id', p_member_id,
      'target_user_id', v_member.user_id,
      'target_user_name', v_target_name,
      'target_user_email', v_target_email,
      'old_custom_role_id', v_old_custom_role_id,
      'old_custom_role_name', v_old_custom_role_name,
      'new_custom_role_id', p_custom_role_id,
      'new_custom_role_name', CASE WHEN p_custom_role_id IS NULL THEN NULL ELSE v_custom_role.name END,
      'new_base_role', CASE WHEN p_custom_role_id IS NULL THEN v_member.role ELSE v_custom_role.base_role END,
      'reason', p_reason,
      'clear_individual_overrides', p_clear_individual_overrides,
      'old_permissions', v_old_permissions,
      'old_sensitive_actions', v_old_sensitive_actions
    ),
    'success',
    now()
  );

  IF p_create_occurrence THEN
    INSERT INTO public.store_member_occurrences (
      store_id,
      member_id,
      user_id,
      occurrence_type,
      severity,
      title,
      description,
      occurred_at,
      visible_to_member,
      created_by,
      created_by_email,
      metadata,
      created_at,
      updated_at
    )
    VALUES (
      v_member.store_id,
      p_member_id,
      v_member.user_id,
      'role_change',
      'info',
      CASE
        WHEN p_custom_role_id IS NULL THEN 'Função personalizada removida'
        ELSE 'Função personalizada atribuída'
      END,
      CASE
        WHEN p_custom_role_id IS NULL THEN
          'Função personalizada removida.' ||
          CASE
            WHEN p_reason IS NOT NULL AND length(trim(p_reason)) > 0
              THEN ' Motivo: ' || p_reason
            ELSE ''
          END
        ELSE
          'Função personalizada atribuída: ' || v_custom_role.name ||
          ' herdando de ' || v_custom_role.base_role || '.' ||
          CASE
            WHEN p_reason IS NOT NULL AND length(trim(p_reason)) > 0
              THEN ' Motivo: ' || p_reason
            ELSE ''
          END
      END,
      now(),
      true,
      auth.uid(),
      v_actor_email,
      jsonb_build_object(
        'origin', 'assign_store_custom_role_to_member',
        'old_custom_role_id', v_old_custom_role_id,
        'old_custom_role_name', v_old_custom_role_name,
        'new_custom_role_id', p_custom_role_id,
        'new_custom_role_name', CASE WHEN p_custom_role_id IS NULL THEN NULL ELSE v_custom_role.name END,
        'new_base_role', CASE WHEN p_custom_role_id IS NULL THEN v_member.role ELSE v_custom_role.base_role END,
        'reason', p_reason,
        'actor_user_id', auth.uid(),
        'actor_name', v_actor_name,
        'actor_email', v_actor_email,
        'target_user_id', v_member.user_id,
        'target_user_name', v_target_name,
        'target_user_email', v_target_email,
        'clear_individual_overrides', p_clear_individual_overrides
      ),
      now(),
      now()
    );
  END IF;

  RETURN QUERY
  SELECT
    sm.id AS member_id,
    sm.store_id,
    sm.user_id,
    sm.role,
    sm.custom_role_id,
    scr.name AS custom_role_name,
    scr.base_role AS custom_role_base_role,
    COALESCE(sm.permissions, '{}'::jsonb) AS permissions,
    COALESCE(sm.sensitive_actions, '{}'::jsonb) AS sensitive_actions,
    sm.updated_at
  FROM public.store_members sm
  LEFT JOIN public.store_custom_roles scr
    ON scr.id = sm.custom_role_id
  WHERE sm.id = p_member_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.can_access_security_section(p_store_id uuid,p_section text,p_manage boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','auth','pg_temp'
AS $function$ SELECT public.can_access_security_section_v3(p_store_id,p_section,p_manage); $function$;

CREATE OR REPLACE FUNCTION public.change_store_member_role(p_member_id uuid, p_new_role text, p_reason text DEFAULT NULL::text, p_clear_individual_overrides boolean DEFAULT false, p_create_occurrence boolean DEFAULT true)
 RETURNS TABLE(member_id uuid, store_id uuid, user_id uuid, old_role text, new_role text, status text, permissions jsonb, sensitive_actions jsonb, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_member public.store_members%ROWTYPE;
  v_actor_name text;
  v_actor_email text;
  v_target_name text;
  v_target_email text;
  v_old_permissions jsonb;
  v_old_sensitive_actions jsonb;
  v_old_custom_role_id uuid;
  v_old_custom_role_name text;
  v_old_custom_role_base_role text;
  v_should_clear_custom_role boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  IF p_member_id IS NULL THEN
    RAISE EXCEPTION 'Membro não informado.';
  END IF;

  IF p_new_role IS NULL OR length(trim(p_new_role)) = 0 THEN
    RAISE EXCEPTION 'Nova função não informada.';
  END IF;

  IF p_new_role NOT IN (
    'admin',
    'manager',
    'stock_operator',
    'cashier',
    'sales',
    'staff',
    'viewer'
  ) THEN
    RAISE EXCEPTION 'Função inválida ou não permitida: %', p_new_role;
  END IF;

  SELECT sm.*
  INTO v_member
  FROM public.store_members sm
  WHERE sm.id = p_member_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membro não encontrado.';
  END IF;

  IF v_member.role = 'owner' THEN
    RAISE EXCEPTION 'Não é permitido alterar a função do proprietário.';
  END IF;

  IF v_member.user_id = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode alterar a sua própria função.';
  END IF;

  IF NOT public.can_access_security_section_v3(v_member.store_id, 'user_permissions', true) THEN
    RAISE EXCEPTION 'Sem permissão para alterar função de usuários.';
  END IF;

  v_old_permissions := COALESCE(v_member.permissions, '{}'::jsonb);
  v_old_sensitive_actions := COALESCE(v_member.sensitive_actions, '{}'::jsonb);
  v_old_custom_role_id := v_member.custom_role_id;

  IF v_old_custom_role_id IS NOT NULL THEN
    SELECT
      scr.name,
      scr.base_role
    INTO
      v_old_custom_role_name,
      v_old_custom_role_base_role
    FROM public.store_custom_roles scr
    WHERE scr.id = v_old_custom_role_id
      AND scr.store_id = v_member.store_id;

    v_should_clear_custom_role := COALESCE(v_old_custom_role_base_role, '') <> p_new_role;
  END IF;

  SELECT
    identity_row.user_name,
    identity_row.user_email
  INTO
    v_actor_name,
    v_actor_email
  FROM public.get_user_display_identity(auth.uid()) AS identity_row;

  SELECT
    identity_row.user_name,
    identity_row.user_email
  INTO
    v_target_name,
    v_target_email
  FROM public.get_user_display_identity(v_member.user_id) AS identity_row;

  UPDATE public.store_members sm
  SET
    role = p_new_role,
    custom_role_id = CASE
      WHEN v_should_clear_custom_role THEN NULL
      ELSE sm.custom_role_id
    END,
    permissions = CASE
      WHEN p_clear_individual_overrides THEN '{}'::jsonb
      ELSE COALESCE(sm.permissions, '{}'::jsonb)
    END,
    sensitive_actions = CASE
      WHEN p_clear_individual_overrides THEN '{}'::jsonb
      ELSE COALESCE(sm.sensitive_actions, '{}'::jsonb)
    END,
    updated_at = now()
  WHERE sm.id = p_member_id
  RETURNING
    sm.id,
    sm.store_id,
    sm.user_id,
    v_member.role,
    sm.role,
    sm.status,
    sm.permissions,
    sm.sensitive_actions,
    sm.updated_at
  INTO
    member_id,
    store_id,
    user_id,
    old_role,
    new_role,
    status,
    permissions,
    sensitive_actions,
    updated_at;

  INSERT INTO public.store_security_logs (
    store_id,
    user_id,
    user_name,
    user_email,
    action,
    details,
    outcome,
    created_at
  )
  VALUES (
    v_member.store_id,
    auth.uid(),
    v_actor_name,
    v_actor_email,
    'store_member_role_changed',
    jsonb_build_object(
      'member_id', p_member_id,
      'target_user_id', v_member.user_id,
      'target_user_name', v_target_name,
      'target_user_email', v_target_email,
      'old_role', v_member.role,
      'new_role', p_new_role,
      'reason', p_reason,
      'clear_individual_overrides', p_clear_individual_overrides,
      'old_permissions', v_old_permissions,
      'new_permissions', permissions,
      'old_sensitive_actions', v_old_sensitive_actions,
      'new_sensitive_actions', sensitive_actions,
      'old_custom_role_id', v_old_custom_role_id,
      'old_custom_role_name', v_old_custom_role_name,
      'old_custom_role_base_role', v_old_custom_role_base_role,
      'custom_role_cleared', v_should_clear_custom_role,
      'custom_role_clear_reason',
        CASE
          WHEN v_should_clear_custom_role
            THEN 'A função personalizada foi removida porque sua base não corresponde ao novo papel do usuário.'
          ELSE NULL
        END
    ),
    'success',
    now()
  );

  IF p_create_occurrence THEN
    INSERT INTO public.store_member_occurrences (
      store_id,
      member_id,
      user_id,
      occurrence_type,
      severity,
      title,
      description,
      occurred_at,
      visible_to_member,
      created_by,
      created_by_email,
      metadata,
      created_at,
      updated_at
    )
    VALUES (
      v_member.store_id,
      p_member_id,
      v_member.user_id,
      'role_change',
      'info',
      'Mudança de função',
      'Função alterada de ' || v_member.role || ' para ' || p_new_role ||
        CASE
          WHEN v_should_clear_custom_role
            THEN '. Função personalizada removida: ' || COALESCE(v_old_custom_role_name, 'não identificada') || '.'
          ELSE '.'
        END ||
        CASE
          WHEN p_reason IS NOT NULL AND length(trim(p_reason)) > 0
            THEN ' Motivo: ' || p_reason
          ELSE ''
        END,
      now(),
      true,
      auth.uid(),
      v_actor_email,
      jsonb_build_object(
        'origin', 'change_store_member_role',
        'old_role', v_member.role,
        'new_role', p_new_role,
        'reason', p_reason,
        'actor_user_id', auth.uid(),
        'actor_name', v_actor_name,
        'actor_email', v_actor_email,
        'target_user_id', v_member.user_id,
        'target_user_name', v_target_name,
        'target_user_email', v_target_email,
        'clear_individual_overrides', p_clear_individual_overrides,
        'old_custom_role_id', v_old_custom_role_id,
        'old_custom_role_name', v_old_custom_role_name,
        'old_custom_role_base_role', v_old_custom_role_base_role,
        'custom_role_cleared', v_should_clear_custom_role
      ),
      now(),
      now()
    );
  END IF;

  RETURN NEXT;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_store_custom_role(p_store_id uuid, p_name text, p_description text DEFAULT NULL::text, p_base_role text DEFAULT 'staff'::text, p_permissions jsonb DEFAULT NULL::jsonb, p_sensitive_actions jsonb DEFAULT '{}'::jsonb)
 RETURNS TABLE(id uuid, store_id uuid, name text, description text, base_role text, active boolean, permissions jsonb, sensitive_actions jsonb, created_by uuid, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_actor_name text;
  v_actor_email text;
  v_permissions jsonb := '{}'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if p_store_id is null then
    raise exception 'Loja não informada.';
  end if;

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Nome da função não informado.';
  end if;

  if p_base_role not in (
    'admin',
    'manager',
    'stock_operator',
    'cashier',
    'sales',
    'staff',
    'viewer'
  ) then
    raise exception 'Papel base inválido: %', p_base_role;
  end if;

  if not public.can_access_security_section_v3(p_store_id, 'custom_roles', true) then
    raise exception 'Sem permissão para criar funções personalizadas.';
  end if;

  /*
    Se o front enviar p_permissions, usamos o enviado.
    Se vier null, copiamos o template atual do papel base.
  */
  if p_permissions is not null then
    v_permissions := coalesce(p_permissions, '{}'::jsonb);
  else
    select coalesce(
      jsonb_object_agg(t.permission_code, t.allowed),
      '{}'::jsonb
    )
    into v_permissions
    from public.store_role_permission_templates t
    where t.store_id = p_store_id
      and t.role = p_base_role;
  end if;

  select
    identity_row.user_name,
    identity_row.user_email
  into
    v_actor_name,
    v_actor_email
  from public.get_user_display_identity(auth.uid()) as identity_row;

  return query
  insert into public.store_custom_roles (
    store_id,
    name,
    description,
    base_role,
    active,
    permissions,
    sensitive_actions,
    created_by,
    created_at,
    updated_at
  )
  values (
    p_store_id,
    trim(p_name),
    nullif(trim(coalesce(p_description, '')), ''),
    p_base_role,
    true,
    v_permissions,
    coalesce(p_sensitive_actions, '{}'::jsonb),
    auth.uid(),
    now(),
    now()
  )
  returning
    store_custom_roles.id,
    store_custom_roles.store_id,
    store_custom_roles.name,
    store_custom_roles.description,
    store_custom_roles.base_role,
    store_custom_roles.active,
    store_custom_roles.permissions,
    store_custom_roles.sensitive_actions,
    store_custom_roles.created_by,
    store_custom_roles.created_at,
    store_custom_roles.updated_at;

  insert into public.store_security_logs (
    store_id,
    user_id,
    user_name,
    user_email,
    action,
    details,
    outcome,
    created_at
  )
  values (
    p_store_id,
    auth.uid(),
    v_actor_name,
    v_actor_email,
    'store_custom_role_created',
    jsonb_build_object(
      'name', trim(p_name),
      'base_role', p_base_role,
      'permissions_source',
        case when p_permissions is null then 'base_role_template' else 'manual_payload' end,
      'permissions', v_permissions,
      'sensitive_actions', coalesce(p_sensitive_actions, '{}'::jsonb)
    ),
    'success',
    now()
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_store_member_invite(p_store_id uuid, p_email text, p_role text DEFAULT 'staff'::text, p_permissions jsonb DEFAULT '{}'::jsonb, p_sensitive_actions jsonb DEFAULT '{}'::jsonb, p_expires_in_days integer DEFAULT 7)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_email text;
  v_actor_email text;
  v_existing_user_id uuid;
  v_existing_member_id uuid;
  v_invite_id uuid;
  v_expires_at timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  IF p_email IS NULL OR btrim(p_email) = '' THEN
    RAISE EXCEPTION 'E-mail do usuário é obrigatório.';
  END IF;

  v_email := lower(btrim(p_email));

  IF p_role NOT IN (
    'admin',
    'manager',
    'stock_operator',
    'cashier',
    'sales',
    'viewer',
    'staff'
  ) THEN
    RAISE EXCEPTION 'Papel inválido para convite: %', p_role;
  END IF;

  IF p_expires_in_days IS NULL OR p_expires_in_days < 1 OR p_expires_in_days > 30 THEN
    RAISE EXCEPTION 'Validade do convite deve estar entre 1 e 30 dias.';
  END IF;

  IF NOT (
    public.app_is_store_owner(p_store_id)
    OR public.user_has_store_permission(p_store_id, 'users.manage')
  ) THEN
    RAISE EXCEPTION 'Você não tem permissão para convidar usuários.';
  END IF;

  if not public.can_access_security_section_v3(p_store_id, 'user_permissions', true)
    and (p_role <> 'staff' or coalesce(p_permissions,'{}'::jsonb) <> '{}'::jsonb
       or coalesce(p_sensitive_actions,'{}'::jsonb) <> '{}'::jsonb) then
    raise exception 'Alterar papel/permissões exige autorização da Central de Segurança.';
  end if;

  SELECT email::text
  INTO v_actor_email
  FROM auth.users
  WHERE id = auth.uid();

  SELECT au.id
  INTO v_existing_user_id
  FROM auth.users au
  WHERE lower(au.email::text) = v_email
  LIMIT 1;

  IF v_existing_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode convidar seu próprio e-mail.';
  END IF;

  IF v_existing_user_id IS NOT NULL THEN
    SELECT sm.id
    INTO v_existing_member_id
    FROM public.store_members sm
    WHERE sm.store_id = p_store_id
      AND sm.user_id = v_existing_user_id
      AND sm.status = 'active'
    LIMIT 1;

    IF v_existing_member_id IS NOT NULL THEN
      RAISE EXCEPTION 'Este usuário já é membro ativo desta loja.';
    END IF;
  END IF;

  v_expires_at := now() + make_interval(days => p_expires_in_days);

  INSERT INTO public.store_member_invites (
    store_id,
    email,
    role,
    status,
    invited_by,
    invited_by_email,
    invited_at,
    expires_at,
    permissions,
    sensitive_actions,
    metadata
  )
  VALUES (
    p_store_id,
    v_email,
    p_role,
    'pending',
    auth.uid(),
    v_actor_email,
    now(),
    v_expires_at,
    COALESCE(p_permissions, '{}'::jsonb),
    COALESCE(p_sensitive_actions, '{}'::jsonb),
    jsonb_build_object(
      'target_user_exists_in_auth', v_existing_user_id IS NOT NULL,
      'target_user_id', v_existing_user_id
    )
  )
  ON CONFLICT (store_id, normalized_email)
  WHERE status = 'pending'
  DO UPDATE SET
    role = EXCLUDED.role,
    invited_by = EXCLUDED.invited_by,
    invited_by_email = EXCLUDED.invited_by_email,
    invited_at = now(),
    expires_at = EXCLUDED.expires_at,
    permissions = EXCLUDED.permissions,
    sensitive_actions = EXCLUDED.sensitive_actions,
    metadata = EXCLUDED.metadata,
    updated_at = now()
  RETURNING id
  INTO v_invite_id;

  INSERT INTO public.store_security_logs (
    store_id,
    user_id,
    user_email,
    action,
    details,
    outcome,
    created_at
  )
  VALUES (
    p_store_id,
    auth.uid(),
    v_actor_email,
    'store_member_invite_created',
    jsonb_build_object(
      'invite_id', v_invite_id,
      'target_email', v_email,
      'target_user_exists_in_auth', v_existing_user_id IS NOT NULL,
      'target_user_id', v_existing_user_id,
      'role', p_role,
      'expires_at', v_expires_at
    ),
    'success',
    now()
  );

  RETURN jsonb_build_object(
    'mode', 'pending_invite',
    'invite_id', v_invite_id,
    'store_id', p_store_id,
    'email', v_email,
    'role', p_role,
    'status', 'pending',
    'expires_at', v_expires_at,
    'target_user_exists_in_auth', v_existing_user_id IS NOT NULL
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_store_member_occurrence_v2(p_member_id uuid, p_occurrence_type text, p_severity text DEFAULT 'info'::text, p_title text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_occurred_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_visible_to_member boolean DEFAULT false, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS TABLE(occurrence_id uuid, member_id uuid, store_id uuid, user_id uuid, occurrence_type text, severity text, title text, description text, occurred_at timestamp with time zone, visible_to_member boolean, member_status text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_member public.store_members%ROWTYPE;

  v_actor_name text;
  v_actor_email text;
  v_target_name text;
  v_target_email text;

  v_old_status text;
  v_old_role text;
  v_old_custom_role_id uuid;

  v_new_role text;
  v_new_custom_role_id uuid;
  v_new_custom_role_base_role text;
  v_clear_individual_overrides boolean := false;

  v_final_title text;
  v_final_description text;
  v_effective_occurred_at timestamp with time zone;
  v_occurrence_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  IF p_member_id IS NULL THEN
    RAISE EXCEPTION 'Membro não informado.';
  END IF;

  IF p_occurrence_type IS NULL OR length(trim(p_occurrence_type)) = 0 THEN
    RAISE EXCEPTION 'Tipo de ocorrência não informado.';
  END IF;

  IF p_occurrence_type NOT IN (
    'admission',
    'suspension',
    'note',
    'warning',
    'praise',
    'training',
    'incident',
    'role_change',
    'absence',
    'exit',
    'other'
  ) THEN
    RAISE EXCEPTION 'Tipo de ocorrência inválido: %', p_occurrence_type;
  END IF;

  IF p_severity NOT IN ('info', 'low', 'medium', 'high', 'critical') THEN
    RAISE EXCEPTION 'Severidade inválida: %', p_severity;
  END IF;

  SELECT *
  INTO v_member
  FROM public.store_members
  WHERE id = p_member_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membro não encontrado.';
  END IF;

  IF NOT (
    public.app_is_store_owner(v_member.store_id)
    OR public.user_has_store_permission(v_member.store_id, 'users.manage')
    OR public.user_has_store_permission(v_member.store_id, 'security.manage')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para registrar ocorrência de usuário.';
  END IF;

  v_final_description := COALESCE(NULLIF(trim(p_description), ''), '');

  IF p_occurrence_type IN ('admission', 'suspension', 'exit')
     AND length(v_final_description) = 0 THEN
    RAISE EXCEPTION 'Informe o motivo/descrição para esta ocorrência.';
  END IF;

  IF p_occurrence_type IN ('suspension', 'exit') THEN
    IF v_member.user_id = auth.uid() THEN
      RAISE EXCEPTION 'Você não pode suspender ou desligar seu próprio usuário por esta rotina.';
    END IF;

    IF v_member.role = 'owner' THEN
      RAISE EXCEPTION 'Não é permitido suspender ou desligar o proprietário principal por esta rotina.';
    END IF;
  END IF;

  SELECT
    identity_row.user_name,
    identity_row.user_email
  INTO
    v_actor_name,
    v_actor_email
  FROM public.get_user_display_identity(auth.uid()) AS identity_row;

  SELECT
    identity_row.user_name,
    identity_row.user_email
  INTO
    v_target_name,
    v_target_email
  FROM public.get_user_display_identity(v_member.user_id) AS identity_row;

  if p_occurrence_type='role_change'
    or (p_occurrence_type='admission' and (
      (nullif(trim(coalesce(p_metadata->>'new_role','')),'') is not null
        and nullif(trim(coalesce(p_metadata->>'new_role','')),'') is distinct from v_member.role)
      or coalesce(p_metadata ? 'new_custom_role_id',false)
      or coalesce((p_metadata->>'clear_individual_overrides')::boolean,false)
    )) then
    if v_member.role='owner' or v_member.user_id=auth.uid() then
      raise exception 'Não é permitido alterar privilégios do proprietário ou os próprios.';
    end if;
    if not public.can_access_security_section_v3(v_member.store_id,'user_permissions',true) then
      raise exception 'Alterar papel ou função exige permissão de Segurança.';
    end if;
  end if;

  v_old_status := v_member.status;
  v_old_role := v_member.role;
  v_old_custom_role_id := v_member.custom_role_id;

  v_effective_occurred_at := COALESCE(p_occurred_at, now());

  v_final_title := COALESCE(
    NULLIF(trim(p_title), ''),
    CASE
      WHEN p_occurrence_type = 'admission' THEN 'Admissão / início de acesso'
      WHEN p_occurrence_type = 'suspension' THEN 'Suspensão temporária de acesso'
      WHEN p_occurrence_type = 'exit' THEN 'Desligamento do usuário'
      WHEN p_occurrence_type = 'role_change' THEN 'Alteração de função'
      WHEN p_occurrence_type = 'absence' THEN 'Ausência'
      WHEN p_occurrence_type = 'incident' THEN 'Incidente'
      WHEN p_occurrence_type = 'training' THEN 'Treinamento'
      WHEN p_occurrence_type = 'warning' THEN 'Advertência'
      WHEN p_occurrence_type = 'praise' THEN 'Elogio'
      WHEN p_occurrence_type = 'note' THEN 'Observação'
      ELSE 'Ocorrência do usuário'
    END
  );

  IF p_occurrence_type IN ('admission', 'role_change') THEN
    v_new_role := NULLIF(trim(COALESCE(p_metadata->>'new_role', '')), '');

    IF v_new_role IS NOT NULL
       AND v_new_role NOT IN (
        'admin',
        'manager',
        'stock_operator',
        'cashier',
        'sales',
        'staff',
        'viewer'
       ) THEN
      RAISE EXCEPTION 'Papel informado é inválido: %', v_new_role;
    END IF;

    IF p_metadata ? 'new_custom_role_id'
       AND NULLIF(trim(COALESCE(p_metadata->>'new_custom_role_id', '')), '') IS NOT NULL THEN
      v_new_custom_role_id := (p_metadata->>'new_custom_role_id')::uuid;

      SELECT scr.base_role
      INTO v_new_custom_role_base_role
      FROM public.store_custom_roles scr
      WHERE scr.id = v_new_custom_role_id
        AND scr.store_id = v_member.store_id
        AND scr.active = true;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Função personalizada não encontrada ou inativa.';
      END IF;

      IF COALESCE(v_new_role, v_member.role) <> v_new_custom_role_base_role THEN
        RAISE EXCEPTION 'A função personalizada selecionada não é compatível com o papel informado.';
      END IF;
    ELSE
      v_new_custom_role_id := NULL;
    END IF;

    v_clear_individual_overrides :=
      COALESCE((p_metadata->>'clear_individual_overrides')::boolean, false);
  END IF;

  INSERT INTO public.store_member_occurrences (
    store_id,
    member_id,
    user_id,
    occurrence_type,
    severity,
    title,
    description,
    occurred_at,
    visible_to_member,
    created_by,
    created_by_email,
    metadata,
    created_at,
    updated_at
  )
  VALUES (
    v_member.store_id,
    p_member_id,
    v_member.user_id,
    p_occurrence_type,
    p_severity,
    v_final_title,
    v_final_description,
    v_effective_occurred_at,
    COALESCE(p_visible_to_member, false),
    auth.uid(),
    v_actor_email,
    COALESCE(p_metadata, '{}'::jsonb)
      || jsonb_build_object(
        'actor_name', v_actor_name,
        'actor_email', v_actor_email,
        'target_user_name', v_target_name,
        'target_user_email', v_target_email,
        'old_status', v_old_status,
        'old_role', v_old_role,
        'old_custom_role_id', v_old_custom_role_id,
        'effective_occurred_at', v_effective_occurred_at,
        'origin', 'create_store_member_occurrence_v2'
      ),
    now(),
    now()
  )
  RETURNING id
  INTO v_occurrence_id;

  IF p_occurrence_type = 'admission' THEN
    UPDATE public.store_members sm
    SET
      status = 'active',
      role = COALESCE(v_new_role, sm.role),
      custom_role_id = CASE
        WHEN p_metadata ? 'new_custom_role_id' THEN v_new_custom_role_id
        ELSE sm.custom_role_id
      END,
      permissions = CASE
        WHEN v_clear_individual_overrides THEN '{}'::jsonb
        ELSE COALESCE(sm.permissions, '{}'::jsonb)
      END,
      sensitive_actions = CASE
        WHEN v_clear_individual_overrides THEN '{}'::jsonb
        ELSE COALESCE(sm.sensitive_actions, '{}'::jsonb)
      END,
      started_at = v_effective_occurred_at,
      ended_at = NULL,
      exit_reason = NULL,
      status_reason = v_final_description,
      updated_at = now()
    WHERE sm.id = p_member_id;

  ELSIF p_occurrence_type = 'suspension' THEN
    UPDATE public.store_members sm
    SET
      status = 'suspended',
      status_reason = v_final_description,
      updated_at = now()
    WHERE sm.id = p_member_id;

  ELSIF p_occurrence_type = 'exit' THEN
    UPDATE public.store_members sm
    SET
      status = 'inactive',
      ended_at = v_effective_occurred_at,
      exit_reason = v_final_description,
      status_reason = v_final_description,
      updated_at = now()
    WHERE sm.id = p_member_id;

  ELSIF p_occurrence_type = 'role_change' THEN
    UPDATE public.store_members sm
    SET
      role = COALESCE(v_new_role, sm.role),
      custom_role_id = CASE
        WHEN p_metadata ? 'new_custom_role_id' THEN v_new_custom_role_id
        ELSE sm.custom_role_id
      END,
      permissions = CASE
        WHEN v_clear_individual_overrides THEN '{}'::jsonb
        ELSE COALESCE(sm.permissions, '{}'::jsonb)
      END,
      sensitive_actions = CASE
        WHEN v_clear_individual_overrides THEN '{}'::jsonb
        ELSE COALESCE(sm.sensitive_actions, '{}'::jsonb)
      END,
      status_reason = v_final_description,
      updated_at = now()
    WHERE sm.id = p_member_id;
  END IF;

  INSERT INTO public.store_security_logs (
    store_id,
    user_id,
    user_name,
    user_email,
    action,
    details,
    outcome,
    created_at
  )
  VALUES (
    v_member.store_id,
    auth.uid(),
    v_actor_name,
    v_actor_email,
    CASE
      WHEN p_occurrence_type = 'admission' THEN 'store_member_admission_registered'
      WHEN p_occurrence_type = 'suspension' THEN 'store_member_suspension_registered'
      WHEN p_occurrence_type = 'exit' THEN 'store_member_exit_registered'
      WHEN p_occurrence_type = 'role_change' THEN 'store_member_role_changed_by_occurrence'
      ELSE 'store_member_occurrence_created'
    END,
    jsonb_build_object(
      'member_id', p_member_id,
      'target_user_id', v_member.user_id,
      'target_user_name', v_target_name,
      'target_user_email', v_target_email,
      'old_status', v_old_status,
      'new_status',
        CASE
          WHEN p_occurrence_type = 'admission' THEN 'active'
          WHEN p_occurrence_type = 'suspension' THEN 'suspended'
          WHEN p_occurrence_type = 'exit' THEN 'inactive'
          ELSE v_old_status
        END,
      'old_role', v_old_role,
      'new_role', COALESCE(v_new_role, v_old_role),
      'old_custom_role_id', v_old_custom_role_id,
      'new_custom_role_id',
        CASE
          WHEN p_occurrence_type IN ('admission', 'role_change') AND p_metadata ? 'new_custom_role_id'
            THEN v_new_custom_role_id
          ELSE v_old_custom_role_id
        END,
      'occurrence_id', v_occurrence_id,
      'occurrence_type', p_occurrence_type,
      'severity', p_severity,
      'title', v_final_title,
      'description', v_final_description,
      'occurred_at', v_effective_occurred_at
    ),
    'success',
    now()
  );

  RETURN QUERY
  SELECT
    smo.id AS occurrence_id,
    smo.member_id,
    smo.store_id,
    smo.user_id,
    smo.occurrence_type,
    smo.severity,
    smo.title,
    smo.description,
    smo.occurred_at,
    smo.visible_to_member,
    sm.status AS member_status,
    smo.created_at
  FROM public.store_member_occurrences smo
  JOIN public.store_members sm
    ON sm.id = smo.member_id
  WHERE smo.id = v_occurrence_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_store_member_permission_detail(p_member_id uuid)
 RETURNS TABLE(member_id uuid, store_id uuid, user_id uuid, user_name text, user_email text, role text, status text, permission_code text, module text, action text, label text, description text, risk_level text, role_allowed boolean, override_value boolean, effective_allowed boolean, source text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  WITH member_base AS (
    SELECT
      sm.id AS member_id,
      sm.store_id,
      sm.user_id,
      COALESCE(p.name, au.email::text, sm.user_id::text) AS user_name,
      au.email::text AS user_email,
      sm.role,
      sm.status,
      COALESCE(sm.permissions, '{}'::jsonb) AS permissions
    FROM public.store_members sm
    LEFT JOIN public.profiles p
      ON p.id = sm.user_id
    LEFT JOIN auth.users au
      ON au.id = sm.user_id
    WHERE sm.id = p_member_id
  )
  SELECT
    mb.member_id,
    mb.store_id,
    mb.user_id,
    mb.user_name,
    mb.user_email,
    mb.role,
    mb.status,

    c.code AS permission_code,
    c.module,
    c.action,
    c.label,
    c.description,
    c.risk_level,

    COALESCE(t.allowed, false) AS role_allowed,

    CASE
      WHEN mb.permissions ? c.code THEN (mb.permissions ->> c.code)::boolean
      ELSE NULL
    END AS override_value,

    CASE
      WHEN mb.role = 'owner' THEN true
      WHEN COALESCE((mb.permissions ->> 'all')::boolean, false) THEN true
      WHEN mb.permissions ? c.code THEN COALESCE((mb.permissions ->> c.code)::boolean, false)
      ELSE COALESCE(t.allowed, false)
    END AS effective_allowed,

    CASE
      WHEN mb.role = 'owner' THEN 'owner'
      WHEN COALESCE((mb.permissions ->> 'all')::boolean, false) THEN 'member_override_all'
      WHEN mb.permissions ? c.code THEN 'member_override'
      WHEN t.permission_code IS NOT NULL THEN 'role_template'
      ELSE 'default_denied'
    END AS source

  FROM member_base mb
  CROSS JOIN public.security_permission_catalog c
  LEFT JOIN public.store_role_permission_templates t
    ON t.store_id = mb.store_id
   AND t.role = mb.role
   AND t.permission_code = c.code
  WHERE c.active = true
    AND public.can_access_security_section_v3(mb.store_id,'user_permissions',false)
  ORDER BY c.sort_order, c.module, c.action, c.code;
$function$;

CREATE OR REPLACE FUNCTION public.get_store_members_for_permissions(p_store_id uuid)
 RETURNS TABLE(member_id uuid, store_id uuid, user_id uuid, user_name text, user_email text, role text, status text, permissions jsonb, sensitive_actions jsonb, created_at timestamp with time zone, updated_at timestamp with time zone, custom_role_id uuid, custom_role_name text, profile_avatar_url text, avatar_url text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select
    sm.id as member_id,
    sm.store_id,
    sm.user_id,
    coalesce(p.name, au.raw_user_meta_data->>'display_name', au.raw_user_meta_data->>'name', au.email, sm.user_id::text)::text as user_name,
    au.email::text as user_email,
    sm.role,
    sm.status,
    coalesce(sm.permissions, '{}'::jsonb) as permissions,
    coalesce(sm.sensitive_actions, '{}'::jsonb) as sensitive_actions,
    sm.created_at,
    sm.updated_at,
    sm.custom_role_id,
    scr.name::text as custom_role_name,
    p.avatar_url::text as profile_avatar_url,
    coalesce(sm.member_avatar_url, p.avatar_url)::text as avatar_url
  from public.store_members sm
  left join public.profiles p on p.id = sm.user_id
  left join auth.users au on au.id = sm.user_id
  left join public.store_custom_roles scr
    on scr.id = sm.custom_role_id
   and scr.store_id = sm.store_id
   and scr.active = true
  where sm.store_id = p_store_id
    and sm.status = 'active'
    and sm.role <> 'owner'
    and public.can_access_security_section_v3(p_store_id,'user_permissions',false)
  order by
    case sm.role
      when 'admin' then 1
      when 'manager' then 2
      when 'stock_operator' then 3
      when 'cashier' then 4
      when 'sales' then 5
      when 'staff' then 6
      when 'viewer' then 7
      else 99
    end,
    coalesce(p.name, au.email, sm.user_id::text);
$function$;

CREATE OR REPLACE FUNCTION public.get_store_security_activity_logs(p_store_id uuid, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_user_filter text DEFAULT NULL::text, p_action_filter text DEFAULT NULL::text, p_outcome text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, store_id uuid, user_id uuid, user_name text, user_email text, action text, display_action text, details jsonb, outcome text, sensitive boolean, visible_to_member boolean, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if p_store_id is null then
    raise exception 'Loja não informada.';
  end if;

  if not public.can_access_security_section_v3(p_store_id,'logs',false) then
    raise exception 'Acesso não autorizado aos logs da loja.';
  end if;

  return query
  select
    l.id,
    l.store_id,
    l.user_id,
    l.user_name,
    l.user_email,
    l.action,
    coalesce(l.display_action, public.translate_security_action_ptbr(l.action)) as display_action,
    l.details,
    l.outcome,
    l.sensitive,
    l.visible_to_member,
    l.created_at
  from public.store_security_logs l
  where l.store_id = p_store_id
    and (p_start_date is null or l.created_at::date >= p_start_date)
    and (p_end_date is null or l.created_at::date <= p_end_date)
    and (
      p_user_filter is null
      or l.user_name ilike '%' || p_user_filter || '%'
      or l.user_email ilike '%' || p_user_filter || '%'
    )
    and (
      p_action_filter is null
      or l.action ilike '%' || p_action_filter || '%'
      or coalesce(l.display_action, public.translate_security_action_ptbr(l.action)) ilike '%' || p_action_filter || '%'
    )
    and (p_outcome is null or l.outcome = p_outcome)
  order by l.created_at desc;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_store_security_logs(p_limit integer DEFAULT 50)
 RETURNS SETOF store_security_logs
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
  SELECT ssl.*
  FROM public.store_security_logs ssl
  WHERE public.can_access_security_section_v3(ssl.store_id,'logs',false)
  ORDER BY ssl.created_at DESC
  LIMIT greatest(1, least(coalesce(p_limit, 50), 200));
$function$;

CREATE OR REPLACE FUNCTION public.get_store_security_logs(p_store_id uuid, p_limit integer DEFAULT 200, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_user text DEFAULT NULL::text, p_action text DEFAULT NULL::text, p_outcome text DEFAULT NULL::text)
 RETURNS SETOF store_security_logs
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
  SELECT ssl.*
  FROM public.store_security_logs ssl
  WHERE ssl.store_id = p_store_id
    AND public.can_access_security_section_v3(p_store_id,'logs',false)
    AND (
      p_date_from IS NULL
      OR ssl.created_at >= (p_date_from::timestamp AT TIME ZONE 'America/Sao_Paulo')
    )
    AND (
      p_date_to IS NULL
      OR ssl.created_at < ((p_date_to + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
    )
    AND (
      p_user IS NULL
      OR (
        COALESCE(ssl.user_name, '') || ' ' || COALESCE(ssl.user_email, '')
      ) ILIKE '%' || p_user || '%'
    )
    AND (
      p_action IS NULL
      OR COALESCE(ssl.action, '') ILIKE '%' || p_action || '%'
    )
    AND (
      p_outcome IS NULL
      OR COALESCE(ssl.outcome, '') = p_outcome
    )
  ORDER BY ssl.created_at DESC
  LIMIT greatest(1, least(coalesce(p_limit, 200), 500));
$function$;

CREATE OR REPLACE FUNCTION public.get_store_sensitive_action_matrix(p_store_id uuid)
 RETURNS TABLE(action_code text, module text, label text, description text, risk_level text, active boolean, enabled boolean, requirement text, min_role text, token_enabled boolean, token_expiry_seconds integer, max_attempts integer, require_reason boolean, source text, sort_order integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    c.code AS action_code,
    c.module,
    c.label,
    c.description,
    c.risk_level,
    c.active,
    COALESCE(r.enabled, false) AS enabled,
    COALESCE(r.requirement, 'none') AS requirement,
    COALESCE(r.min_role, 'owner') AS min_role,
    COALESCE(r.token_enabled, false) AS token_enabled,
    COALESCE(r.token_expiry_seconds, 15) AS token_expiry_seconds,
    COALESCE(r.max_attempts, 3) AS max_attempts,
    COALESCE(r.require_reason, true) AS require_reason,
    COALESCE(r.source, 'default_denied') AS source,
    c.sort_order
  FROM public.security_sensitive_action_catalog c
  LEFT JOIN public.store_sensitive_action_rules r
    ON r.store_id = p_store_id
   AND r.action_code = c.code
  WHERE c.active = true
    AND public.can_access_security_section_v3(p_store_id,'sensitive_actions',false)
  ORDER BY c.sort_order, c.module, c.code;
$function$;

CREATE OR REPLACE FUNCTION public.list_store_custom_roles(p_store_id uuid, p_include_inactive boolean DEFAULT false)
 RETURNS TABLE(id uuid, store_id uuid, name text, description text, base_role text, active boolean, permissions jsonb, sensitive_actions jsonb, created_by uuid, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select
    scr.id,
    scr.store_id,
    scr.name,
    scr.description,
    scr.base_role,
    scr.active,
    scr.permissions,
    scr.sensitive_actions,
    scr.created_by,
    scr.created_at,
    scr.updated_at
  from public.store_custom_roles scr
  where scr.store_id = p_store_id
    and (
      p_include_inactive
      or scr.active = true
    )
    and (public.can_access_security_section_v3(p_store_id,'custom_roles',false) or public.can_access_security_section_v3(p_store_id,'user_permissions',false))
  order by
    scr.active desc,
    case scr.base_role
      when 'admin' then 1
      when 'manager' then 2
      when 'stock_operator' then 3
      when 'cashier' then 4
      when 'sales' then 5
      when 'staff' then 6
      when 'viewer' then 7
      else 99
    end,
    scr.name;
$function$;

CREATE OR REPLACE FUNCTION public.update_security_log_member_visibility(p_log_id uuid, p_visible_to_member boolean, p_sensitive boolean DEFAULT NULL::boolean)
 RETURNS TABLE(id uuid, sensitive boolean, visible_to_member boolean, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_store_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado.';
  end if;

  select l.store_id
  into v_store_id
  from public.store_security_logs l
  where l.id = p_log_id;

  if v_store_id is null then
    raise exception 'Log não encontrado.';
  end if;

  if not public.can_access_security_section_v3(v_store_id,'logs',true) then
    raise exception 'Você não tem permissão para alterar a visibilidade deste log.';
  end if;

  update public.store_security_logs l
  set
    visible_to_member = coalesce(p_visible_to_member, l.visible_to_member),
    sensitive = coalesce(p_sensitive, l.sensitive)
  where l.id = p_log_id;

  return query
  select
    l.id,
    l.sensitive,
    l.visible_to_member,
    now() as updated_at
  from public.store_security_logs l
  where l.id = p_log_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.update_store_custom_role(p_custom_role_id uuid, p_name text, p_description text DEFAULT NULL::text, p_base_role text DEFAULT NULL::text, p_active boolean DEFAULT true, p_permissions jsonb DEFAULT '{}'::jsonb, p_sensitive_actions jsonb DEFAULT '{}'::jsonb, p_reason text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, store_id uuid, name text, description text, base_role text, active boolean, permissions jsonb, sensitive_actions jsonb, created_by uuid, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_role public.store_custom_roles%rowtype;
  v_actor_name text;
  v_actor_email text;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado.';
  end if;

  select scr.*
  into v_role
  from public.store_custom_roles scr
  where scr.id = p_custom_role_id
  for update;

  if not found then
    raise exception 'Função personalizada não encontrada.';
  end if;

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Nome da função não informado.';
  end if;

  if coalesce(p_base_role, v_role.base_role) not in (
    'admin',
    'manager',
    'stock_operator',
    'cashier',
    'sales',
    'staff',
    'viewer'
  ) then
    raise exception 'Papel base inválido: %', p_base_role;
  end if;

  if not public.can_access_security_section_v3(v_role.store_id, 'custom_roles', true) then
    raise exception 'Sem permissão para alterar funções personalizadas.';
  end if;

  select
    identity_row.user_name,
    identity_row.user_email
  into
    v_actor_name,
    v_actor_email
  from public.get_user_display_identity(auth.uid()) as identity_row;

  update public.store_custom_roles scr
  set
    name = trim(p_name),
    description = nullif(trim(coalesce(p_description, '')), ''),
    base_role = coalesce(p_base_role, scr.base_role),
    active = coalesce(p_active, scr.active),
    permissions = coalesce(p_permissions, '{}'::jsonb),
    sensitive_actions = coalesce(p_sensitive_actions, '{}'::jsonb),
    updated_at = now()
  where scr.id = p_custom_role_id;

  insert into public.store_security_logs (
    store_id,
    user_id,
    user_name,
    user_email,
    action,
    details,
    outcome,
    created_at
  )
  values (
    v_role.store_id,
    auth.uid(),
    v_actor_name,
    v_actor_email,
    'store_custom_role_updated',
    jsonb_build_object(
      'custom_role_id', p_custom_role_id,
      'old_name', v_role.name,
      'new_name', trim(p_name),
      'old_base_role', v_role.base_role,
      'new_base_role', coalesce(p_base_role, v_role.base_role),
      'old_active', v_role.active,
      'new_active', coalesce(p_active, v_role.active),
      'old_permissions', v_role.permissions,
      'new_permissions', coalesce(p_permissions, '{}'::jsonb),
      'old_sensitive_actions', v_role.sensitive_actions,
      'new_sensitive_actions', coalesce(p_sensitive_actions, '{}'::jsonb),
      'reason', p_reason
    ),
    'success',
    now()
  );

  return query
  select
    scr.id,
    scr.store_id,
    scr.name,
    scr.description,
    scr.base_role,
    scr.active,
    scr.permissions,
    scr.sensitive_actions,
    scr.created_by,
    scr.created_at,
    scr.updated_at
  from public.store_custom_roles scr
  where scr.id = p_custom_role_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.update_store_member_permissions(p_member_id uuid, p_permissions jsonb, p_sensitive_actions jsonb DEFAULT NULL::jsonb, p_reason text DEFAULT NULL::text)
 RETURNS TABLE(member_id uuid, permissions jsonb, sensitive_actions jsonb, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_member public.store_members%rowtype;
  v_actor_name text;
  v_actor_email text;
  v_target_name text;
  v_target_email text;
  v_old_permissions jsonb;
  v_old_sensitive_actions jsonb;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if p_member_id is null then
    raise exception 'Membro não informado.';
  end if;

  select sm.*
  into v_member
  from public.store_members sm
  where sm.id = p_member_id
  for update;

  if not found then
    raise exception 'Membro não encontrado.';
  end if;

  if v_member.role = 'owner' then
    raise exception 'Não é permitido alterar permissões individuais do proprietário.';
  end if;

  if v_member.user_id = auth.uid() then
    raise exception 'Você não pode alterar suas próprias permissões individuais.';
  end if;

  if not public.can_access_security_section_v3(v_member.store_id, 'user_permissions', true) then
    raise exception 'Você não tem permissão para alterar permissões individuais.';
  end if;

  if p_permissions is not null
     and jsonb_typeof(p_permissions) <> 'object' then
    raise exception 'Permissões individuais devem ser um objeto JSON.';
  end if;

  if p_sensitive_actions is not null
     and jsonb_typeof(p_sensitive_actions) <> 'object' then
    raise exception 'Ações sensíveis devem ser um objeto JSON.';
  end if;

  v_old_permissions := coalesce(v_member.permissions, '{}'::jsonb);
  v_old_sensitive_actions := coalesce(v_member.sensitive_actions, '{}'::jsonb);

  select
    identity_row.user_name,
    identity_row.user_email
  into
    v_actor_name,
    v_actor_email
  from public.get_user_display_identity(auth.uid()) as identity_row;

  select
    identity_row.user_name,
    identity_row.user_email
  into
    v_target_name,
    v_target_email
  from public.get_user_display_identity(v_member.user_id) as identity_row;

  update public.store_members sm
  set
    permissions = coalesce(p_permissions, '{}'::jsonb),
    sensitive_actions = coalesce(
      p_sensitive_actions,
      sm.sensitive_actions,
      '{}'::jsonb
    ),
    updated_at = now()
  where sm.id = p_member_id;

  insert into public.store_security_logs (
    store_id,
    user_id,
    user_name,
    user_email,
    action,
    details,
    outcome,
    created_at
  )
  values (
    v_member.store_id,
    auth.uid(),
    v_actor_name,
    v_actor_email,
    'store_member_permissions_updated',
    jsonb_build_object(
      'member_id', p_member_id,
      'target_user_id', v_member.user_id,
      'target_user_name', v_target_name,
      'target_user_email', v_target_email,
      'role', v_member.role,
      'custom_role_id', v_member.custom_role_id,
      'old_permissions', v_old_permissions,
      'new_permissions', coalesce(p_permissions, '{}'::jsonb),
      'old_sensitive_actions', v_old_sensitive_actions,
      'new_sensitive_actions', coalesce(
        p_sensitive_actions,
        v_old_sensitive_actions,
        '{}'::jsonb
      ),
      'reason', p_reason
    ),
    'success',
    now()
  );

  return query
  select
    sm.id,
    coalesce(sm.permissions, '{}'::jsonb),
    coalesce(sm.sensitive_actions, '{}'::jsonb),
    sm.updated_at
  from public.store_members sm
  where sm.id = p_member_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.update_store_sensitive_action_rule(p_store_id uuid, p_action_code text, p_enabled boolean, p_requirement text, p_min_role text, p_token_enabled boolean DEFAULT false, p_token_expiry_seconds integer DEFAULT 15, p_max_attempts integer DEFAULT 3, p_require_reason boolean DEFAULT true, p_reason text DEFAULT NULL::text)
 RETURNS TABLE(store_id uuid, action_code text, enabled boolean, requirement text, min_role text, token_enabled boolean, token_expiry_seconds integer, max_attempts integer, require_reason boolean, source text, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_old_rule jsonb;
  v_new_rule jsonb;
  v_actor_name text;
  v_actor_email text;
  v_exists boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  IF p_store_id IS NULL THEN
    RAISE EXCEPTION 'Loja não informada.';
  END IF;

  IF p_action_code IS NULL OR length(trim(p_action_code)) = 0 THEN
    RAISE EXCEPTION 'Ação sensível não informada.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.security_sensitive_action_catalog c
    WHERE c.code = p_action_code
      AND c.active = true
  ) THEN
    RAISE EXCEPTION 'Ação sensível inválida ou inativa: %', p_action_code;
  END IF;

  IF p_requirement NOT IN ('none', 'pin', 'token', 'pin_and_token') THEN
    RAISE EXCEPTION 'Requisito inválido: %', p_requirement;
  END IF;

  IF p_min_role NOT IN ('owner', 'admin', 'manager', 'stock_operator', 'cashier', 'sales', 'staff', 'viewer') THEN
    RAISE EXCEPTION 'Papel mínimo inválido: %', p_min_role;
  END IF;

  IF p_token_expiry_seconds IS NULL OR p_token_expiry_seconds < 5 OR p_token_expiry_seconds > 3600 THEN
    RAISE EXCEPTION 'Tempo de expiração do token deve ficar entre 5 e 3600 segundos.';
  END IF;

  IF p_max_attempts IS NULL OR p_max_attempts < 1 OR p_max_attempts > 10 THEN
    RAISE EXCEPTION 'Número máximo de tentativas deve ficar entre 1 e 10.';
  END IF;

  IF NOT public.can_access_security_section_v3(p_store_id,'sensitive_actions',true) THEN
    RAISE EXCEPTION 'Sem permissão para alterar regras de ações sensíveis.';
  END IF;

  SELECT
    jsonb_build_object(
      'enabled', r.enabled,
      'requirement', r.requirement,
      'min_role', r.min_role,
      'token_enabled', r.token_enabled,
      'token_expiry_seconds', r.token_expiry_seconds,
      'max_attempts', r.max_attempts,
      'require_reason', r.require_reason,
      'source', r.source
    ),
    true
  INTO
    v_old_rule,
    v_exists
  FROM public.store_sensitive_action_rules r
  WHERE r.store_id = p_store_id
    AND r.action_code = p_action_code
  FOR UPDATE;

  SELECT
    identity_row.user_name,
    identity_row.user_email
  INTO
    v_actor_name,
    v_actor_email
  FROM public.get_user_display_identity(auth.uid()) AS identity_row;

  IF v_exists THEN
    UPDATE public.store_sensitive_action_rules r
    SET
      enabled = p_enabled,
      requirement = p_requirement,
      min_role = p_min_role,
      token_enabled = p_token_enabled,
      token_expiry_seconds = p_token_expiry_seconds,
      max_attempts = p_max_attempts,
      require_reason = p_require_reason,
      source = 'store_override',
      updated_at = now()
    WHERE r.store_id = p_store_id
      AND r.action_code = p_action_code;
  ELSE
    INSERT INTO public.store_sensitive_action_rules (
      store_id,
      action_code,
      enabled,
      requirement,
      min_role,
      token_enabled,
      token_expiry_seconds,
      max_attempts,
      require_reason,
      source,
      created_at,
      updated_at
    )
    VALUES (
      p_store_id,
      p_action_code,
      p_enabled,
      p_requirement,
      p_min_role,
      p_token_enabled,
      p_token_expiry_seconds,
      p_max_attempts,
      p_require_reason,
      'store_override',
      now(),
      now()
    );
  END IF;

  SELECT jsonb_build_object(
    'enabled', r.enabled,
    'requirement', r.requirement,
    'min_role', r.min_role,
    'token_enabled', r.token_enabled,
    'token_expiry_seconds', r.token_expiry_seconds,
    'max_attempts', r.max_attempts,
    'require_reason', r.require_reason,
    'source', r.source
  )
  INTO v_new_rule
  FROM public.store_sensitive_action_rules r
  WHERE r.store_id = p_store_id
    AND r.action_code = p_action_code;

  INSERT INTO public.store_security_logs (
    store_id,
    user_id,
    user_name,
    user_email,
    action,
    details,
    outcome,
    created_at
  )
  VALUES (
    p_store_id,
    auth.uid(),
    v_actor_name,
    v_actor_email,
    'store_sensitive_action_rule_updated',
    jsonb_build_object(
      'action_code', p_action_code,
      'old_rule', v_old_rule,
      'new_rule', v_new_rule,
      'reason', p_reason
    ),
    'success',
    now()
  );

  RETURN QUERY
  SELECT
    r.store_id,
    r.action_code,
    r.enabled,
    r.requirement,
    r.min_role,
    r.token_enabled,
    r.token_expiry_seconds,
    r.max_attempts,
    r.require_reason,
    r.source,
    r.updated_at
  FROM public.store_sensitive_action_rules r
  WHERE r.store_id = p_store_id
    AND r.action_code = p_action_code;
END;
$function$;

DROP POLICY IF EXISTS store_member_invites_insert_admin ON public.store_member_invites;
CREATE POLICY store_member_invites_insert_admin ON public.store_member_invites FOR INSERT TO authenticated
WITH CHECK (public.app_is_store_owner(store_id) OR
 (public.user_has_store_permission_v2(store_id,'users.manage') AND role='staff'
 AND coalesce(permissions,'{}'::jsonb)='{}'::jsonb
 AND coalesce(sensitive_actions,'{}'::jsonb)='{}'::jsonb));
DROP POLICY IF EXISTS store_member_invites_update_admin ON public.store_member_invites;
CREATE POLICY store_member_invites_update_admin ON public.store_member_invites FOR UPDATE TO authenticated
USING (public.app_is_store_owner(store_id) OR public.user_has_store_permission_v2(store_id,'users.manage'))
WITH CHECK (public.app_is_store_owner(store_id) OR
 (public.user_has_store_permission_v2(store_id,'users.manage') AND role='staff'
 AND coalesce(permissions,'{}'::jsonb)='{}'::jsonb
 AND coalesce(sensitive_actions,'{}'::jsonb)='{}'::jsonb));
COMMIT;
