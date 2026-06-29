# POS_9 — Clientes 360º e vendas diretas — Análise parcial do diagnóstico

## Status

Análise parcial concluída.

O resultado enviado foi suficiente para validar boa parte da base de clientes, pedidos, vendas online, marketing e fidelidade.

A seção de catálogo de permissões veio vazia porque o diagnóstico ainda não considerava a coluna real `permission_key` de `store_permission_catalog`.

O SQL diagnóstico foi corrigido no commit:

- `545280c5f4ac1e4c65e4ad27a36b79dc258cbfbf`

## Observação sobre `schema_public_current`

O arquivo `docs/supabase_audit/schema_public_current.sql` informado pelo usuário possui muitas linhas no repositório local, mas a leitura via conector GitHub retornou apenas cabeçalho/linhas vazias.

Portanto, a análise abaixo usa o resultado SQL enviado pelo usuário e o `docs/SCHEMA.md` disponível no repositório.

## Resultado do diagnóstico enviado

O arquivo retornou:

- 756 linhas JSON;
- 53 funções/RPCs relacionadas ao domínio;
- 241 colunas de tabelas mapeadas;
- 23 policies RLS;
- 280 grants de tabela;
- 159 grants de função;
- 0 linhas em `permission_catalog` devido ao bug corrigido no SQL.

## Schema de clientes validado

A tabela `customers` já possui os campos fundamentais para a frente:

- `source`;
- `data_ownership`;
- `editable_by_store`;
- `internal_notes`;
- `customer_metadata`;
- `last_order_at`;
- `total_orders`;
- `total_spent`;
- `loyalty_points`;
- `loyalty_tier`;
- `current_tier_id`;
- `marketing_consent`;
- `loyalty_opt_in`;
- `tags`.

Interpretação:

- a base já separa cliente público/WhatsApp/admin/venda direta em termos de modelagem;
- `data_ownership` e `editable_by_store` permitem proteger dados vindos do cliente;
- `internal_notes` permite observação da loja sem alterar dados pessoais protegidos;
- totais comerciais já permitem card resumo do cliente.

## Schema de pedidos validado

A tabela `orders` já possui os campos necessários para vínculo com cliente:

- `customer_id`;
- `customer_name`;
- `customer_phone`;
- `customer_snapshot`;
- `sales_channel`;
- `fulfillment_type`;
- `order_code`;
- `delivery_address_snapshot`;
- `commercial_metadata`;
- `delivery_fee`;
- `subtotal`;
- `total`.

Interpretação:

- venda online, WhatsApp, QR/mesa e venda direta podem compartilhar a mesma tabela de pedidos;
- `customer_snapshot` é adequado para preservar o estado do cliente no momento da venda;
- `sales_channel` e `fulfillment_type` devem ser usados para diferenciar origem/canal.

## RPCs principais de Clientes 360º

### `get_admin_customers_safe`

Status: ativa.

Grants:

- `anon=false`;
- `authenticated=true`;
- `service_role=true`.

Proteção:

- exige owner, `customers.view` ou `customers.manage`.

Retorna dados relevantes para listagem:

- nome;
- telefone;
- e-mail;
- CPF;
- origem;
- propriedade dos dados;
- editável pela loja;
- pontos;
- nível;
- tags;
- observações;
- totais comerciais.

### `get_customer_360_safe`

Status: ativa.

Grants:

- `anon=false`;
- `authenticated=true`;
- `service_role=true`.

Proteção:

- exige owner, `customers.view` ou `customers.manage`.

Retorna:

- cliente;
- pedidos;
- transações de fidelidade;
- endereços;
- consentimentos/logs.

### `create_admin_customer_safe`

Status: ativa.

Grants:

- `anon=false`;
- `authenticated=true`;
- `service_role=true`.

Proteção:

- exige owner ou `customers.manage`.

Comportamento importante:

- cria cliente com `source='admin'`;
- cria como `data_ownership='store_managed'`;
- define `editable_by_store=true`.

Interpretação:

- pode ser reaproveitada para cadastro administrativo;
- para venda direta, pode ser usada como base ou ganhar parâmetro/variante para `source='direct_sale'`.

### `update_admin_customer_safe`

Status: ativa.

Grants:

- `anon=false`;
- `authenticated=true`;
- `service_role=true`.

Proteção:

- exige owner ou `customers.manage`.

Comportamento importante:

- quando `editable_by_store=false` ou `data_ownership='customer_owned'`, preserva dados pessoais e atualiza apenas campos internos/operacionais.

Interpretação:

- a proteção de clientes públicos/customer-owned já está bem desenhada;
- a UI deve refletir isso com campos pessoais desabilitados e aviso visual.

## RPCs públicas de cliente/pedido

### Públicas intencionais

