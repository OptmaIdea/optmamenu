# Fase 9.13.1J — Ajustes finos de permissões personalizadas e realtime

## Status

**Em diagnóstico técnico.**

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

Consequência: se uma alteração feita pelo owner/admin não refletir no outro usuário, a primeira suspeita é o fluxo não estar tocando `store_permission_versions`.

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

A documentação atual de RPCs já diz que:

- `create_store_custom_role` deve atualizar `store_permission_versions`;
- `update_store_custom_role` deve atualizar `store_permission_versions`;
- `assign_store_custom_role_to_member` deve atualizar `store_permission_versions`.

Durante os testes, foi observado que a função personalizada `Subgerente Nível I`, com base `Gerente`, não refletiu alteração de permissões como esperado. Isso exige verificar:

- se `update_store_custom_role` realmente grava `permissions`;
- se a tela envia `p_permissions` com os overrides corretos;
- se a RPC toca `store_permission_versions`;
- se o cálculo efetivo de permissões considera `custom_role.permissions` acima do papel base;
- se permissões individuais ainda prevalecem sobre função personalizada.

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

1. Conferir o corpo real das RPCs de funções personalizadas no snapshot Supabase ou no SQL Editor.
2. Validar se `update_store_custom_role` grava `permissions` e toca `store_permission_versions`.
3. Validar se `getEffectiveStorePermissions` aplica ordem correta:
   - permissões individuais;
   - função personalizada;
   - papel base;
   - fallback.
4. Ajustar fallback visual de nome em Permissões por usuário.
5. Padronizar refresh administrativo com `store_permission_versions`, sem quebrar a tela de Segurança.

---

## Observação operacional

Não criar migration/RPC nova sem confirmação explícita.

Se for necessário corrigir SQL de RPC, a proposta deve ser apresentada separadamente, com escopo fechado e sem misturar com Advisors.
