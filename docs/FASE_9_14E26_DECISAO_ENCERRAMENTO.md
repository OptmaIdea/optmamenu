# Fase 9.14E.26 — Decisão de encerramento da auditoria authenticated SECURITY DEFINER

## Status

Concluída.

Esta etapa registra a decisão técnica de encerrar a frente 9.14E no estado atual validado.

## Advisor base

Foi considerado o `docs/ADVISORS.md` atualizado no commit:

- `e4a0c8a0ad296a8cd8fa1ec1e126b1ec6cc53a76`.

Observação do projeto:

- o aviso `Leaked Password Protection Disabled` permanece fora do escopo e deve continuar sendo desconsiderado.

## Estado atual validado

Após a 9.14E.25, o diagnóstico de funções `SECURITY DEFINER` executáveis por `authenticated` permanece em:

- total geral: **120 funções**.

Distribuição:

- `uncategorized_review`: **32**;
- `inventory_stock_transfer`: **28**;
- `users_security_permissions`: **23**;
- `commercial_orders_customers_loyalty`: **16**;
- `purchases_suppliers_quotations`: **12**;
- `settings_configuration`: **7**;
- `internal_technical_candidate`: **2**.

## Resultado acumulado da 9.14E

A frente iniciou com **184 funções** executáveis por `authenticated`.

Após a auditoria incremental, o total validado é **120 funções**.

Redução acumulada:

- **64 funções removidas da superfície authenticated**.

## Decisão técnica

Encerrar tecnicamente a frente 9.14E neste estado.

Motivos:

1. As funções claramente legadas, duplicadas, internas ou sem uso direto atual foram tratadas.
2. As funções sensíveis sem consumidor operacional atual tiveram `authenticated` revogado.
3. As funções restantes foram classificadas como fluxos ativos ou exceções intencionais.
4. Perseguir contagem zero exigiria redesenhar arquitetura de RPCs, não apenas ajustar grants.
5. Revogações adicionais sem evidência forte aumentariam risco de quebra funcional.

## Interpretação dos warnings remanescentes

Os warnings remanescentes de `authenticated` não devem ser tratados automaticamente como erro.

Eles representam uma lista de funções que ainda podem ser executadas por usuários autenticados, mas que foram preservadas por pelo menos um dos critérios abaixo:

- uso direto no frontend/admin;
- gate por loja/permissão;
- helper central usado por RPCs, policies ou RLS;
- fluxo público/admin necessário;
- dependência operacional ainda ativa;
- exceção intencional documentada.

## Blocos encerrados nesta frente

### Usuários/Segurança

Status: fechado.

Resultado:

- **58 → 23 funções**.

Decisão:

- 23 remanescentes documentadas como exceções intencionais.

### Internal technical

Status: fechado.

Resultado:

- **2 funções remanescentes**.

Decisão:

- `set_store_role_permission_v3` e `set_store_role_permissions_bulk_v3` são endpoints administrativos ativos da matriz de permissões.

### Uncategorized review

Status: fechado.

Resultado:

- **37 → 32 funções**.

Decisão:

- 32 remanescentes documentadas como exceções intencionais por uso ativo ou papel transversal.

### Comercial / pedidos / clientes / fidelidade

Status: documentado como exceções operacionais.

Resultado:

- **16 funções remanescentes**.

Decisão:

- preservar por uso direto no frontend/admin;
- revisar futuramente gates granulares para clientes, pedidos e fidelidade.

### Estoque / transferências

Status: documentado como exceções operacionais.

Resultado:

- **28 funções remanescentes**.

Decisão:

- preservar por uso direto em services/hooks/telas;
- revisar futuramente gates granulares para `stock.view`, `stock.adjust`, `stock.transfer` e `products.view`.

### Compras / fornecedores / cotações

Status: documentado como exceções operacionais.

Resultado:

- **12 funções remanescentes**.

Decisão:

- preservar funções operacionais;
- auxiliares internas sem uso direto já foram revogadas.

### Configurações

Status: documentado como exceções operacionais.

Resultado:

- **7 funções remanescentes**.

Decisão:

- preservar funções ativas de settings, segurança, idle timeout, slug e seções.

## Sem nova migration

Nenhuma migration foi criada nesta etapa.

A 9.14E.26 é uma etapa de decisão/encerramento, não de alteração SQL.

## Critério final adotado

A frente 9.14E fica encerrada com este critério:

- não revogar `authenticated` apenas porque o Advisor alerta;
- buscar uso real antes de qualquer alteração;
- tratar funções públicas/admin intencionais por documentação;
- revogar apenas funções legadas/inativas/sensíveis sem uso;
- preservar `service_role`;
- evitar drops de função nesta fase;
- registrar exceções intencionais.

## Hardening futuro fora do escopo da 9.14E

Recomendações futuras:

1. Reclassificar funções remanescentes por domínio definitivo, reduzindo `uncategorized_review` em diagnósticos futuros.
2. Substituir gates genéricos `is_store_member` por permissões granulares nos fluxos mais sensíveis.
3. Revisar funções comerciais com dados de cliente para reforçar `customers.view`, `customers.manage`, `orders.view` e `orders.manage`.
4. Revisar funções de estoque para reforçar `stock.view`, `stock.adjust`, `stock.transfer` e `products.view`.
5. Avaliar migração de logs/mensagens para backend/service_role quando houver automação real.
6. Revisar funções públicas intencionais caso o modelo de loja pública mude.
7. Manter o padrão de exceções documentadas em `docs/ADVISORS.md` ou documentação vinculada.

## Próxima etapa recomendada

### 9.14G — Consolidação geral de Advisors

Como a 9.14E está encerrada, a próxima etapa recomendada é consolidar a frente 9.14 como um todo:

- 9.14A — diagnóstico/classificação;
- 9.14B — function grants admin;
- 9.14C/9.14F — RLS/tabelas sem policy;
- 9.14D — funções públicas intencionais;
- 9.14E — authenticated SECURITY DEFINER;
- documentação final de riscos aceitos e próximos hardenings.
