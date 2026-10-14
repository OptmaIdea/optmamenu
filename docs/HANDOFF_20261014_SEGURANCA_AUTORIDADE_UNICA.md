# Governança — Segurança como autoridade única (14/10/2026)

## Decisão aprovada
A definição de papéis nativos, funções personalizadas, concessões e negativas individuais é responsabilidade exclusiva do módulo **Segurança**. A área **Usuários e Equipe** conserva vínculos, convites de perfil mínimo, status e dados cadastrais. Configurações da Loja não define autorizações.

## Evidências que motivaram a correção
- A UI de Usuários expunha alteração de papel/função por `users.manage`.
- `change_store_member_role` e `assign_store_custom_role_to_member` permitiam `users.manage` **ou** `security.manage` sem verificação de `security.view` e `security.user_permissions.manage`.
- `create_store_member_invite` e `add_store_member_by_email` aceitam papéis e permissões no payload. `create_store_member_occurrence_v2` aceita `role_change` e, na admissão, atualização de papel/função.
- `can_access_security_section` legada permite que `security.manage` supere restrição explícita da aba. `can_access_security_section_v3` exige root + aba: padrões divergentes.
- A RLS direta de `store_member_invites` permite INSERT/UPDATE a `users.manage` sem restringir campos privilegiados.
- `get_store_members_for_permissions` e `get_store_member_permission_detail` permitem leitura de permissões por `users.manage`.

## Entrega frontend
- Usuários exibe papel e função somente em modo leitura e dá acesso à Central de Segurança apenas quando `security.view`, `security.manage`, `security.user_permissions.view` e `security.user_permissions.manage` permitem.
- Convites de Usuários são feitos como `staff`, sem conceder exceções via UI. O formulário não edita papel.
- A criação de ocorrência em Usuários não permite o tipo `role_change` nem anexa payload de alteração de privilégios na admissão.
- Segurança > Permissões por usuário recebe controles para alterar papel e atribuir função personalizada (com confirmação e preservação de exceções por padrão). Owner e administradores explicitamente delegados continuam a poder atuar.
- `security.manage` isolada deixa de ser um atalho que contorna negação de `security.<seção>.manage` na interface.

## Entrega banco e validação
A migration deve alinhar RPCs e RLS para que **qualquer mudança de privilégios** exija owner ou `security.view` + `security.manage` + `security.user_permissions.view` + `security.user_permissions.manage` na loja do membro. Operações em papéis e funções exigem as respectivas seções. Um integrante com `users.manage` sem Segurança somente convida `staff` com overrides vazios.

Não aplicar automaticamente mudanças a qualquer usuário, papel ou conjunto de permissões existente. Testes negativos e positivos com autenticação contextual devem ocorrer antes da homologação definitiva. Verificar a execução da migration no Supabase e o estado do deploy de homologação.

## Validação manual
1. Owner: acesso a Segurança > Permissões por usuário, alterações de papel e atribuição de função, com confirmações.
2. Colaborador com `users.manage` mas `security.view=false`: não vê ações de acesso em Usuários, nem entra na Central. RPCs de atribuição devem negar e convites devem ser de papel `staff`.
3. Membro com `security.view=true`, mas `security.user_permissions.manage=false`: vê aba se tiver `security.user_permissions.view`, porém não pode salvar nem atribuir.
4. Carlos: negativas `security.roles.view`, `security.custom_roles.view`, `security.user_permissions.view` preservadas; não pode alterar esses privilégios por acesso direto ou Usuários.
5. Confirmar que status, perfil, convites, ocorrências não privilegiadas e a navegação existente permanecem funcionando.
