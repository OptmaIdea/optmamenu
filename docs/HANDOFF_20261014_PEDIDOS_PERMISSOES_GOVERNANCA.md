# Handoff — Permissões de pedidos e badge (14/10/2026)

## Contexto e evidência de banco
- Loja: Gelinhares. Carlos Henrique é membro ativo com papel nativo `admin`, papel personalizado **Usuário Master** (`base_role=admin`); `orders.view`, `commercial.view` e `orders.manage` efetivos estão autorizados.
- Simulação transacional, com `SET LOCAL ROLE authenticated` e contexto `auth.uid()` de Carlos: `is_store_member=true`, `orders.view=true`, loja acessível, `get_admin_orders_safe('all',500)` retornou **127 pedidos** (incluindo **2 reserved**); `get_active_order_count` retornou **2**. O problema de lista vazia relatado no navegador não se reproduziu na RPC sob esse contexto; portanto a causa exata da sessão do navegador **não foi demonstrada**.
- A página `Orders.tsx` lia a loja do `localStorage` independentemente do `storeId` validado por `PrivateLayout` (que é usado no badge), e impedia o carregamento da RPC se uma segunda consulta a `stores` falhasse. Isso oferece dois pontos de divergência. Não prova isoladamente qual ocorreu na sessão afetada.
- Falha de segurança confirmada: um membro ativo de papel `staff`, com `orders.view=false`, conseguiu executar `get_admin_orders_safe(...,'all',10)` e receber 10 pedidos, além do badge 2, porque ambas as RPCs validavam apenas `is_store_member`.

## Mudanças propostas
1. `PrivateLayout.tsx` passa o `storeId` selecionado à rota filha via contexto do `Outlet`; `Orders.tsx` usa o mesmo valor do badge, nunca um valor paralelo em `localStorage`.
2. A RPC de pedidos é a fonte autoritativa: falhas ao ler metadados de `stores` não ocultam pedidos. Falha na RPC agora exibe erro com nova tentativa em vez de um estado vazio enganoso; respostas concorrentes antigas são ignoradas.
3. Os controles mutáveis de pedidos exigem `orders.manage`; cancelar exige também `orders.cancel`. O backend continua autoritativo.
4. Migration `20261014070000_orders_custom_role_visibility_authorization.sql`: as duas RPCs passam a exigir owner da loja ou `commercial.view` e `orders.view` efetivos, além de membership ativa. Badge inclui `out_for_delivery` como a tela atual.
5. Testes Vitest unitários para enumeração dos status atuais.

## Homologação obrigatória
- Carlos: badge 2, **Pedidos atuais** 2, **Todos os status** mostra todos os pedidos retornados (até 500); alterar entre abas, recarregar e voltar da tela de cliente.
- Owner: mesma contagem, listagem e ações administrativas.
- Staff com `orders.view=false`: ambas as RPCs devem responder `access_denied` sem retornar dados.
- Usuário com `orders.view=true` e `orders.manage=false`: lista visível, ações de alteração e comprovantes de aprovação não acessíveis; backend impede escrita.
- Testar com a sessão real de Carlos: essa etapa é necessária para confirmar a resolução do sintoma observado no navegador.

## Riscos e limites
- Não foram alteradas contas, vínculos ou permissões de indivíduos.
- Não foram modificados Clientes, Fidelidade ou OptmaPay.
- Comparar o SHA implantado na Vercel com a branch de homologação e confirmar o workflow de build/test.

## Registro de execução — 14/10/2026

- Commit funcional: `4a6a5eee692403b0d59817c898435b7c074663cb`. GitHub Actions Verify: **success**; deploy Vercel `dpl_7D291EyhJ3RadzPr1CWRsVDQfMFg`: **READY**, e `homologacao.optmamenu.com.br` apontou para este deploy durante a validação.
- Commit de correção de terminadores SQL: `ded33d58720262192af3962a4bedef496c7ddfa5`.
- Migration: a primeira tentativa de aplicação falhou com erro de sintaxe no segundo `CREATE FUNCTION` e foi revertida pela transação; o arquivo foi corrigido no commit posterior. A tentativa de aplicar o arquivo corrigido recebeu bloqueio explícito de segurança da ferramenta. **Não foi aplicada ao Supabase por esta sessão.**
- Uma consulta read-only posterior a `pg_get_functiondef` confirmou que `get_admin_orders_safe` e `get_active_order_count` **ainda não** fazem a verificação granular nova. Até aplicar a migration, a exposição de dados pelo acesso via RPC para `staff` sem `orders.view` permanece.
- Aplicação pendente: usar **Supabase SQL Editor** no projeto `lgkkfmqzaorrutuoqeax` para executar integralmente o arquivo SQL versionado `supabase/migrations/20261014070000_orders_custom_role_visibility_authorization.sql`, mantendo `BEGIN/COMMIT`. Conferir erro/rollback; registrar versão no histórico de migrations em conformidade com o processo do projeto (não assumir execução via Vercel).
- Após executar, rodar novamente os testes de contrato owner, Carlos, staff sem `orders.view` e loja cruzada; verificar que as duas RPCs exigem a permissão. **Não homologar a frente como inteiramente concluída antes disso e do teste no navegador com a sessão real de Carlos.**
