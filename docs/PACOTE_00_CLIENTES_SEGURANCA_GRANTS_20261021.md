# Pacote 00 — Retomada e Segurança (21/10/2026)

**Escopo:** Clientes / Loja Pública — verificação e mitigação pontual, sem alterações nos dados de clientes.

## Baseline conferido

- Branch compartilhada: `agent/homologacao-geral-20260820`.
- HEAD de partida: `08dc6db85d22d91f7932d0e8c6ceb13688d9373d`.
- GitHub Actions Verify: success, execução 39515690671.
- Vercel: `dpl_CG4dnpu4UNp9RqgMKLoUBV693pqf` READY, alias `homologacao.optmamenu.com.br`, mesmo SHA.
- Supabase `lgkkfmqzaorrutuoqeax`: 129 tabelas públicas, todas com RLS; 292 migrations registradas.
- GitHub `supabase/migrations`: 321 arquivos SQL. Apenas 226 nomes de migration coincidem literalmente, 95 nomes de arquivos não coincidem e 66 nomes registrados no banco não coincidem. **Diferenças de nome/versão NÃO provam migração pendente**; precisam de reconciliação por conteúdo/efeito.

## Grants e RLS: fotografia read-only

| Relação | RLS / policies | anon direto | authenticated direto | service_role direto | Decisão |
|---|---|---|---|---|---|
| customer_product_ratings | ativo / 1 restrictive deny | nenhum | nenhum | SELECT/INSERT/UPDATE/DELETE | manter RPC exclusiva |
| customer_cart_drafts | ativo / 0 | nenhum | nenhum | CRUD | manter RPC |
| customer_credentials | ativo / 1 | nenhum | nenhum | CRUD | manter fechado |
| customer_account_deletion_audit | ativo / 0 | nenhum | nenhum | CRUD | manter fechado |
| customer_email_server_proof | ativo / 0 | nenhum | nenhum | CRUD | manter fechado |
| customer_email_verification_challenges | ativo / 0 | nenhum | nenhum | CRUD | manter fechado |
| online_payment_intents / online_payment_events | ativo / 0 | nenhum | nenhum | CRUD | manter fechado |
| customer_sms_otp_issue_ledger / customer_sms_otp_rate_secret | ativo / 0 | nenhum | nenhum | nenhum | validar uso apenas via owner/definer; não abrir automaticamente |
| products | ativo / 8 | SELECT/INSERT | SELECT/INSERT | CRUD | revisar policies antes de ajustar grants |
| stores | ativo / 8 | INSERT, sem SELECT | SELECT/INSERT | CRUD | revisar policies antes de ajustar grants |
| loyalty_point_rules / customer_benefit_rules | ativo / 0 | SELECT | SELECT | CRUD | RLS nega linhas; revisar exposição/grants de leitura |

Levantamento das 129 tabelas: 67 com SELECT por `anon`; 58 com INSERT por `anon`; 87 com SELECT por `authenticated`; 66 com INSERT por `authenticated`; 127 com SELECT por `service_role`. Defaults de `postgres` e `supabase_admin` ainda concedem privilégios amplos para futuras tabelas e sequências. **Não foram modificados.**

## Advisors

- 27 tabelas RLS sem policy (INFO): muitas são intencionalmente fechadas e utilizadas via RPC.
- 44 SECURITY DEFINER disponíveis a `anon` (WARN): revisão individual; não revogar em massa.
- 320 SECURITY DEFINER disponíveis a `authenticated` (WARN): revisão individual.
- 2 funções financeiras com search_path mutável.
- 1 aviso de proteção contra senhas vazadas.

**Risco pontual comprovado:** `mark_online_payment_provider_credential_status_internal(uuid,text,text,text,jsonb)` permitia EXECUTE por `anon` e `authenticated`. Seu corpo faz UPDATE de `store_online_payment_providers` sem verificar o usuário ou vínculo com a loja. Busca por referências nas definições SQL do banco não encontrou outros chamadores PostgreSQL além da própria definição. A migração anexada remove somente acesso direto por roles de navegador, mantém `service_role` e contém assertivas de privilégios. **Ainda não aplicada ao Supabase ativo:** requer teste isolado de consumidores server-side, revisão de logs e autorização para qualquer infraestrutura cobrada.

## Avaliações e LGPD

- Gelinhares: cinco avaliações de cinco produtos e um cliente, notas 5,4,5,3,5 para Abacate, Abacaxi, Acerola, Doce de leite, Graviola.
- A RPC pública `get_public_product_rankings_by_slug` retorna as cinco avaliações corretamente.
- `customer_product_ratings.customer_id` possui FK `ON DELETE CASCADE`; `delete_customer_account_service_safe` de fato exclui linhas de `customers`, podendo apagar avaliações individuais.
- Há uma exclusão executada na Gelinhares em 20/09 e outra na LogLunch em 17/10; **não foi estabelecido nexo com avaliações desaparecidas de Cris/Seu Madruga**.
- Direção futura: agregado por produto/loja com contagem e soma desvinculadas de identidade, revisão da base legal e do momento de agregação, reprocessamento idempotente e testes negativos; não recuperar avaliações sem evidência nem guardar identificadores reidentificáveis no agregado.
- Cinco avaliações aparecem na RPC e os produtos estão ativos/com estoque. O catálogo filtra Favoritos por `!isProductUnavailable` e `review_count > 0`; uma discrepância de duas estrelas vista pelo usuário requer reprodução mobile/visual específica, não correção especulativa.

## Status e decisão

- **Aprovado:** baseline, RLS global, RPC de avaliações, estrutura de isolamento por loja já existente.
- **Exige correção/teste:** grants para futuras tabelas antes de 30/10/2026, `SECURITY DEFINER` administrativa, retenção agregada LGPD, conferência de chamadas server-side, migrações divergentes.
- **Depende de autorização:** criação de branch/infra Supabase com custo, migração em banco ativo, operações em dados reais.
- **Não executado:** DDL em Supabase, recriação de dados de cliente, alteração de médias, refatoração de interface, deploy.
- **Próximo:** Pacote 01 — grants mínimos por tabela criadora, comparação de efeitos das migrations e testes de recriação no ambiente isolado, com matriz completa e GO/NO-GO.

Referência oficial: https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically

## Deployment update (21/10)

The minimal RPC EXECUTE revocation is now applied on active Supabase as version **20261021122536**. Read-only verification: anon=false, authenticated=false, service_role=true. The earlier staged-only references above describe the historical status before deployment. Branch source has been synchronized with the merged Asaas retirement PR #11.
