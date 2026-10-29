# Homologação — Camada 0D — SECURITY DEFINER, grants e RLS

Data: 2026-08-23

## Objetivo

Reduzir a superfície de execução direta de funções `SECURITY DEFINER`, separar RPC pública/autenticada/interna, validar autorização por loja/permissão e impedir que RLS/grants criem acesso cross-store óbvio antes do E2E.

## Estado inicial conhecido

Antes desta frente, a auditoria havia identificado:

- 303 funções `SECURITY DEFINER` no schema `public`;
- 57 executáveis por `anon`;
- 206 executáveis por `authenticated`;
- funções administrativas, helpers e funções trigger aparecendo como RPCs diretamente executáveis.

## 0D.1 — funções trigger internas

Foram identificadas 8 funções `SECURITY DEFINER` com retorno `trigger` e `EXECUTE` externo por herança/grant:

- `capture_store_slug_change()`;
- `enforce_public_customer_identity_context()`;
- `enforce_reward_media_asset_delete()`;
- `enforce_reward_media_asset_limit()`;
- `enrich_stock_movement_order_metadata()`;
- `sync_customer_primary_contacts()`;
- `sync_pdv_stock_exception_occurrence()`;
- `trg_sync_cashbook_closing_occurrence()`.

Foi revogado `EXECUTE` de `PUBLIC`, `anon` e `authenticated` nessas funções.

Validação final: **0** trigger `SECURITY DEFINER` permanece executável por `PUBLIC`, `anon` ou `authenticated`.

## 0D.2 — remover dependência de PUBLIC EXECUTE

A superfície inicial ainda continha funções `SECURITY DEFINER` dependentes do grant default/explicito de `PUBLIC`.

A correção:

- removeu `PUBLIC EXECUTE` de toda a superfície `SECURITY DEFINER`;
- manteve grants explícitos somente nos papeis que precisam de cada RPC;
- removeu `anon` das RPCs administrativas.

Validação final: **0** função `SECURITY DEFINER` com `PUBLIC EXECUTE`.

> Nota de auditoria: `PUBLIC` é pseudo-role. O script de homologação passou a detectar o grant por `aclexplode(coalesce(proacl, acldefault(...)))`, evitando depender de `has_function_privilege('public', ...)`.

## 0D.3 — RPCs exclusivas de equipe e manutenção

Foram removidos grants de `anon` de RPCs de equipe e o reconciliador global de reservas foi isolado.

### Finding crítico fechado

`reconcile_inventory_reservations(uuid, boolean)` aceitava operação de manutenção que não deveria ser atingível diretamente por cliente externo.

Estado final:

- `anon EXECUTE`: false;
- `authenticated EXECUTE`: false;
- `service_role EXECUTE`: true.

## 0D.4 a 0D.7 — autorização explícita nas mutações administrativas

A auditoria deixou de considerar membership simples como autorização suficiente para mutações sensíveis.

Foram endurecidas as fronteiras de:

- helpers internos de estoque, reserva/devolução e log de segurança;
- limpeza/envio administrativo de mensagens;
- resgate de recompensa;
- ajustes físicos/manuais de estoque;
- criação, envio, recebimento e cancelamento de transferências;
- lançamento financeiro manual;
- regras de estoque e configurações comerciais;
- PDV/venda;
- alterações de pagamento;
- ações administrativas de pedidos;
- campanhas/segmentos;
- fidelidade;
- senha master;
- configuração/credenciais do gateway de mensagens.

Quando a implementação operacional era extensa, foi aplicado o padrão:

1. implementação existente renomeada para `*_internal_0d`;
2. implementação interna sem `EXECUTE` para `PUBLIC`, `anon` e `authenticated`;
3. wrapper no nome/assinatura original valida `owner` ou permissão efetiva;
4. wrapper delega para a implementação interna;
5. assinatura consumida pelo frontend permanece estável.

Validação final: **0** função `*_internal_0d` exposta a `PUBLIC`, `anon` ou `authenticated`.

## 0D.8 — mutable search_path restante

A fotografia intermediária encontrou uma única função `public` sem `search_path` explícito:

