# Fase 9.13.1J — Ajustes finos de permissões personalizadas e realtime

## Status

**Funções personalizadas e realtime validados; origem do nome em permissões por usuário documentada.**

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

A RPC anterior:

- `get_effective_store_permissions(p_store_id uuid)`

considerava apenas:

1. owner;
2. `store_members.permissions` com `all=true`;
3. `store_members.permissions[permission_code]` como override individual;
4. `store_role_permission_templates` do papel base;
5. fallback negado.

Ela **não consultava `store_members.custom_role_id`** e **não aplicava `store_custom_roles.permissions`**.

Consequência:

- a tela de Funções personalizadas salvava corretamente os overrides no JSONB da função;
- `store_permission_versions` era atualizado;
- o usuário afetado recarregava as permissões;
- mas o cálculo efetivo ignorava os overrides da função personalizada e caía no template do papel base.

Este era o motivo de `Subgerente Nível I`, base `Gerente`, não refletir alterações próprias da função personalizada.

---

## Migration de permissões efetivas

Arquivo:

- `supabase/migrations/20260626190000_fix_effective_permissions_custom_roles.sql`

Escopo:

- substitui `get_effective_store_permissions(p_store_id uuid)` preservando assinatura e retorno;
- adiciona `LEFT JOIN store_custom_roles` pela função personalizada ativa do membro;
- lê `store_custom_roles.permissions`;
- aplica a precedência correta;
- atualiza `store_permission_versions` para forçar refresh dos usuários conectados.

Não altera:

- tabelas;
- RLS;
- Advisors;
- políticas;
- retorno do frontend.

---

## Ordem correta de precedência aplicada

A correção de `get_effective_store_permissions` aplica a seguinte ordem:

1. `owner` sempre permitido;
2. override individual `store_members.permissions['all'] = true`;
3. override individual `store_members.permissions[permission_code]`;
4. override da função personalizada `store_custom_roles.permissions[permission_code]`, quando `custom_role_id` estiver ativo;
5. template do papel base em `store_role_permission_templates`;
6. fallback negado.

A origem (`source`) reflete a camada aplicada:

- `owner`;
- `member_override_all`;
- `member_override`;
- `custom_role_override`;
- template do papel base;
- `default_denied`.

---

## Validação de funções personalizadas

A validação confirmou:

- alteração em função personalizada reflete em tempo real;
- matriz de permissões carrega corretamente na aba Funções personalizadas após ajuste frontend;
- permissão individual prevalece sobre função personalizada;
- função personalizada prevalece sobre papel base;
- ao retornar permissão individual para `Herdar`, volta a prevalecer a função personalizada;
- console limpo.

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
- Henrique/Rick aparecia pelo e-mail.

O diagnóstico mostrou:

- para Henrique, `auth.users.raw_user_meta_data.full_name = "Henrique souza"`;
- a função `get_user_display_identity` retornava `(logmytravel.com@gmail.com, logmytravel.com@gmail.com)`;
- a função anterior usava `COALESCE(p.name, au.raw_user_meta_data->>'name', au.email)`, mas não considerava `raw_user_meta_data->>'full_name'`;
- para Carlos, `public.profiles.name` já retornava corretamente `Carlos Souza`, então essa origem deveria ser preservada como prioridade.

---

## Migration de identidade do usuário

Arquivo:

- `supabase/migrations/20260627163000_fix_user_display_identity_full_name.sql`

Escopo:

- substitui `get_user_display_identity(p_user_id uuid)` preservando assinatura e retorno;
- mantém `public.profiles.name` como origem principal;
- adiciona `auth.users.raw_user_meta_data->>'full_name'` antes do fallback para e-mail;
- mantém `auth.users.raw_user_meta_data->>'name'` como fallback secundário;
- usa `NULLIF(btrim(...), '')` para ignorar strings vazias.

Ordem final:

1. `public.profiles.name`;
2. `auth.users.raw_user_meta_data->>'full_name'`;
3. `auth.users.raw_user_meta_data->>'name'`;
4. `auth.users.email`.

---

## Achado adicional — origem real do nome em Permissões por usuário

Após aplicar a migration de identidade, foi confirmado um ponto importante de produto:

