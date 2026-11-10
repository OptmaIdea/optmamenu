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
    when 'session_login_test' then 'Teste de login/sessão'
    when 'login' then 'Login realizado'
    when 'logout' then 'Logout realizado'
    when 'idle_timeout' then 'Sessão encerrada por inatividade'
    when 'browser_closed' then 'Sessão encerrada pelo fechamento do navegador'
    when 'session_closed_by_browser' then 'Sessão encerrada pelo fechamento do navegador'
    when 'session_logout' then 'Sessão encerrada'
    when 'store_idle_timeout_settings_updated' then 'Configuração de inatividade alterada'
    when 'store idle timeout settings updated' then 'Configuração de inatividade alterada'
    when 'store_role_permissions_bulk_updated' then 'Permissões por papel atualizadas'
    when 'store_role_permission_template_updated' then 'Permissão por papel alterada'
    when 'store_role_permission_updated' then 'Permissão por papel atualizada'
    when 'role_permission_updated' then 'Permissão por papel alterada'
    when 'store_member_permission_updated' then 'Permissão individual alterada'
    when 'member_permission_updated' then 'Permissão individual alterada'
    when 'store_member_permissions_updated' then 'Permissões do membro atualizadas'
    when 'member_permissions_updated' then 'Permissões do usuário atualizadas'
    when 'custom_role_created' then 'Função personalizada criada'
    when 'custom_role_updated' then 'Função personalizada alterada'
    when 'custom_role_deleted' then 'Função personalizada removida'
    when 'store_custom_role_created' then 'Função personalizada criada'
    when 'store_custom_role_updated' then 'Função personalizada atualizada'
    when 'store_custom_role_assigned' then 'Função personalizada atribuída'
    when 'store_custom_role_removed' then 'Função personalizada removida'
    when 'custom_role_deactivated' then 'Função personalizada desativada'
    when 'store_sensitive_action_rule_updated' then 'Regra de ação sensível alterada'
    when 'sensitive_action_rule_updated' then 'Regra de ação sensível alterada'
    when 'store_member_profile_updated_by_self' then 'Dados pessoais atualizados'
    when 'profile_change_request_created' then 'Solicitação cadastral criada'
    when 'profile_change_request_approved' then 'Solicitação cadastral aprovada'
    when 'profile_change_request_rejected' then 'Solicitação cadastral rejeitada'
    when 'profile_change_request_cancelled' then 'Solicitação cadastral cancelada'
    when 'store_member_profile_details_updated' then 'Dados do perfil atualizados'
    when 'store_member_avatar_updated' then 'Foto de perfil atualizada'
    when 'store_member_profile_change_request_reviewed' then 'Solicitação de alteração cadastral revisada'
    when 'store_member_invite_created' then 'Convite de usuário criado'
    when 'store_member_invite_cancelled' then 'Convite de usuário cancelado'
    when 'store_member_invite_accepted' then 'Convite aceito'
    when 'store_member_invite_declined' then 'Convite recusado'
    when 'store_member_linked_existing_user' then 'Usuário existente vinculado à loja'
    when 'store_member_admission_registered' then 'Admissão de usuário registrada'
    when 'store_member_exit_registered' then 'Desligamento de usuário registrado'
    when 'store_member_reactivated' then 'Acesso do usuário reativado'
    when 'store_member_status_updated' then 'Status do usuário alterado'
    when 'store_member_role_updated' then 'Função do usuário atualizada'
    when 'store_member_role_changed' then 'Função do membro alterada'
    when 'store_member_suspension_removed' then 'Suspensão do membro removida'
    when 'store_member_suspension_registered' then 'Suspensão do membro registrada'
    when 'store_member_onboarding_completed' then 'Integração inicial concluída'
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
    when 'loyalty_membership_removed' then 'Cliente removido da fidelidade'
    when 'loyalty_membership_banned' then 'CPF bloqueado na fidelidade'
    when 'loyalty_membership_unbanned' then 'CPF liberado na fidelidade'
    else coalesce(nullif(p_action, ''), 'Ação não identificada')
  end;
$function$;

update public.store_security_logs
set display_action=public.translate_security_action_ptbr(action)
where display_action=action
  and action in (
    'store_role_permissions_bulk_updated',
    'store_member_invite_created',
    'store_member_status_updated',
    'store_custom_role_assigned',
    'store_sensitive_action_rule_updated',
    'store_custom_role_updated',
    'store_member_reactivated',
    'store_member_exit_registered',
    'store_member_invite_cancelled',
    'session_login_test',
    'store_custom_role_created',
    'store_member_admission_registered',
    'store_member_linked_existing_user',
    'store_member_role_updated'
  );
