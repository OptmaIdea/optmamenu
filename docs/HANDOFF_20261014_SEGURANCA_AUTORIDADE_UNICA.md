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

## Execução comprovada — 14/10/2026

### Implementação publicada
- Separação frontend: `src/pages/private/admin/users/Users.tsx`, `src/components/users/UserDetailModal.tsx`, `src/components/users/UserFormModal.tsx`, `src/store/useUsersStore.ts`. Acesso e papel apenas informativos em Usuários; envio de convite padrão `staff`; nenhuma chamada da tela Usuários para mudar papel ou atribuir função.
- Gestão concentrada em `src/pages/private/admin/settings/security/Security.tsx` e `MemberAccessAssignment.tsx`, dentro da aba `user_permissions`. `security.view`, `security.manage`, `security.user_permissions.view` e `security.user_permissions.manage` são obrigatórios para gerenciar. O owner conserva administração.
- A lista de funções personalizadas é carregada também para usuários com `security.user_permissions.view` autorizado, sem conferir poderes de editar funções.

### Supabase: migrations aplicadas
1. `20261014135000_governance_security_exclusive_permission_authority.sql` — **aplicada** no banco como migration registrada `20261014104225` / `governance_security_exclusive_permission_authority_20261014`. Substitui 18 definições de RPC, unifica a função legada de autorização ao verificador granular v3 e endurece RLS de INSERT/UPDATE de convites.
2. `20261014141000_security_member_permission_effective_resolution.sql` — **aplicada** via Supabase. Alinha `get_store_member_permission_detail` ao mesmo `get_effective_store_member_permissions_v2` usado para calcular concessões, negativas e overrides de função personalizada. Antes, no teste com o papel personalizado de Carlos havia **46 divergências** de valor efetivo; depois, **137 permissões comparadas, 0 divergências efetivas e 0 divergências de origem**.

### Testes executados com transações ROLLBACK (sem persistir dados)
| Cenário | Resultado |
| --- | --- |
| Owner: ler permissões de Carlos | 137 registros |
| Carlos: ler permissões de Carlos pela RPC de detalhe | 0 registros, acesso à seção negado |
| Staff sem Segurança: ler permissões de Carlos | 0 registros |
| Carlos: mudar papel via `change_store_member_role` | DENIED |
| Carlos: atribuir função via `assign_store_custom_role_to_member` | DENIED |
| Carlos: `create_store_member_invite` com papel admin | DENIED |
| Carlos: `create_store_member_invite` com papel staff e sem overrides | ALLOWED, transação revertida |
| Carlos: mudança de papel por ocorrência `role_change` | DENIED |
| Carlos: elevação pela ocorrência `admission` | DENIED |
| Carlos: `update_store_member_permissions` | DENIED |
| Owner: `change_store_member_role` | ALLOWED, transação revertida |
| Carlos: RLS INSERT de convite `admin` | DENIED 42501 |
| Carlos: RLS INSERT `staff` com `orders.view=true` | DENIED 42501 |
| Carlos: RLS INSERT `staff` com overrides vazios | ALLOWED, transação revertida |

### Critérios pós-publicação
- Confirmar que GitHub Actions `Tests` e `Build` estão SUCCESS no último commit.
- Confirmar deploy Vercel READY do mesmo SHA em `homologacao.optmamenu.com.br`.
- Owner: visualizar e editar permissões individuais/papel/função a partir de Segurança; checar auditoria e mudança de papel em conta de testes, não em colaboradores reais.
- Carlos: `security.view` não habilita as abas `roles`, `custom_roles` e `user_permissions` quando há negativas explícitas; tela Usuários não oferece operação de elevação.
- `users.manage` sem `security.view`: permitir cadastro/convite ordinário, negar configuração de permissões ou atribuição de papel pela API.
- Outras frentes do OptmaMenu não foram alteradas nesta rodada.

### Riscos fora desta frente
- Migration anterior de autorização granular dos **pedidos** `20261014070000_orders_custom_role_visibility_authorization.sql` não consta aplicada nas verificações anteriores; auditar separadamente, sem confundir com a presente governança.
- Revalidar o comportamento de convites para usuários reativados e o fluxo da Vida do Usuário nos testes manuais da homologação.
