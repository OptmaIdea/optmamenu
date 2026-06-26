# Fase 9.13.1J — Ajustes finos de permissões personalizadas e realtime

## Status

**Diagnóstico técnico com causa principal identificada.**

Esta frente nasce após o fechamento funcional da 9.13.1I, durante os testes de Mensagens e Atendimento em Configurações.

A etapa não altera o escopo funcional da 9.13.1I. O objetivo é refinar o comportamento de Segurança, Funções personalizadas, Permissões por usuário e realtime entre usuários.

---

## Objetivo

Corrigir e consolidar:

- atualização em tempo real de permissões entre usuários;
- exibição amigável de nomes de colaboradores;
- persistência e aplicação de permissões em funções personalizadas;
- herança de papel base + overrides de função personalizada;
- versionamento central por `store_permission_versions`.

---

## Achados iniciais

### 1. Realtime do usuário afetado

O hook principal do usuário afetado é:

- `src/hooks/usePermissions.ts`

Ele escuta corretamente:

- `store_permission_versions`

Isso confirma o padrão consolidado da 9.13:

- o usuário afetado não deve depender de listener direto em `store_role_permission_templates`;
- o usuário afetado não deve depender de listener direto em `store_custom_roles`;
- o usuário afetado não deve depender de listener direto em `store_members`;
- toda alteração relevante deve atualizar `store_permission_versions`.

O diagnóstico SQL mostrou que existe atualização recente em `store_permission_versions` com reason `store_custom_roles:UPDATE`, então há versionamento acontecendo em alterações de `store_custom_roles`, provavelmente por trigger ou fluxo indireto.

---

### 2. Admin de permissões tem listeners próprios

O hook administrativo:

- `src/hooks/security/useSecurityPermissionsAdmin.ts`

Atualmente escuta diretamente:

- `store_role_permission_templates`;
- `store_custom_roles`;
- `store_members`.

Isso atualiza a visão administrativa da tela de Segurança, mas não substitui `store_permission_versions` para o usuário afetado.

Direção recomendada:

- manter `store_permission_versions` como fonte central para refresh efetivo de permissões;
- avaliar se o admin hook também deve escutar `store_permission_versions` para padronização;
- evitar que a tela administrativa pareça atualizada enquanto o usuário afetado permanece com cache antigo.

---

### 3. Funções personalizadas

Fluxos envolvidos:

- `list_store_custom_roles`;
- `create_store_custom_role`;
- `update_store_custom_role`;
- `assign_store_custom_role_to_member`.

Arquivos principais:

- `src/hooks/security/useStoreCustomRoles.ts`;
- `src/pages/private/admin/settings/security/Security.tsx`;
- `src/types/security.ts`.

Durante os testes, foi observado que a função personalizada `Subgerente Nível I`, com base `Gerente`, não refletiu alteração de permissões como esperado.

O diagnóstico SQL confirmou:

- `update_store_custom_role` grava `store_custom_roles.permissions` com o JSONB recebido em `p_permissions`;
- a função `Subgerente Nível I` possui overrides salvos em `store_custom_roles.permissions`, incluindo permissões novas como `settings.messages.view=true` e `settings.messages.manage=true`;
- existe versionamento recente em `store_permission_versions` para `store_custom_roles:UPDATE`;
- a causa principal está em `get_effective_store_permissions`.

---

## Causa principal identificada

A RPC atual:

- `get_effective_store_permissions(p_store_id uuid)`

considera apenas:

1. owner;
2. `store_members.permissions` com `all=true`;
3. `store_members.permissions[permission_code]` como override individual;
4. `store_role_permission_templates` do papel base;
5. fallback negado.

Ela **não consulta `store_members.custom_role_id`** e **não aplica `store_custom_roles.permissions`**.

Consequência:

- a tela de Funções personalizadas salva corretamente os overrides no JSONB da função;
- `store_permission_versions` é atualizado;
- o usuário afetado recarrega as permissões;
- mas o cálculo efetivo ignora os overrides da função personalizada e cai no template do papel base.

