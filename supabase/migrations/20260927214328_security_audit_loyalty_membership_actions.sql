
create or replace function public.translate_security_action_ptbr(p_action text)
returns text
language sql
stable
set search_path to 'public'
as $function$
  select case lower(coalesce(p_action, ''))
    when 'session_store_selected' then 'Loja acessada'
    when 'session_disconnected' then 'Sessão encerrada'
    when 'session_heartbeat' then 'Sessão ativa'
    when 'session_login' then 'Login realizado'
    when 'login' then 'Login realizado'
    when 'logout' then 'Logout realizado'
    when 'idle_timeout' then 'Sessão encerrada por inatividade'
    when 'browser_closed' then 'Sessão encerrada pelo fechamento do navegador'
    when 'session_closed_by_browser' then 'Sessão encerrada pelo fechamento do navegador'
    when 'session_logout' then 'Sessão encerrada'
    when 'store_idle_timeout_settings_updated' then 'Configuração de inatividade alterada'
    when 'store idle timeout settings updated' then 'Configuração de inatividade alterada'
    when 'store_role_permission_template_updated' then 'Permissão por papel alterada'
    when 'role_permission_updated' then 'Permissão por papel alterada'
    when 'store_member_permission_updated' then 'Permissão individual alterada'
    when 'member_permission_updated' then 'Permissão individual alterada'
    when 'custom_role_created' then 'Função personalizada criada'
    when 'custom_role_updated' then 'Função personalizada alterada'
    when 'custom_role_deleted' then 'Função personalizada removida'
    when 'store_member_profile_updated_by_self' then 'Dados pessoais atualizados'
    when 'profile_change_request_created' then 'Solicitação cadastral criada'
    when 'profile_change_request_approved' then 'Solicitação cadastral aprovada'
    when 'profile_change_request_rejected' then 'Solicitação cadastral rejeitada'
    when 'profile_change_request_cancelled' then 'Solicitação cadastral cancelada'
    when 'store_member_invite_accepted' then 'Convite aceito'
    when 'store_member_invite_declined' then 'Convite recusado'
    when 'pin_validated' then 'PIN validado'
    when 'pin_failed' then 'Falha na validação do PIN'
    when 'master_password_validated' then 'Senha master validada'
    when 'master_password_failed' then 'Falha na validação da senha master'
    when 'token_settings_updated' then 'Configuração de token alterada'
    when 'pin_settings_updated' then 'Configuração de PIN alterada'
    when 'store_settings_updated' then 'Dados da loja alterados'
    when 'settings_updated' then 'Configurações alteradas'
    when 'member_invited' then 'Usuário convidado'
    when 'member_suspended' then 'Usuário suspenso'
    when 'member_reactivated' then 'Usuário reativado'
    when 'member_removed' then 'Usuário desligado'
    when 'member_role_changed' then 'Função do usuário alterada'
    when 'store_member_onboarding_completed' then 'Integração inicial concluída'
    when 'store_member_profile_details_updated' then 'Dados do perfil atualizados'
    when 'store_member_avatar_updated' then 'Foto de perfil atualizada'
    when 'store_member_profile_change_request_reviewed' then 'Solicitação de alteração cadastral revisada'
    when 'store_member_permissions_updated' then 'Permissões do membro atualizadas'
    when 'store_member_role_changed' then 'Função do membro alterada'
    when 'store_member_suspension_removed' then 'Suspensão do membro removida'
    when 'store_member_suspension_registered' then 'Suspensão do membro registrada'
    when 'loyalty_membership_removed' then 'Cliente removido da fidelidade'
    when 'loyalty_membership_banned' then 'CPF bloqueado na fidelidade'
    when 'loyalty_membership_unbanned' then 'CPF liberado na fidelidade'
    else coalesce(nullif(p_action, ''), 'Ação não identificada')
  end;
$function$;