`is_cashbook_account_plan_system_protected(p_item cashbook_account_plan)`.

Ela é `SECURITY INVOKER`, recebe uma row composta e é usada como helper interno por RPCs de plano de contas. A variante externa por código (`text`) continua separada.

Foi aplicado:

- `SET search_path = public, pg_temp`;
- remoção de `EXECUTE` de `PUBLIC`, `anon` e `authenticated` na variante composta;
- grant explícito somente para `service_role` além do owner da função.

Fotografia final:

- funções `public` totais: **428**;
- `SECURITY DEFINER`: **333**;
- `SECURITY DEFINER` com `PUBLIC EXECUTE`: **0**;
- `SECURITY DEFINER` executáveis por `anon`: **26**;
- `SECURITY DEFINER` executáveis por `authenticated`: **191**;
- `SECURITY DEFINER` sem `search_path` explícito: **0**;
- `SECURITY INVOKER` sem `search_path` explícito: **0**.

O aumento de 303 para 333 funções `SECURITY DEFINER` é esperado nesta frente: os wrappers autorizadores e implementações internas preservadas aumentam o número absoluto de funções, mas as implementações internas não possuem grant externo.

## 0D.9 — regressão descoberta no helper de Compras

A revisão dos 191 grants de `authenticated` encontrou um erro funcional importante, não um bypass:

`update_purchase_quotation_response(...)` validava:

`user_can_purchase_action(store_id, 'manage_quotation')`

mas `user_can_purchase_action(...)` não possuía mapeamento para `manage_quotation`. O resultado era `false` mesmo para usuários que deveriam gerenciar a cotação.

O catálogo possui a permissão ativa `purchases.manage`, portanto foi adicionado o mapeamento:

`manage_quotation -> purchases.manage`.

Isso restaura a intenção de autorização sem relaxar a fronteira tenant/permissão.

## Revisão heurística de mutações authenticated

Foi executado scan das funções `SECURITY DEFINER` acessíveis por `authenticated` procurando mutações SQL cujo corpo não apresente nenhum dos guards conhecidos, como:

- `auth.uid()`;
- owner/permissão efetiva;
- `user_can_purchase_action`;
- membership/helper tenant;
- contexto customer JWT;
- delegação para `*_internal_0d`.

Após o hardening, sobraram apenas três mutações deliberadamente públicas/customer:

- `create_public_order_by_slug`;
- `create_public_order_by_slug_v2`;
- `register_public_customer_safe`.

Nenhuma mutação administrativa apareceu nessa lista residual heurística.

## Classificação das 26 SECURITY DEFINER ainda expostas a anon

A superfície residual pertence às operações que precisam funcionar antes de um login Supabase de equipe.

### Storefront / pedido público

- `get_public_catalog_by_slug`;
- `get_public_storefront_by_slug`;
- `get_public_delivery_methods_by_slug`;
- `get_public_payment_methods_by_slug`;
- `get_public_sales_channels_by_slug`;
- `get_store_by_slug`;
- `resolve_public_store_id_by_slug`;
- `quote_public_order_by_slug`;
- `create_public_order_by_slug`;
- `create_public_order_by_slug_v2`;
- `get_public_order_by_token`.

### Cadastro/login/OTP do cliente

- `check_customer_phone_registration_safe`;
- `register_public_customer_safe`;
- `customer_login_with_password`;
- `send_customer_otp`;
- `verify_customer_otp`;
- `get_public_customer_loyalty_by_phone`.

### Autoatendimento do cliente por contexto JWT próprio

- `get_customer_self_profile_safe`;
- `get_customer_self_addresses_safe`;
- `get_customer_self_consents_safe`;
- `get_customer_self_notifications_safe`;
- `set_customer_self_consent_safe`;
- `update_customer_self_profile_safe`;
- `upsert_customer_self_address_safe`;
- `delete_customer_self_address_safe`;
- `mark_customer_self_notification_read_safe`.

Essas 26 não foram revogadas em massa. A superfície pública/customer terá threat model próprio antes da homologação da área logada do cliente.

## Finding de privacidade ainda aberto

