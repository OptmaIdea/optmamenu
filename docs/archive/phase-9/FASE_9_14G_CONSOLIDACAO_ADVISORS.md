# Fase 9.14G — Consolidação geral de Supabase Advisors

## Status

Concluída.

Esta etapa consolida a frente 9.14 de auditoria e hardening orientada pelos Supabase Advisors.

## Objetivo da frente 9.14

A frente 9.14 teve como objetivo reduzir superfície de exposição, classificar warnings e documentar exceções intencionais sem quebrar fluxos ativos do OptmaMenu.

Escopos tratados:

- diagnóstico/classificação dos Advisors;
- grants de funções `SECURITY DEFINER` para `anon`, `authenticated`, `PUBLIC` e `service_role`;
- RLS em tabelas internas de permissões;
- funções públicas intencionais;
- funções autenticadas administrativas/operacionais;
- exceções intencionais documentadas;
- próximos hardenings recomendados.

## Regra fixa do projeto

O aviso abaixo deve continuar fora do escopo:

- `Leaked Password Protection Disabled`.

Motivo:

- decisão operacional do projeto;
- não deve ser tratado nesta frente;
- não deve bloquear fechamento da 9.14.

## Advisor base recente

Foi considerado o `docs/ADVISORS.md` atualizado no commit:

- `e4a0c8a0ad296a8cd8fa1ec1e126b1ec6cc53a76`.

O arquivo ainda mostra warnings públicos intencionais, como funções públicas de loja, catálogo, pedido público, OTP e cliente público.

Esses warnings são esperados após a 9.14D, pois representam superfície pública controlada por slug/loja pública e regras próprias.

## 9.14A — Diagnóstico e classificação

Status: concluída.

Entregas:

- diagnóstico inicial dos Advisors;
- classificação por grupos;
- separação de funções públicas, administrativas, técnicas e operacionais;
- criação de queries auxiliares em `docs/sql_diagnostics`.

Principais resultados:

- funções administrativas/authenticated-only foram separadas de funções públicas intencionais;
- helpers técnicos foram identificados;
- tabelas internas de permissões foram destacadas para hardening RLS;
- critérios de auditoria foram definidos antes de qualquer revogação.

Critério firmado:

- não revogar grants automaticamente apenas por alerta do Advisor;
- buscar uso real no frontend/admin;
- preservar fluxos ativos;
- revogar apenas quando houver evidência de função interna, legada, duplicada, sensível sem uso ou substituída por fluxo novo.

## 9.14B — Function grants de funções admin

Status: concluída.

Entregas:

- revogação de `anon`/`PUBLIC` de funções administrativas `SECURITY DEFINER`;
- preservação de funções administrativas para `authenticated` quando usadas pelo admin;
- preservação de `service_role`.

Resultado:

- reduziu exposição pública indevida sem quebrar painel administrativo;
- estabeleceu o padrão de grants por papel.

## 9.14C — RLS/tabelas internas de permissões

Status: concluída.

Tabelas tratadas:

- `public.store_permission_catalog`;
- `public.store_role_permission_templates_backup_910c`.

Resultado:

- RLS/hardening aplicado;
- grants diretos restritos;
- tabelas internas protegidas contra acesso comum.

## 9.14D — Funções públicas intencionais

Status: concluída.

Escopo:

- loja pública por slug;
- catálogo público;
- pedido público;
- login/OTP de cliente;
- fidelidade pública reduzida;
- métodos públicos de pagamento/entrega/canais.

Resultado:

- funções públicas intencionais foram auditadas;
- funções com dados de cliente foram reduzidas ou endurecidas;
- `cancel_reserved_public_order` teve grants públicos revogados e ficou `service_role` only;
- loja pública passou a exigir `public_store_enabled=true` em fluxos relevantes;
- respostas públicas de cliente/fidelidade foram reduzidas para evitar exposição desnecessária.

Decisão:

- warnings públicos remanescentes são aceitos como superfície intencional do produto;
- não revogar `anon` de funções que sustentam loja pública, catálogo público, pedido público e OTP público.

## 9.14F — RLS enabled no policy

Status: concluída.

Tabelas tratadas:

- `public.store_permission_catalog`;
- `public.store_role_permission_templates_backup_910c`.

Resultado:

- policies explícitas de deny adicionadas;
- warnings de RLS sem policy removidos dos Advisors;
- grants comuns permanecem restritos.

## 9.14E — Authenticated SECURITY DEFINER

Status: concluída.

Resultado principal:

- início: **184 funções** executáveis por `authenticated`;
- final validado: **120 funções** executáveis por `authenticated`;
- redução acumulada: **64 funções** removidas da superfície `authenticated`.

Distribuição final validada:

- `uncategorized_review`: **32**;
- `inventory_stock_transfer`: **28**;
- `users_security_permissions`: **23**;
- `commercial_orders_customers_loyalty`: **16**;
- `purchases_suppliers_quotations`: **12**;
- `settings_configuration`: **7**;
- `internal_technical_candidate`: **2**.

Critério final:

- a 9.14E não perseguiu contagem zero;
- as 120 funções remanescentes são fluxos ativos, helpers centrais ou exceções intencionais documentadas;
- novas reduções exigiriam redesenho arquitetural ou evidência de função sem uso.

## Principais reduções da 9.14E