create or replace function public.get_security_log_visibility_defaults(p_action text)
returns table(sensitive boolean, visible_to_member boolean)
language sql
stable
set search_path to 'public'
as $function$
  select
    case
      when lower(coalesce(p_action, '')) in (
        'store_idle_timeout_settings_updated','store idle timeout settings updated',
        'store_role_permission_template_updated','role_permission_updated',
        'store_member_permission_updated','member_permission_updated',
        'custom_role_created','custom_role_updated','custom_role_deleted',
        'sensitive_action_rule_updated','pin_settings_updated','token_settings_updated',
        'store_settings_updated','settings_updated','security.manage','security.view',
        'loyalty_membership_removed','loyalty_membership_banned','loyalty_membership_unbanned'
      ) then true
      else false
    end as sensitive,
    case
      when lower(coalesce(p_action, '')) in (
        'session_store_selected','session_disconnected','session_heartbeat','session_login',
        'login','logout','idle_timeout','browser_closed','session_closed_by_browser',
        'store_member_profile_updated_by_self','profile_change_request_created',
        'profile_change_request_approved','profile_change_request_rejected',
        'profile_change_request_cancelled'
      ) then true
      when lower(coalesce(p_action, '')) in (
        'store_idle_timeout_settings_updated','store idle timeout settings updated',
        'store_role_permission_template_updated','role_permission_updated',
        'store_member_permission_updated','member_permission_updated',
        'custom_role_created','custom_role_updated','custom_role_deleted',
        'sensitive_action_rule_updated','pin_settings_updated','token_settings_updated',
        'store_settings_updated','settings_updated',
        'loyalty_membership_removed','loyalty_membership_banned','loyalty_membership_unbanned'
      ) then false
      else true
    end as visible_to_member;
$function$;

create or replace function public.insert_security_log(
  p_store_id uuid,
  p_user_id uuid,
  p_user_email text,
  p_action text,
  p_details jsonb,
  p_outcome text
)
returns void
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
declare
  v_sensitive boolean;
  v_visible_to_member boolean;
  v_user_name text;
  v_user_email text:=nullif(trim(coalesce(p_user_email,'')),'');
begin
  if p_user_id is not null then
    select identity_row.user_name, coalesce(v_user_email,identity_row.user_email)
    into v_user_name,v_user_email
    from public.get_user_display_identity(p_user_id) as identity_row;
  end if;

  select defaults.sensitive,defaults.visible_to_member
  into v_sensitive,v_visible_to_member
  from public.get_security_log_visibility_defaults(p_action) as defaults;

  insert into public.store_security_logs(
    store_id,user_id,user_name,user_email,action,display_action,details,outcome,
    sensitive,visible_to_member,created_at
  )
  values(
    p_store_id,p_user_id,v_user_name,v_user_email,p_action,
    public.translate_security_action_ptbr(p_action),
    coalesce(p_details,'{}'::jsonb),p_outcome,
    coalesce(v_sensitive,false),coalesce(v_visible_to_member,true),now()
  );
end;
$function$;

