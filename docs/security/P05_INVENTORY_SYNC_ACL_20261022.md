# P05 — Estoque: revogação mínima da RPC `sync_inventory_balance_from_locations`

**Data:** 22/10/2026 · Repositório `OptmaIdea/optmamenu` · Supabase `lgkkfmqzaorrutuoqeax`.

## Evidência do banco antes da correção

- `public.sync_inventory_balance_from_locations(uuid,uuid,uuid)` é `SECURITY DEFINER`, proprietário `postgres`, e seu corpo não verifica identidade ou vínculo do requisitante com a loja.
- `EXECUTE` está concedido a `PUBLIC`, `anon`, `authenticated` e `service_role`.
- A rotina consolida `inventory_location_balances` e atualiza `inventory_balances`, por IDs enviados à função.
- O chamador `apply_stock_movement_delta_v2` é **SECURITY INVOKER** e permanece executável por `authenticated`: sua chamada legítima à função auxiliar depende desse grant.
- Também há consumidores internos de estoque via funções privilegiadas (reservas, confirmação e cancelamento). Nenhum deles deve ser interrompido.
- Não houve testes mutantes no projeto de produção. O diagnóstico deriva de `pg_proc`, `pg_get_functiondef` e `has_function_privilege`.

## Correção de alcance delimitado

A migration `20261021214612_inventory_sync_revoke_anon_execute_20261022.sql` revoga somente o `EXECUTE` de `PUBLIC` e `anon`, preservando **explicitamente** `authenticated` e `service_role`. Corpo, assinatura, RLS, estoque, reservas e movimentações não são modificados.

CI `p05-inventory-acl` instancia funções sintéticas compatíveis com o corpo real da rotina, aplica o mesmo arquivo SQL e verifica:
- `anon`: tentativa de chamada direta falha por privilégio;
- `authenticated`: o fluxo representativo com invocador mantém soma de saldo/reserva;
- `service_role`: chamada interna preservada;
- nenhuma loja tem saldo contaminado pela outra.

**Limitação prioritária:** A execução de `authenticated` continua disponível diretamente pela Data API. **Isto ainda não fecha completamente a fronteira de autorização por loja.** A próxima correção deve considerar a cadeia `apply_stock_movement_delta_v2` e os consumidores de `SECURITY DEFINER` para evitar regressões em checkout, retirada, estoque e transferências. Não afirmar isolamento autenticado antes de testes HTTP/JWT com permissão por loja.

Mudança sem custo adicional de infraestrutura. Não manipula dados de clientes, estoque ativo ou credenciais.

## Produção e evidências após validação

- PostgreSQL 17 no CI #39701527054: **SUCCESS** em todos os jobs (ACL, auth JWT, calendário, Asaas, testes e build).
- Migration aplicada à instância real Supabase `lgkkfmqzaorrutuoqeax` em versão `20261021214612`, nome `inventory_sync_revoke_anon_execute_20261022`.
- `pg_proc.proacl` após migração: `postgres`, `authenticated`, `service_role` explicitamente; sem `PUBLIC` nem `anon`.
- Security Advisor `anon_security_definer_function_executable` reduziu **43 → 42**; `authenticated_security_definer_function_executable` permanece **319**.
- `SECURITY DEFINER`, assinatura e corpo da função não foram modificados.
- A fronteira do cliente autenticado é dívida real e não está sanada neste PR: não remover o grant de authenticated sem preservar ou refatorar o caminho invoker da movimentação de estoque.