Foram removidos grants diretos de `authenticated` de funções como:

- técnicas internas de triggers/sync/seed;
- funções legadas de pedidos e reservas;
- auxiliares comerciais internas;
- helpers de compra sem uso direto;
- funções legadas de configurações;
- contextos/gates antigos de Segurança;
- funções duplicadas de Usuários/Segurança;
- perfil próprio/onboarding legado;
- logs antigos de Segurança;
- helpers de permissão sem uso atual;
- helpers legados de identidade/loja;
- helpers sensíveis como ajuste antigo de estoque com senha e reset de PIN;
- escrita legada de config admin.

## Blocos documentados como exceção intencional

### Usuários/Segurança

Resultado:

- **58 → 23 funções**.

Exceções preservadas:

- `is_store_member`;
- `user_has_store_permission*`;
- matriz v3;
- permissões efetivas do usuário;
- papéis e custom roles;
- convites;
- logs ativos;
- histórico;
- avatar;
- settings de segurança.

### Internal technical

Resultado:

- **2 funções remanescentes**.

Exceções preservadas:

- `set_store_role_permission_v3`;
- `set_store_role_permissions_bulk_v3`.

Motivo:

- apesar da classificação técnica, são endpoints administrativos ativos da tela Segurança/Permissões.

### Uncategorized review

Resultado:

- **37 → 32 funções**.

Exceções preservadas:

- login/loja/owner/role;
- custom roles;
- ações sensíveis;
- marketing/campanhas/mensagens;
- caixa/livro diário;
- dashboard comercial;
- produto/trânsito;
- sessão/idle timeout;
- senha master;
- fidelidade/recompensa ainda consumida.

### Estoque/transferências

Resultado:

- **28 funções remanescentes**.

Decisão:

- preservar por uso direto em services/hooks/telas;
- hardening futuro recomendado para ampliar gates granulares.

### Comercial/pedidos/clientes/fidelidade

Resultado:

- **16 funções remanescentes**.

Decisão:

- preservar por uso direto;
- manter atenção especial a dados sensíveis de clientes;
- evoluir gates para permissões comerciais granulares quando aplicável.

### Compras/fornecedores/cotações

Resultado:

- **12 funções remanescentes**.

Decisão:

- preservar funções operacionais;
- auxiliares internas sem uso direto já removidas da superfície `authenticated`.

### Configurações

Resultado:

- **7 funções remanescentes**.

Decisão:

- preservar funções ativas de settings, segurança, idle timeout, slug e seções.

## Riscos aceitos

A frente 9.14 aceita que ainda existam warnings nos Advisors quando:

- a função é necessária para fluxo público intencional;
- a função é usada diretamente por admin autenticado;
- a função tem gate por loja/permissão;
- a função é helper central/transversal;
- a função tem documentação de exceção intencional;
- remover grant quebraria funcionalidade ativa.

Risco residual principal:

- algumas funções preservadas ainda usam `is_store_member` como gate genérico;
- algumas funções comerciais manipulam dados sensíveis de cliente e devem evoluir para gates granulares;
- algumas funções de estoque podem evoluir para `stock.view`, `stock.adjust`, `stock.transfer` e `products.view` em todos os pontos.

## Padrão a seguir em auditorias futuras

Para novos warnings de Advisors:

1. Identificar função/tabela/role afetado.
2. Buscar uso real no frontend/admin.
3. Verificar se a função é pública intencional, admin ativa, helper interno ou legado.
4. Se for público intencional, validar payload e escopo, não revogar automaticamente.
5. Se for admin ativa, validar gate por loja/permissão e documentar exceção.
6. Se for helper interno/legado sem uso direto, revogar `anon`, `authenticated` e `PUBLIC`, preservando `service_role`.
7. Se houver RLS enabled sem policy, adicionar policy explícita quando fizer sentido para remover ambiguidade.
8. Documentar decisão e validação.

## Hardening futuro recomendado

Sem bloqueio para fechamento da 9.14.

Recomendações:

1. Reclassificar funções remanescentes por domínio definitivo no diagnóstico, reduzindo `uncategorized_review`.
2. Trocar gates genéricos `is_store_member` por permissões granulares nos fluxos sensíveis.
3. Revisar funções comerciais com dados de cliente para reforçar `customers.view`, `customers.manage`, `orders.view`, `orders.manage`.
4. Revisar estoque para reforçar `stock.view`, `stock.adjust`, `stock.transfer`, `products.view`.
5. Revisar campanhas/mensagens se futuramente houver automação real ou envio automático.
6. Revisar fidelidade/recompensa legada quando o módulo avançado substituir todo o fluxo antigo.
7. Manter docs dos Advisors atualizados após novas migrations.

## Decisão final da 9.14G

A frente 9.14 está consolidada tecnicamente.

Não há migration nesta etapa.

A frente pode ser considerada fechada com:

- hardening aplicado onde havia exposição indevida;
- exceções intencionais documentadas;
- riscos residuais conhecidos;
- diretrizes futuras registradas.

## Próxima etapa recomendada

### 9.14H — Closeout final da Fase 9.14

Criar um documento curto de encerramento final da fase, apontando:

- commits principais;
- estado final validado;
- migrations aplicadas;
- avisos aceitos;
- próximos hardenings fora de escopo.

Depois disso, a frente 9.14 pode ser marcada como tecnicamente fechada.