- `create_public_order_by_slug`;
- `customer_login_with_password`;
- `send_customer_otp`;
- `verify_customer_otp`;
- `get_public_customer_loyalty_by_phone`.

Grants:

- `anon=true` quando necessário;
- `authenticated=false`;
- `service_role=true`.

Interpretação:

- coerente com a 9.14D;
- sustentam loja pública, login/OTP de cliente e consulta pública reduzida de fidelidade.

## Venda direta

Diagnóstico:

- não apareceu uma RPC administrativa específica para venda direta com cliente;
- `create_public_order_by_slug` aceita `sales_channel` incluindo `direct`/`in_person`, mas é função pública por slug e não deve ser usada como fluxo admin principal;
- `orders` já possui campos suficientes para venda direta;
- `create_admin_customer_safe` pode criar cliente administrado, mas ainda não resolve pedido/venda completa.

Conclusão:

- a frente precisa criar ou consolidar um fluxo admin de venda direta com cliente;
- idealmente uma RPC segura para venda direta/admin, ou reaproveitar fluxo de pedidos administrativos existente se houver.

Requisito mínimo para venda direta:

- selecionar cliente existente;
- criar cliente rápido;
- gravar `orders.customer_id`;
- gravar `orders.customer_snapshot`;
- definir `sales_channel='direct'` ou `in_person`;
- atualizar `last_order_at`, `total_orders`, `total_spent` via trigger/resumo;
- integrar fidelidade quando pedido for concluído.

## Resumo comercial do cliente

Existe:

- `refresh_customer_commercial_summary(p_customer_id)`;
- trigger `trg_refresh_customer_summary_from_order()`.

Interpretação:

- a base já recalcula total de pedidos, total gasto e último pedido a partir de `orders`;
- isso é essencial para Clientes 360º e segmentação.

## Fidelidade

Há duas camadas visíveis:

### Atual/avançada

- `calculate_order_loyalty_points_advanced`;
- `apply_order_loyalty_points_advanced`;
- `handle_new_order_points_v2`;
- `get_loyalty_advanced_settings_safe`;
- `upsert_loyalty_point_rule_safe`;
- `upsert_customer_benefit_rule_safe`.

### Legada/a revisar depois

- `award_loyalty_points`;
- `handle_new_customer_loyalty`;
- `handle_new_order_points`;
- `redeem_reward`.

Interpretação:

- a frente de clientes deve preferir a camada avançada;
- não mexer agora em fidelidade legada sem mapear triggers/uso real;
- `redeem_reward` ainda está com `authenticated=true` e foi preservada anteriormente por consumidor ativo.

## Marketing e segmentos

RPCs presentes:

- `upsert_customer_segment_safe`;
- `refresh_customer_segments_safe`;
- `upsert_promotion_campaign_safe`;
- `build_campaign_recipients_preview_safe`;
- `prepare_campaign_recipients_safe`;
- `get_campaign_recipients_safe`;
- `mark_campaign_recipient_manual_sent_safe`.

Interpretação:

- a base de segmentação/campanhas está pronta para usar Clientes 360º;
- a próxima UI deve respeitar `marketing_consent`;
- o diagnóstico precisa confirmar permissões do catálogo na nova execução.

## Permissões

O diagnóstico atual não trouxe linhas de `permission_catalog` por causa do bug do SQL.

Mesmo assim, as RPCs mostram uso real de:

- `customers.view`;
- `customers.manage`.

A nova execução precisa confirmar se existem também:

- `orders.view`;
- `orders.manage`;
- `sales.direct.manage`;
- `customers.sensitive.view`;
- `customers.marketing.manage`;
- `marketing.view/manage`;
- `loyalty.view/manage`.

## Lacunas confirmadas

1. Falta confirmar catálogo de permissões com o SQL corrigido.
2. Venda direta com cliente ainda não está claramente consolidada como fluxo admin próprio.
3. A tela atual de clientes deve evoluir para usar integralmente o retorno de `get_customer_360_safe`.
4. A UI precisa refletir `data_ownership` e `editable_by_store`.
5. Dados sensíveis precisam de regra visual/permissão clara.
6. Cliente rápido em venda direta precisa decisão: usar `create_admin_customer_safe` ou criar variante `create_direct_sale_customer_safe`.
7. Camada legada de fidelidade deve ser isolada para não interferir na implementação nova.

## Decisão parcial

Não criar migration ainda.

Antes de codar, rodar novamente o SQL corrigido para trazer `permission_catalog` corretamente.

## Próximo passo

Executar novamente:

- `docs/sql_diagnostics/diagnose_pos9_customers_direct_sales.sql`

Commit corrigido:

- `545280c5f4ac1e4c65e4ad27a36b79dc258cbfbf`

Depois da nova saída, produzir:

- matriz final de permissões;
- plano de implementação da tela Clientes 360º;
- plano técnico da venda direta com cliente;
- lista de migrations necessárias, se houver.
