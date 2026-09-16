# Homologação — fechamento das camadas 0A e 0B

**Data:** 23/08/2026  
**Branch:** `agent/homologacao-geral-20260820`

## Resultado executivo

As camadas 0A (ambiente local) e 0B (gates automatizados básicos) ficam **encerradas como aprovadas**, com lint mantido como dívida conhecida e não bloqueante desta etapa.

## Evidências recebidas do clone local

Preflight executado em Windows com resultado:

- Git branch: PASS;
- Git status: PASS;
- Git head: PASS;
- Node version: PASS;
- npm version: PASS;
- Vitest: PASS;
- Build TypeScript/Vite: PASS;
- Lint: WARN, exit 1, dívida histórica conhecida;
- Playwright: ainda não instalado por decisão de sequência.

O preflight anterior havia revelado dois falsos bloqueios já corrigidos:

1. leitura da versão do Node no Windows via `spawnSync` com caminho contendo espaço;
2. teste de timezone que esperava `12:30` para um timestamp explicitamente `15:30-03:00`, alterando indevidamente o instante representado.

## Lint

O baseline anterior mediu 285 problemas (269 erros e 16 warnings). Essa dívida não será mascarada nem desabilitada globalmente. Ela será reduzida por domínio conforme as telas forem homologadas, priorizando erros com potencial funcional sobre tipagem cosmética.

## Infraestrutura de domínio/e-mail confirmada nesta retomada

- domínio canônico: `https://optmamenu.com.br`;
- redirects locais de Auth adicionados para `http://192.168.1.153:5173/**` e `http://localhost:5173/**`;
- `OPTMAMENU_APP_URL=https://optmamenu.com.br` criado nos Edge Function secrets;
- envio para `faleconosco@optmamenu.com.br` confirmado com entrega em `optmamenu@gmail.com` via ImprovMX;
- SMTP/Brevo/Supabase Auth previamente configurados e documentados.

## Próxima camada

### 0C — migration drift

Objetivo: comparar estado remoto e arquivos locais sem alterar schema.

Já confirmado remotamente que as migrations recentes abaixo existem no Supabase:

- `20260801123553_storefront_inventory_location_and_online_availability`;
- `20260801141629_reconcile_reservations_and_backfill_completed_order_cashbook`;
- `20260801141735_fix_public_order_cashbook_completion_and_pending_receivables`;
- `20260801175630_normalize_transfer_insufficient_stock_message`.

Busca no GitHub atual não encontrou essas quatro migrations pelo nome. A próxima evidência necessária é a listagem local via Supabase CLI e o diretório local `supabase/migrations`.

Durante 0C não executar `db push`, `migration repair`, `db reset` ou nova migration. Primeiro registrar o drift com precisão.
