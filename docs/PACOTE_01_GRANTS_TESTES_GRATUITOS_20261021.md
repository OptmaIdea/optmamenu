# Pacote 01 — Rota de testes sem assinatura Supabase Pro (21/10/2026)

## Custos efetivos e decisão

A organização `OptmaIdea-OptmaMenu` encontra-se no **plano Free**; projeto `lgkkfmqzaorrutuoqeax` está `ACTIVE_HEALTHY`.
O branching hospedado Supabase exige Pro a partir de US$ 25/mês, mais uso por branch Micro desde US$ 0,01344/h (sem cobrir tráfego ou outros serviços).
**Decisão: não contratar, não criar branch hospedada e não migrar o banco ativo nesta rodada.**

O repositório GitHub está público; o GitHub Actions em runners padrão é gratuito para repositórios públicos. Um PostgreSQL 17 com dados sintéticos é criado temporariamente por workflow e destruído ao final.

Fontes:
- https://supabase.com/pricing
- https://supabase.com/docs/guides/deployment
- https://supabase.com/docs/guides/platform/manage-your-usage/branching
- https://docs.github.com/en/billing/concepts/product-billing/github-actions
- https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically

## Ensaios implementados

1. `supabase/tests/p00_internal_payment_rpc_grants.sql`: reproduz a execução pública em função SECURITY DEFINER sintética, aplica a **migration real** `20261021100000_revoke_public_payment_credential_status_internal.sql`, testa negativas com roles `anon` e `authenticated` e positiva com `service_role`.
2. `supabase/tests/p01_future_table_grants.sql`: configura privilégios amplos anteriores num PostgreSQL isolado, os revoga como fará o novo default, prova que objetos preexistentes mantêm privilégios e novos objetos internos não são expostos; depois concede somente SELECT ao catálogo público fictício sob RLS e testa acesso positivo/negativo.
3. A pipeline `.github/workflows/verify.yml` roda esses testes adicionais no PostgreSQL 17 temporário, sem credenciais de produção.

## Limites de evidência

- PostgreSQL real valida ACL, RLS sintética e migration do P00, mas **não** reproduz todos os componentes do Supabase, Edge Functions ou JWTs reais.
- A pipeline não audita reconstrução completa das 321 migrations existentes nem todas as RPCs; divergências entre GitHub e o histórico de 292 aplicações impedem afirmar cobertura integral.
- O P01 completo exige matriz por tabela com chamadas `supabase-js`/`service_role`, reconciliação das migrations e ensaio dos fluxos reais quando for seguro.
- Nenhum teste executa pagamentos, SMS, exclusão de clientes ou acesso a PII reais.
- Não mesclar/aplicar PR #10 até validação de dependências e plano de rollout.

## Próximos critérios de aprovação

- Inventário de `CREATE TABLE` e `CREATE TABLE AS`, diretivas default grants por owner (`postgres` e `supabase_admin`), RLS, policies e callers.
- Matriz de menor privilégio por tabela nova e testes negativos de acesso entre lojas.
- Revisão das demais `SECURITY DEFINER` administrativas críticas.
- Somente então autorização para aplicar alterações ao Supabase ativo, com rollback e check pós-implantação.