- `auth.users.raw_user_meta_data.full_name` é apenas fallback;
- o nome realmente usado nas telas administrativas vem prioritariamente do cadastro interno/perfil do OptmaMenu, especialmente `public.profiles.name` ou estrutura equivalente usada por `get_user_display_identity`;
- por isso, enquanto Henrique não tinha **Nome Completo** preenchido/aplicado em **Meus Dados**, a lista de **Permissões por usuário** ainda caía para e-mail;
- após solicitar/aplicar a alteração cadastral de nome, o nome passou a existir no cadastro principal e a tela de permissões passou a ter base correta para exibir nome amigável.

Conclusão operacional:

- a tela de **Permissões por usuário** deve priorizar o nome cadastral interno;
- `raw_user_meta_data.full_name` continua útil como fallback para usuários recém-criados ou incompletos;
- o fluxo correto para corrigir nome oficial é **Meus Dados → Solicitar Alteração → Aprovação/Aplicação**;
- o campo **Apelido** é vínculo/local e pode aparecer em contexto pessoal/sidebar, mas não deve substituir automaticamente o nome completo oficial em listas administrativas sem regra explícita.

---

## Achado adicional — Meu Histórico com rótulos não amigáveis

O teste do fluxo de alteração de nome também validou que:

- a solicitação de alteração cadastral é registrada;
- a aprovação/aplicação aparece no Meu Histórico do colaborador;
- o fluxo funcional está correto.

Mas foram observados rótulos técnicos/não amigáveis no histórico, como:

- `name_change`;
- status técnicos como `applied`, quando aparecerem em detalhes;
- textos de detalhe que podem ficar mais humanos.

Pendência futura:

- criar uma rodada de refinamento visual/textual do **Meu Histórico**, traduzindo tipos, status e campos técnicos para labels amigáveis;
- exemplos esperados: `name_change` → `Alteração de nome`; `applied` → `Aplicada`; `full_name`/`name` → `Nome completo`.

---

## Observação sobre arquivos `.patch`

Os arquivos em `docs/patches/` foram usados como apoio quando a edição direta pelo conector não era segura.

Quando o ajuste já foi aplicado manualmente no código, não é necessário executar o patch correspondente.

Recomendação:

- remover patches já aplicados manualmente para evitar confusão futura;
- manter somente patches ainda pendentes de aplicação.

---

## Integração Supabase neste ambiente

Foi confirmado que existe ferramenta Supabase disponível para consulta SQL direta (`execute_sql`) quando o projeto estiver identificado/conectado.

Uso recomendado:

- consultas diagnósticas;
- leitura de funções/RPCs;
- validações pontuais.

Para DDL/migrations, manter o fluxo preferencial:

1. criar migration no repositório;
2. aplicar de forma controlada no Supabase;
3. atualizar snapshot `docs/supabase_audit/schema_public_current.sql`;
4. commitar o snapshot.

Quando houver ferramenta de aplicação de migration disponível na sessão, pode-se automatizar também a aplicação, mas sem misturar com Advisors/RLS/hardening global.

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

- Lista de colaboradores deve priorizar nome amigável cadastral.
- Fallback para e-mail deve ser usado somente quando não houver nome interno nem metadata confiável.
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

1. Confirmar se o snapshot atualizado foi commitado após a migration `20260627163000_fix_user_display_identity_full_name.sql`.
2. Remover patches já aplicados manualmente, se ainda estiverem no repositório.
3. Avaliar rodada futura de labels amigáveis no Meu Histórico.
4. Fechar a 9.13.1J se build/console permanecerem limpos.

---

## Observação operacional

A partir desta frente, o usuário autorizou o envio direto de migrations quando forem correções pequenas e claramente dentro da frente em andamento, desde que:

- a causa já esteja demonstrada por diagnóstico;
- a migration seja focada;
- não envolva Advisors/RLS/hardening global;
- não crie tabelas novas nem mude estrutura crítica sem aviso;
- a resposta informe claramente o arquivo criado e o que ele altera.

Para mudanças estruturais, políticas RLS, funções sensíveis amplas ou novos módulos, continuar solicitando confirmação explícita antes de criar migration.
