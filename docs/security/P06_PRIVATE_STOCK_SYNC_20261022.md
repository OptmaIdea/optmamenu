# P06 — Retirar sincronização privilegiada de estoque da Data API pública

Data: 22/10/2026. Pré-condição: PR #15 aplicado, branch shared HEAD 81e97fa1.

## Achado

`public.sync_inventory_balance_from_locations(uuid,uuid,uuid)` executa com SECURITY DEFINER e recebe IDs de loja/produto,
sem verificar o usuário. Seu grant authenticated é obrigatório porque `apply_stock_movement_delta_v2` é SECURITY INVOKER
e chama a rotina na movimentação legítima. Revogar EXECUTE de authenticated quebra esse caminho.

## Solução

Movimentar a função por ALTER FUNCTION ... SET SCHEMA para `optmamenu_stock_internal` (esquema NÃO exposto à Data API),
sem mudar o OID, o corpo, o dono, o SECURITY DEFINER nem os grants executáveis.
Atualizar somente a referência ao helper em `public.apply_stock_movement_delta_v2`, preservando o corpo integral
capturado via pg_get_functiondef (snapshot MD5 preflight para recusar sobrescrita de alterações concorrentes).
Manter USAGE do esquema interno para authenticated e service_role, mas negar a anon e PUBLIC.
supabase/config.toml expõe `public` e `graphql_public`, não o novo esquema.

## Teste reproduzível / CI gratuito

PostgreSQL 17: fixtures sintéticas do P05 e a definição completa original de apply_stock_movement_delta_v2;
teste aplica a migration real, confere relocação, grants, corpo e cálculo de saldos.
PostgREST v14.13: expõe SOMENTE public, verifica JWTs assinados em Node com segredo efêmero;
teste negativo `/rpc/sync_inventory_balance_from_locations` = 404, profile privado = 406;
testes positivos de invocador com papel autorizado A/B e negativos de usuário de outra loja e operador só leitura.

**Limite operacional:** o teste não executa o `apply_stock_movement_delta_v2` completo para todos os eventos
(entry, exit, confirmation, cancellation, transfer). Testa sua recompilação e a invocação do helper via
caminho SECURITY INVOKER representativo. Testes de checkout, retirada e transferência reais permanecem pendentes.

**Risco restante:** `inventory_location_balances` tem políticas antigas de membros que permitem operações
de estoque sem distinção explícita da permissão `stock.adjust`/`stock.transfer`.
Essa política deve receber endurecimento em pacote separado com mapeamento de consumidores.

Não alterar a lista de esquemas expostos, nem conceder ALL, nem alterar saldos de estoque na implantação.
Não há instância paga envolvida.