Este é o motivo de `Subgerente Nível I`, base `Gerente`, não refletir alterações próprias da função personalizada.

---

## Ordem correta de precedência esperada

A correção de `get_effective_store_permissions` deve aplicar a seguinte ordem:

1. `owner` sempre permitido;
2. override individual `store_members.permissions['all'] = true`;
3. override individual `store_members.permissions[permission_code]`;
4. override da função personalizada `store_custom_roles.permissions[permission_code]`, quando `custom_role_id` estiver ativo;
5. template do papel base em `store_role_permission_templates`;
6. fallback negado.

A origem (`source`) deve refletir a camada aplicada:

- `owner`;
- `member_override_all`;
- `member_override`;
- `custom_role_override`;
- template do papel base;
- `default_denied`.

---

## Observação sobre `assign_store_custom_role_to_member`

A RPC `assign_store_custom_role_to_member` atualiza:

- `store_members.role = custom_role.base_role`;
- `store_members.custom_role_id = p_custom_role_id`;
- preserva ou limpa overrides individuais conforme parâmetro.

Esse comportamento está alinhado com o modelo de herança, desde que `get_effective_store_permissions` considere `custom_role_id` e aplique `store_custom_roles.permissions` acima do papel base.

---

### 4. Nome de colaborador caindo para e-mail

Em `Permissões por usuário`, foi observado:

- Carlos Souza aparece pelo nome;
- Henrique/Rick aparece pelo e-mail.

Esse comportamento indica fallback incompleto no retorno ou renderização dos membros.

Pontos a verificar:

- retorno da RPC `get_store_members_for_permissions`;
- campos disponíveis em `StoreMemberForPermissionsRow`;
- prioridade de exibição na UI.

Ordem desejada de exibição:

1. nome do perfil;
2. apelido/alias interno, se existir;
3. nome amigável do vínculo/membro, se existir;
4. e-mail;
5. identificador curto.

---

## Critérios de aceite

### Realtime

- Alteração em permissão por papel deve refletir no usuário afetado sem reload.
- Alteração em permissão individual deve refletir no usuário afetado sem reload.
- Atribuição/remoção de função personalizada deve refletir no usuário afetado sem reload.
- Alteração nas permissões de uma função personalizada deve refletir nos usuários vinculados sem reload.

### Função personalizada

- Função personalizada herda corretamente permissões do papel base.
- Overrides da função personalizada prevalecem sobre o papel base.
- Permissões individuais do membro prevalecem sobre função personalizada.
- Salvar função personalizada altera `store_custom_roles.permissions`.
- Salvar função personalizada atualiza `store_permission_versions`.

### Permissões por usuário

- Lista de colaboradores deve priorizar nome amigável.
- Fallback para e-mail deve ser usado somente quando não houver nome/alias disponível.
- Alterações específicas por usuário continuam funcionando.

---

## Fora do escopo desta rodada

- Advisors/RLS globais;
- hardening amplo de SQL;
- alterações em módulos comerciais;
- mudanças no modelo de Mensagens e Atendimento;
- criação de novos grupos de permissões.

---

## Próximos passos técnicos

1. Criar migration específica para corrigir `get_effective_store_permissions`, mediante autorização explícita.
2. Preservar assinatura e retorno da RPC para não quebrar frontend.
3. Adicionar leitura de `store_members.custom_role_id` e `store_custom_roles.permissions`.
4. Aplicar precedência correta:
   - owner;
   - override individual;
   - função personalizada;
   - papel base;
   - fallback.
5. Testar com usuário vinculado a `Subgerente Nível I`.
6. Em seguida, diagnosticar `get_store_members_for_permissions` para corrigir fallback de nome/e-mail.

---

## Observação operacional

Não criar migration/RPC nova sem confirmação explícita.

Se for necessário corrigir SQL de RPC, a proposta deve ser apresentada separadamente, com escopo fechado e sem misturar com Advisors.
