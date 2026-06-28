# Fase 9.14E.25 — Fechamento consolidado parcial da auditoria authenticated SECURITY DEFINER

## Status

Concluída.

Esta etapa consolida o estado atual da frente 9.14E após as validações incrementais de grants `authenticated` em funções `SECURITY DEFINER`.

## Base atual validada

Após a 9.14E.24:

- total geral: **120 funções** executáveis por `authenticated`;
- `uncategorized_review`: **32**;
- `inventory_stock_transfer`: **28**;
- `users_security_permissions`: **23**;
- `commercial_orders_customers_loyalty`: **16**;
- `purchases_suppliers_quotations`: **12**;
- `settings_configuration`: **7**;
- `internal_technical_candidate`: **2**.

## Resultado acumulado da 9.14E

A auditoria iniciou com **184 funções** executáveis por `authenticated`.

Após as etapas 9.14E.1 a 9.14E.24, o total validado é **120 funções**.

Redução acumulada:

- **64 funções removidas da superfície authenticated**.

## Linha do tempo de contagem

- 9.14E.1 — técnicas internas: **184 → 176**;
- 9.14E.2 — pedidos legados: **176 → 174**;
- 9.14E.3 — hardening de `extend_reservation`: **174 → 174**;
- 9.14E.4 — `create_order_with_reservation` legado: **174 → 173**;
- 9.14E.5 — auxiliares legadas de reserva/estoque: **173 → 169**;
- 9.14E.6 — auxiliares comerciais internas: **169 → 164**;
- 9.14E.7 — comercial seguro restante: documentação sem queda;
- 9.14E.8 — resumo de inventário inutilizado: **164 → 163**;
- 9.14E.9 — estoque/transferências operacionais: documentação sem queda;
- 9.14E.10 — auxiliares internas de compras: **163 → 161**;
- 9.14E.11 — configurações legadas: **161 → 158**;
- 9.14E.12 — permissões técnicas remanescentes: documentação sem queda;
- 9.14E.13 — contextos/gates legados de Segurança: **158 → 153**;
- 9.14E.14 — legadas duplicadas de Usuários/Segurança: **153 → 147**;
- 9.14E.15 — perfil próprio/onboarding legados: **147 → 138**;
- 9.14E.16 — logs legados de Segurança: **138 → 136**;
- 9.14E.17 — membros/perfil administrativo legados: **136 → 128**;
- 9.14E.18 — helpers de permissões inutilizados: **128 → 125**;
- 9.14E.19 — fechamento Usuários/Segurança: documentação sem queda;
- 9.14E.20 — fechamento internal technical: documentação sem queda;
- 9.14E.21 — loja/identidade legadas: **125 → 123**;
- 9.14E.22 — helpers sensíveis/comerciais legados: **123 → 121**;
- 9.14E.23 — config admin inutilizada: **121 → 120**;
- 9.14E.24 — fechamento `uncategorized_review`: documentação sem queda.

## Blocos fechados

### Usuários/Segurança

Status: fechado.

Resultado:

- grupo reduzido de **58** para **23** funções;
- redução de **35 funções** dentro do bloco;
- remanescentes documentadas como exceções intencionais.

Critério de preservação:

- helpers centrais (`is_store_member`, `user_has_store_permission*`);
- matriz v3;
- permissões efetivas;
- papéis e custom roles;
- convites;
- logs e histórico;
- avatar;
- settings de segurança.

### Internal technical

Status: fechado.

Resultado:

- **2 funções remanescentes** documentadas como exceções intencionais:
  - `set_store_role_permission_v3`;
  - `set_store_role_permissions_bulk_v3`.

Critério de preservação:

- são endpoints administrativos ativos da tela Segurança/Permissões;
- possuem gate `can_access_security_section_v3(p_store_id, 'roles', true)`;
- validam catálogo ativo;
- registram log quando possível.

### Uncategorized review

Status: fechado.

Resultado:

- grupo reduzido de **37** para **32** funções;
- redução de **5 funções** dentro do bloco;
- remanescentes documentadas como exceções intencionais.

Critério de preservação:

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

## Blocos já classificados/documentados anteriormente

### Comercial / pedidos / clientes / fidelidade

Status: parcialmente fechado por documentação.

Resultado atual:

- **16 funções** remanescentes.

Decisão anterior:

- funções preservadas por uso direto no frontend/admin;
- atenção futura para endurecer gates onde ainda houver apenas `is_store_member`;
- dados sensíveis de clientes devem continuar tratados com cuidado.

### Estoque / transferências

Status: parcialmente fechado por documentação.

Resultado atual:

- **28 funções** remanescentes.

Decisão anterior:

- funções preservadas por uso direto em serviços, hooks e telas;
- várias funções já validam loja/local/produto e algumas usam permissões granulares;
- hardening futuro recomendado para ampliar `stock.view`, `stock.adjust`, `stock.transfer` e `products.view` onde ainda houver gate genérico.

### Compras / fornecedores / cotações

Status: parcialmente fechado por documentação.

Resultado atual:

- **12 funções** remanescentes.

Decisão anterior:

- funções operacionais preservadas;
- auxiliares internas sem uso direto já tiveram grants revogados.

### Configurações

Status: parcialmente fechado por documentação.

Resultado atual:

- **7 funções** remanescentes.

Decisão anterior:

- funções ativas de settings, segurança, idle timeout, slug e seções foram preservadas;
- helpers legados sem uso direto já tiveram grants revogados.

## Migrations aplicadas e validadas nesta frente

Foram criadas/aplicadas migrations incrementais para remover grants diretos de `authenticated`/`anon`/`PUBLIC` preservando `service_role`, sem dropar funções.

Principais grupos tratados:

- funções técnicas internas;
- pedidos e reservas legadas;
- auxiliares comerciais internas;
- inventário/resumo inutilizado;
- compras auxiliares;
- configurações legadas;
- Segurança/Usuários legados;
- logs antigos;
- helpers de permissões sem uso atual;
- identidade/loja legadas;
- helpers sensíveis/comerciais legados;
- config admin inutilizada.

## Diretriz consolidada

A frente 9.14E seguiu este critério:

1. Buscar uso real no frontend/admin antes de revogar.
2. Preservar funções usadas diretamente por telas, hooks e services.
3. Preservar helpers centrais/transversais quando houver risco de quebrar RPCs, policies ou RLS.
4. Revogar `authenticated` apenas de funções legadas, duplicadas, internas, sensíveis sem uso atual ou substituídas por fluxo mais novo.
5. Preservar `service_role`.
6. Não dropar funções nesta etapa.
7. Documentar exceções intencionais.
8. Não tratar `Leaked Password Protection Disabled`.

## Estado atual para Advisors

O estado atual esperado é:

- ainda haverá warnings de funções `SECURITY DEFINER` executáveis por `authenticated`;
- os warnings remanescentes são, em sua maioria, funções operacionais ou exceções intencionais documentadas;
- a contagem não deve ser perseguida até zero sem redesenhar a arquitetura de RPCs;
- novos cortes devem ocorrer apenas se houver evidência de função sem uso, legado claro ou gate inadequado.

## Hardening futuro recomendado

Sem bloqueio para esta fase.

Recomendações futuras:

1. Reclassificar funções remanescentes em grupos definitivos no diagnóstico para reduzir `uncategorized_review`.
2. Introduzir permissões granulares onde ainda houver apenas `is_store_member` em fluxos sensíveis.
3. Revisar funções comerciais com dados de cliente para garantir `customers.view`, `customers.manage`, `orders.view` e `orders.manage` quando aplicável.
4. Revisar funções de estoque para garantir `stock.view`, `stock.adjust`, `stock.transfer` e `products.view` quando aplicável.
5. Avaliar migração de alguns logs/mensagens para backend/service_role quando houver automação real.
6. Evitar novos endpoints paralelos para permissões, roles e settings.
7. Manter documentação de exceções intencionais junto dos Advisors.

## Próxima etapa recomendada

### 9.14E.26 — decisão de encerramento ou rodada final por grupo

Opções:

1. Encerrar tecnicamente a 9.14E com o estado atual de **120 funções** e seguir para consolidação geral da 9.14.
2. Fazer uma rodada final curta em grupos já parcialmente fechados, sem compromisso de redução:
   - `commercial_orders_customers_loyalty`;
   - `inventory_stock_transfer`;
   - `purchases_suppliers_quotations`;
   - `settings_configuration`.

Recomendação:

- optar por uma 9.14E.26 de decisão/encerramento, evitando novas revogações agressivas sem evidência forte.