create or replace function public.admin_set_customer_loyalty_membership_safe(
  p_store_id uuid,
  p_customer_id uuid,
  p_action text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_action text:=lower(trim(coalesce(p_action,'')));
  v_customer public.customers%rowtype;
  v_hash text;
  v_user uuid:=auth.uid();
  v_result jsonb:='{}'::jsonb;
  v_customer_name text;
  v_details jsonb;
begin
  if p_store_id is null or p_customer_id is null then
    return jsonb_build_object('ok',false,'error','missing_parameters');
  end if;

  if v_user is null or not (
    public.app_is_store_owner(p_store_id)
    or public.user_has_store_permission_v2(p_store_id,'loyalty.manage')
  ) then
    return jsonb_build_object('ok',false,'error','access_denied');
  end if;

  select * into v_customer
  from public.customers
  where id=p_customer_id and store_id=p_store_id
  for update;

  if not found then
    return jsonb_build_object('ok',false,'error','customer_not_found');
  end if;

  v_customer_name:=coalesce(
    nullif(trim(v_customer.full_name),''),
    nullif(trim(v_customer.nickname),''),
    'Cliente'
  );

  if v_action='remove' then
    perform public.record_loyalty_exit_audit_internal(
      p_store_id,p_customer_id,'admin_remove',p_reason
    );
    v_result:=public.purge_customer_loyalty_data_internal(p_store_id,p_customer_id);

    v_details:=jsonb_build_object(
      'target_customer_id',p_customer_id,
      'target_customer_name',v_customer_name,
      'membership_action','remove',
      'reason',nullif(trim(coalesce(p_reason,'')),'')
    );
    perform public.insert_security_log(
      p_store_id,v_user,null,'loyalty_membership_removed',v_details,'success'
    );

    return coalesce(v_result,'{}'::jsonb)
      ||jsonb_build_object('ok',true,'membership','removed','can_rejoin',true);
  end if;

  if v_action='ban' then
    if length(regexp_replace(coalesce(v_customer.cpf,''),'\D','','g'))<>11 then
      return jsonb_build_object('ok',false,'error','cpf_required_for_ban');
    end if;
    if length(trim(coalesce(p_reason,'')))<3 then
      return jsonb_build_object('ok',false,'error','reason_required');
    end if;

    v_hash:=public.fidelity_cpf_hash(p_store_id,v_customer.cpf);
    perform public.record_loyalty_exit_audit_internal(
      p_store_id,p_customer_id,'ban',p_reason
    );
    v_result:=public.purge_customer_loyalty_data_internal(p_store_id,p_customer_id);

    insert into public.fidelity_membership_blocks(
      store_id,customer_id,cpf_hash,cpf_last4,reason,blocked_by,metadata
    )
    values(
      p_store_id,p_customer_id,v_hash,
      right(regexp_replace(v_customer.cpf,'\D','','g'),4),
      trim(p_reason),v_user,
      jsonb_build_object('source','admin_loyalty_membership')
    )
    on conflict (store_id,cpf_hash) where unblocked_at is null
    do update set
      customer_id=excluded.customer_id,
      reason=excluded.reason,
      blocked_by=excluded.blocked_by,
      blocked_at=clock_timestamp(),
      metadata=excluded.metadata;

    v_details:=jsonb_build_object(
      'target_customer_id',p_customer_id,
      'target_customer_name',v_customer_name,
      'membership_action','ban',
      'cpf_last4',right(regexp_replace(v_customer.cpf,'\D','','g'),4),
      'reason',trim(p_reason)
    );
    perform public.insert_security_log(
      p_store_id,v_user,null,'loyalty_membership_banned',v_details,'success'
    );

    return coalesce(v_result,'{}'::jsonb)
      ||jsonb_build_object('ok',true,'membership','banned','can_rejoin',false);
  end if;

  if v_action='unban' then
    if length(regexp_replace(coalesce(v_customer.cpf,''),'\D','','g'))=11 then
      v_hash:=public.fidelity_cpf_hash(p_store_id,v_customer.cpf);
      update public.fidelity_membership_blocks
      set unblocked_at=clock_timestamp(),unblocked_by=v_user
      where store_id=p_store_id
        and unblocked_at is null
        and (customer_id=p_customer_id or cpf_hash=v_hash);
    else
      update public.fidelity_membership_blocks
      set unblocked_at=clock_timestamp(),unblocked_by=v_user
      where store_id=p_store_id
        and unblocked_at is null
        and customer_id=p_customer_id;
    end if;

    perform public.record_loyalty_exit_audit_internal(
      p_store_id,p_customer_id,'unban',p_reason
    );

    v_details:=jsonb_build_object(
      'target_customer_id',p_customer_id,
      'target_customer_name',v_customer_name,
      'membership_action','unban',
      'reason',nullif(trim(coalesce(p_reason,'')),'')
    );
    perform public.insert_security_log(
      p_store_id,v_user,null,'loyalty_membership_unbanned',v_details,'success'
    );

    return jsonb_build_object('ok',true,'membership','unbanned','can_rejoin',true);
  end if;

  return jsonb_build_object('ok',false,'error','invalid_action');
end;
$function$;
