# Fase 9.14H — Closeout final da Fase 9.14

## Status

Concluída.

A Fase 9.14 — Supabase Advisors / Hardening fica tecnicamente fechada.

## Objetivo

Encerrar a frente de auditoria e hardening baseada nos Supabase Advisors, consolidando:

- diagnóstico inicial;
- classificações;
- migrations aplicadas;
- validações;
- warnings aceitos;
- riscos residuais;
- próximos hardenings fora de escopo.

## Escopos concluídos

### 9.14A — Diagnóstico e classificação

- Advisors lidos e classificados;
- funções separadas por grupos operacionais;
- queries auxiliares criadas em `docs/sql_diagnostics`;
- critério de auditoria definido antes das alterações.

### 9.14B — Function grants admin

- grants públicos indevidos de funções administrativas revogados;
- `authenticated` preservado quando havia uso admin real;
- `service_role` preservado.

### 9.14C — RLS/tabelas internas

Tabelas tratadas:

- `public.store_permission_catalog`;
- `public.store_role_permission_templates_backup_910c`.

Resultado:

- hardening de RLS/grants aplicado.

### 9.14D — Funções públicas intencionais

Escopos:

- loja pública;
- catálogo público;
- pedido público;
- login/OTP de cliente;
- fidelidade pública reduzida;
- métodos públicos por slug.

Resultado:

- funções públicas necessárias foram mantidas;
- funções sensíveis foram endurecidas;
- respostas públicas foram reduzidas quando necessário;
- `cancel_reserved_public_order` ficou `service_role` only.

### 9.14F — RLS enabled no policy

Resultado:

- policies explícitas de deny adicionadas;
- sugestões de RLS sem policy removidas dos Advisors.

### 9.14E — Authenticated SECURITY DEFINER

Resultado:

- início: **184 funções** executáveis por `authenticated`;
- final validado: **120 funções** executáveis por `authenticated`;
- redução acumulada: **64 funções**.

Distribuição final:

- `uncategorized_review`: **32**;
- `inventory_stock_transfer`: **28**;
- `users_security_permissions`: **23**;
- `commercial_orders_customers_loyalty`: **16**;
- `purchases_suppliers_quotations`: **12**;
- `settings_configuration`: **7**;
- `internal_technical_candidate`: **2**.

## Warnings aceitos

Warnings remanescentes são aceitos quando documentados como:

- função pública intencional;
- função administrativa ativa;
- helper central/transversal;
- função operacional usada por tela/hook/service;
- função com gate de loja/permissão;
- função cuja revogação quebraria fluxo ativo.

## Aviso fora do escopo

Continuar ignorando:

- `Leaked Password Protection Disabled`.

## Diretriz consolidada

Para Advisors futuros:

1. Não revogar grant automaticamente só porque o Advisor alerta.
2. Buscar uso real no frontend/admin.
3. Confirmar se a função é pública intencional, admin ativa, helper interno ou legado.
4. Revogar `PUBLIC`, `anon` e `authenticated` quando for helper interno/legado sem uso direto.
5. Preservar `service_role`.
6. Evitar `DROP FUNCTION` nesta classe de hardening.
7. Documentar a decisão e validar com diagnóstico.
8. Para RLS sem policy, preferir policy explícita quando a tabela deve permanecer bloqueada.

## Riscos residuais conhecidos

Sem bloqueio para fechamento.

- Algumas funções remanescentes ainda usam gate genérico por vínculo de loja;
- algumas funções comerciais com dados de cliente devem evoluir para permissões granulares;
- funções de estoque devem evoluir para cobertura mais ampla de `stock.view`, `stock.adjust`, `stock.transfer` e `products.view`;
- fluxos de mensagens/campanhas podem ser revisitados se houver automação real;
- funções públicas intencionais devem ser reavaliadas se o modelo de loja pública mudar.

## Próximos hardenings fora de escopo

- Reclassificar funções remanescentes por domínio definitivo;
- reduzir `uncategorized_review` em diagnósticos futuros;
- aumentar permissões granulares em estoque, clientes, pedidos e financeiro/comercial;
- revisar logs/mensagens para backend/service_role em cenários de automação;
- manter documentação dos Advisors sincronizada após novas migrations.

## Decisão final

A Fase 9.14 está tecnicamente fechada.

Estado final aceito:

- hardening aplicado onde havia exposição indevida;
- warnings públicos e autenticados remanescentes documentados;
- riscos residuais conhecidos;
- próximos hardenings registrados;
- nenhuma migration adicional necessária para fechamento desta fase.

## Próxima frente recomendada

Após a Fase 9.14, a sequência natural é retomar o roadmap funcional com a segurança consolidada, priorizando:

- fechamento documental geral da Fase 9;
- revisão de UX fina de permissões `manage=false` em telas restantes;
- evolução de configurações comerciais/pedido online;
- clientes/fidelidade/marketing avançado;
- geração/impressão de QR por mesa;
- hardenings granulares futuros conforme novos fluxos forem criados.