`get_public_customer_loyalty_by_phone(slug, phone)` permite consulta anônima por slug + telefone e retorna dados de fidelidade. Isso conflita com a direção aprovada de área do cliente protegida por senha + OTP.

Não foi removida nesta subcamada para não quebrar silenciosamente um possível consumidor da storefront antes da substituição pelo fluxo autenticado do cliente. O finding permanece explicitamente bloqueador da homologação futura da área logada/customer, não do fechamento do boundary administrativo P0.

## RLS sem policy

As três tabelas com RLS habilitado e zero policies foram verificadas:

- `customer_credentials`;
- `order_message_events`;
- `reserved_store_slugs`.

Para `anon` e `authenticated`, elas também não possuem grants diretos de `SELECT/INSERT/UPDATE/DELETE`.

Conclusão: estado compatível com **deny-by-default intencional**. Não criar policy permissiva somente para silenciar advisor.

## Scan de policies cross-store

Foi feito scan read-only em tabelas com `store_id`, procurando policies que não mencionem store, membership, owner ou helper de permissão.

Os resultados restantes foram policies explicitamente bloqueadoras (`false`) em tabelas de apoio/segurança. Não foi encontrada policy ampla `USING (true)` em tabela tenant-scoped para `anon/authenticated`.

A policy `authenticated` com `USING (true)` observada em `cashbook_account_plan_audit_select_authenticated` pertence a tabela global sem `store_id` e deve ser tratada pela governança específica do plano de contas, não como vazamento cross-store.

## Histórico remoto e arquivos Git

As migrations desta frente foram conferidas diretamente em `supabase_migrations.schema_migrations`. Os nomes Git agora usam exatamente os timestamps registrados remotamente:

- `20260823025326_revoke_execute_from_internal_security_definer_triggers.sql`;
- `20260823025440_harden_security_definer_rpc_execute_grants.sql`;
- `20260823025546_harden_staff_only_security_definer_rpcs.sql`;
- `20260823030033_harden_internal_stock_security_and_message_rpcs.sql`;
- `20260823030411_enforce_permissions_on_stock_transfer_finance_settings_rpcs.sql`;
- `20260823030506_allow_internal_roles_on_permission_wrappers.sql`;
- `20260823030755_enforce_permissions_on_orders_marketing_loyalty_rpcs.sql`;
- `20260823031040_harden_pdv_order_transfer_and_sensitive_settings_rpcs.sql`;
- `20260823095018_harden_cashbook_account_plan_composite_helper.sql`;
- `20260823095421_fix_purchase_quotation_permission_action_mapping.sql`.

Também foi atualizado:

- `scripts/homologation/sql/05_security_definer_execute_boundary.sql`.

Não foi usado `migration repair`, nem renomeada a história remota.

## Estado da Camada 0D

### 0D-A — boundary P0 do banco: **PASS**

Fechado e revalidado:

- trigger interno não exposto como RPC;
- `PUBLIC EXECUTE` zerado em `SECURITY DEFINER`;
- helpers/manutenção internos isolados;
- wrappers administrativos com autorização explícita por owner/permissão;
- `*_internal_0d` sem grant externo;
- manutenção global de reservas somente `service_role`;
- `search_path` explícito em toda a superfície `public` auditada;
- nenhum candidato administrativo mutável residual sem guard conhecido no scan heurístico;
- drift de timestamp das migrations 0D alinhado com a história remota;
- regressão `manage_quotation` corrigida para `purchases.manage`.

### 0D geral: **PARCIAL**

Ainda faltam antes de encerrar toda a camada:

1. threat model específico das 26 RPCs públicas/customer, sobretudo enumeração por telefone/fidelidade e contratos OTP/JWT;
2. regressão frontend/REST dos fluxos administrativos afetados pelos novos grants, preferencialmente no início da Camada 0E/E2E;
3. registrar separadamente qualquer limitação que dependa do fluxo futuro de cliente senha + OTP/OptmaSMSGate.

A camada pode avançar para regressão E2E administrativa sem reabrir o boundary P0 do banco, salvo novo finding.
