# RPCs e functions — Complementos da Fase 9.13

## Objetivo

Registrar as RPCs e funções ajustadas nas frentes finais da Fase 9.13, especialmente 9.13.1J e 9.13.1K.

Este documento complementa `docs/RPCS_AND_VIEWS.md` sem substituir a documentação principal.

---

## 1. `get_effective_store_permissions`

### Frente

- Fase 9.13.1J — Ajustes finos de permissões personalizadas e realtime.

### Migration

- `supabase/migrations/20260626190000_fix_effective_permissions_custom_roles.sql`

### Objetivo

Retornar as permissões efetivas do usuário autenticado para uma loja, considerando também a função personalizada vinculada ao membro.

### Parâmetros

- `p_store_id uuid`

### Retorno

Tabela com campos como:

- `permission_code`;
- `module`;
- `action`;
- `label`;
- `description`;
- `risk_level`;
- `allowed`;
- `source`;
- `role`.

### Hierarquia consolidada

1. `owner` sempre permitido.
2. Override individual `store_members.permissions['all'] = true`.
3. Override individual `store_members.permissions[permission_code]`.
4. Override de função personalizada em `store_custom_roles.permissions[permission_code]`.
5. Template do papel base em `store_role_permission_templates`.
6. Fallback negado.

### Onde é usada

- `src/hooks/usePermissions.ts`;
- proteção de menus, abas e rotas;
- telas que dependem de permissões efetivas do usuário logado.

### Observações

- A assinatura e o retorno foram preservados.
- A correção adicionou suporte a `store_members.custom_role_id`.
- A migration atualiza `store_permission_versions` para forçar refresh dos usuários conectados.
- Validação confirmou realtime e precedência `individual > função personalizada > papel base`.

---

## 2. `get_user_display_identity`

### Frente

- Fase 9.13.1J — Ajustes finos de permissões personalizadas e realtime.

### Migration

- `supabase/migrations/20260627163000_fix_user_display_identity_full_name.sql`

### Objetivo

Resolver nome e e-mail de exibição de um usuário para listas administrativas, permissões e logs.

### Parâmetros

- `p_user_id uuid`

### Retorno

- `user_name text`;
- `user_email text`.

### Ordem de resolução após ajuste

1. `public.profiles.name`.
2. `auth.users.raw_user_meta_data->>'full_name'`.
3. `auth.users.raw_user_meta_data->>'name'`.
4. `auth.users.email`.

### Onde é usada

- RPCs/listas administrativas que exibem usuários;
- tela `/admin/security?tab=user_permissions`;
- diagnósticos de identidade de colaborador.

### Observações

- Preserva nomes oficiais já existentes em `profiles.name`, como Carlos Souza.
- Corrige usuários cujo nome está apenas em `raw_user_meta_data.full_name`, como Henrique, enquanto fallback.
- A origem principal do nome em listas administrativas continua sendo o cadastro interno/perfil do OptmaMenu.
- O fluxo correto para ajustar nome oficial é `Meus Dados → Solicitar Alteração → Aprovação/Aplicação`.

---

## 3. `get_login_store_options`

### Frente

- Fase 9.13.1K — Labels amigáveis, histórico e login de função personalizada.

### Migration

- `supabase/migrations/20260627190000_fix_login_store_options_custom_role.sql`

### Objetivo

Retornar as opções de loja/vínculo disponíveis para o usuário autenticado na tela de login/escolha de loja, incluindo dados da função personalizada quando houver.

### Parâmetros

- nenhum parâmetro explícito;
- usa `auth.uid()`.

### Retorno após ajuste

Além dos campos anteriores, passa a retornar:

- `custom_role_id uuid`;
- `custom_role_name text`;
- `custom_role_base_role text`.

Campos principais do retorno:

- `store_id`;
- `store_name`;
- `store_slug`;
- `store_logo_url`;
- `role`;
- `custom_role_id`;
- `custom_role_name`;
- `custom_role_base_role`;
- `status`;
- `status_reason`;
- `is_owner`;
- `is_primary_owner`;
- `access_blocked`;
- `access_message`;
- `sort_order`.

### Onde é usada

- `src/pages/initial/auth/Login.tsx`;
- `src/types/security.ts` (`LoginStoreOption`).

### Observações

- Como a assinatura de retorno mudou, a migration remove e recria a função.
- A lógica anterior foi preservada.
- Foi adicionado `LEFT JOIN public.store_custom_roles` usando `store_members.custom_role_id`.
- A UI do login passou a priorizar `custom_role_name`; se não houver função personalizada, usa o papel base traduzido.
- Validação final: vínculo de Gelinhares passou a exibir `Subgerente Nível I` em vez de apenas `Gerente`.

---

## 4. Observações gerais da Fase 9.13

- As migrations desta rodada foram focadas e não trataram Advisors/RLS/hardening global.
- O snapshot `docs/supabase_audit/schema_public_current.sql` deve ser atualizado após aplicar migrations no Supabase.
- Qualquer nova alteração em RPC deve também ser refletida em `docs/RPCS_AND_VIEWS.md` ou neste complemento, com indicação de migration, frontend consumidor e efeito colateral.

---

## 5. Relação com Advisors/RLS

Este documento registra fechamento funcional e alterações de RPC usadas pelo sistema.

A revisão de:

- RLS;
- policies;
- grants públicos;
- WARNs de `SECURITY DEFINER`;
- hardening de funções;
- Advisors Supabase;

fica para rodada própria, conforme diretriz consolidada da Fase 9.
