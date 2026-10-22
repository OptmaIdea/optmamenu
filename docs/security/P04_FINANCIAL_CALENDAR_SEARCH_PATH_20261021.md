# Pacote 04 — Segurança dos helpers do calendário financeiro

Data: 21/10/2026. Fonte: catálogo SQL ativo do OptmaMenu, PostgreSQL 17.6, project lgkkfmqzaorrutuoqeax.

## Auditoria

Supabase Security Advisor `function_search_path_mutable` apresentou dois achados:
- `public.financial_easter_sunday(integer)` — IMMUTABLE, SECURITY INVOKER;
- `public.financial_banking_holidays_for_year(integer)` — STABLE, SECURITY INVOKER.

As funções chamam apenas funções internas padrão do PostgreSQL e, quando uma depende da outra, usam `public.financial_easter_sunday(y)` explicitamente. Fixar `search_path = ''` evita resolução por caminhos herdados, sem alterar os algoritmos ou concessões EXECUTE.

## Pacote técnico

- Migration SQL: `supabase/migrations/20261022001000_financial_calendar_pin_search_path.sql`;
- teste real PostgreSQL 17: `supabase/tests/p04_financial_calendar_search_path_pg17.sql`;
- GitHub Actions: job `p04-calendar-security`, no qual se instanciam as definições originais capturadas e se aplica a mesma migration.
- Cobertura: feriados e Páscoa 2025/2026/2027/2100 antes/depois, 14 datas por ano, acesso anon/auth preservado, invariantes de SECURITY INVOKER.

## Referência funcional antes da alteração

| Ano | Páscoa | Quantidade datas |
|---|---|---|
| 2025 | 20/04/2025 | 14 |
| 2026 | 05/04/2026 | 14 |
| 2027 | 28/03/2027 | 14 |
| 2100 | 28/03/2100 | 14 |

Não houve alteração de caixa, pagamentos, pedidos, clientes, dados bancários nem credenciais. Não se recomenda revogar grants indiscriminadamente para silenciar Advisors.

Referência oficial: https://supabase.com/docs/guides/observability/advisors?queryGroups=lint&lint=0011_function_search_path_mutable

## Limites

O teste SQL não substitui um teste HTTP do calendário financeiro e não avalia as outras 43/319 funções SECURITY DEFINER. A aplicação no Supabase ativo depende de CI verde e verificação posterior do Advisor.
