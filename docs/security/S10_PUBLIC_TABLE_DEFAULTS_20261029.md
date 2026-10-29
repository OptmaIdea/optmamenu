# S10 — Encerramento da adequação de tabelas `public` do OptmaMenu

Data: **29/10/2026** · Projeto Supabase `lgkkfmqzaorrutuoqeax` · Branch homologação `agent/homologacao-geral-20260820`.

## Decisão oficial de arquitetura e políticas

A regra é **negação por padrão para futuras tabelas/sequências**. Para publicar uma nova tabela pelo Data API, a mesma migration deve (a) ativar RLS, (b) conceder apenas GRANT mínimo, (c) definir policies específicas por loja/usuário, ou (d) documentar que é interna e permanece sem GRANT. O guard P03 já testa (a)/(b)/(d) nas migrations de tabelas criadas após 22/10.

O S10 configura agora os **default privileges efetivos do criador postgres**, em vez de aguardar o rollout de 30/10/2026, retirando todo GRANT futuro automático sobre TABLES e SEQUENCES a `anon`, `authenticated` e `service_role`. Não mexe em ACL atual de tabelas, pedidos, pagamentos, estoque ou clientes, nem em funções/RPCs.

O default de `supabase_admin` é administrado pelo próprio Supabase e não pode ser alterado por `postgres`. Não há tabelas, sequências nem views do schema public de propriedade do supabase_admin na inspeção de 29/10. Documentação: https://supabase.com/kb/troubleshooting/cant-change-the-default-privileges-of-supabase_admin-in-the-public-schema

## Matriz verificada no Supabase antes do S10

| Item | Total | Decisão |
|---|---:|---|
| Tabelas físicas em `public` | **129** | Todas com RLS já habilitado |
| Tabelas com policies | **102** | Preservar as policies existentes; alterar apenas mediante falha comprovada |
| Tabelas RLS sem policies | **27** | **Continuar bloqueadas**: tabelas internas acessíveis por funções autorizadas/service_role, sem criar policies artificiais |
| Views públicas | **34** | **33 security_invoker=true**; 1 view administrativa sem GRANT SELECT para anon/authenticated |
| Tabelas existentes com SELECT por anon | **67** | GRANT atual preservado; efetividade limitada pelas policies |
| Tabelas existentes com SELECT por authenticated | **87** | GRANT atual preservado; efetividade limitada pelas policies |
| Privilegios postgres futuros TABLES/SEQUENCES | **Amplos antes do S10** | Após a migration: **sem concessão automática aos 3 papéis de API** |

### 27 tabelas intencionalmente sem acesso direto

- `public.cashbook_financial_account_allocation_audit`
- `public.cashbook_payment_route_audit`
- `public.customer_account_deletion_audit`
- `public.customer_benefit_rules`
- `public.customer_cart_drafts`
- `public.customer_email_server_proof`
- `public.customer_email_verification_challenges`
- `public.customer_order_cancellation_events`
- `public.customer_order_cancellation_requests`
- `public.customer_profile_sensitive_change_audit`
- `public.customer_sms_otp_issue_ledger`
- `public.customer_sms_otp_rate_secret`
- `public.fidelity_membership_blocks`
- `public.loyalty_membership_audit_events`
- `public.loyalty_participation_audit`
- `public.loyalty_point_rules`
- `public.online_payment_events`
- `public.online_payment_intents`
- `public.online_payment_receivables`
- `public.online_payment_refunds`
- `public.order_message_events`
- `public.order_payment_proofs`
- `public.reserved_store_slugs`
- `public.store_financial_account_payment_methods`
- `public.store_financial_calendar_exceptions`
- `public.store_financial_holidays`
- `public.store_online_payment_providers`

Duas tabelas nesta lista (`customer_benefit_rules` e `loyalty_point_rules`) têm SELECT legado concedido, mas **RLS sem SELECT policy**; não retornam linhas pela Data API. Não adicionar SELECT policy nem revogar abruptamente sem revisar clientes legados. Outros 25 não têm SELECT anon/authenticated. A categoria INFO do Security Advisor é esperada, não vulnerabilidade a ser corrigida com OPEN policy.

## Três perfis de criação de tabelas

**1. Catálogo explicitamente público**: `GRANT SELECT TO anon`, RLS com restrição de loja publicada e produto publicado. Não conceder UPDATE/DELETE/INSERT anônimo por conveniência.

**2. Administração autenticada**: GRANT seletivo para `authenticated`; RLS exige `store_id` e permissão da loja, com USING e WITH CHECK para escritas.

**3. Internas (OTP, credenciais, conciliação, auditoria)**: RLS ligado **sem policies de browser e sem grants diretos**. Acesso só por rotinas explicitamente autorizadas / service_role com GRANT explícito caso requerido.

## Verificação automatizada

O teste S10 no PostgreSQL 17 reproduz a situação atual, aplica o **mesmo SQL da migration**, cria objetos novos para confirmar negação, demonstra GRANT+RLS para catálogo público e confirma que uma tabela/sequence já existentes preservam os direitos anteriores. GitHub Actions continua exigindo P00-P09, S08-S09, suíte JS e build para merge.

## Fronteira de regressão e trabalho residual separado

**Não alterar nesta etapa** tabela atual, saldo físico, OptmaPay, checkout, cancelamento, fidelidade, sesssões, OTP ou JWT. Regras de RPCs novas continuam a exigir auditoria de EXECUTE em cada migration; revogar o default EXECUTE global em todas as schemas sem revisar chamadores poderia interromper helpers do Supabase e foi deliberadamente excluído do escopo de TABELAS.

O Security Advisor poderá continuar mostrando 28 `rls_enabled_no_policy` (27 public + 1 private), e avisos de funções `SECURITY DEFINER` ainda acessíveis à API. Esses avisos são **distintos** do problema da exposição automática de **novas tabelas public**.

`stores.stock_password_hash` segue sendo assunto específico de credencial/coluna que precisa migração segura coordenada, não uma consequência do rollout de 30/10. Não declarar segurança integral do produto concluída com base apenas no S10.

## Conclusão operacional

Quando a migration estiver aplicada, `pg_default_acl` comprovar ausência de grants de futuros TABLES/SEQUENCES, o CI verde, HEAD do GitHub e Vercel READY para o mesmo commit, **encerrar formalmente a frente de adequação de tabelas public**. Prioridade subsequente: finalizar Clientes com testes humanos de mensagens sem regressão em pedidos e pagamentos.
