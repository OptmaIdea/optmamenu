# Financeiro — pré-conciliação, conferência e formas específicas

Data: 2026-08-23

## Modelo operacional confirmado

1. Vendas recebidas entram primeiro na conta financeira marcada como **Entrada das vendas**, desde que ela aceite a forma-base do recebimento.
2. A conta preserva a composição do saldo por forma de pagamento.
3. Transferências entre contas só podem ocorrer para destinos compatíveis com a forma de pagamento.
4. **Não distribuído** é uma área de exceção: histórico antigo, lançamento sem rota ou configuração incompleta. Não é o fluxo normal de novas vendas.
5. Alteração posterior da forma efetivamente recebida é permitida com auditoria, inclusive para corrigir pedidos originalmente pendentes.
6. Transferências internas não alteram o resultado do Livro Diário; apenas a localização financeira do saldo.

## Workspace de Saldos por conta

A rota `/admin/financial-accounts` foi dividida em abas:

- **Saldos**: posição por conta e composição por forma de pagamento;
- **Não distribuído**: filtros por período e forma, distribuição individual ou em lote e correção de forma recebida;
- **Conferência**: detalhamento de movimentos por conta, forma e período, com ticadores visuais de sessão e correção individual auditada;
- **Contas e regras**: cadastro de contas, formas aceitas e conta de entrada das vendas.

A origem técnica `order` é apresentada ao usuário como **Venda / pedido**.

## Correção de forma de recebimento

A RPC `change_cashbook_entry_payment_route_safe` permite trocar a forma efetivamente recebida e, quando necessário, a conta financeira exata. A alteração:

- valida loja, permissão, forma ativa e compatibilidade da conta;
- atualiza o lançamento financeiro;
- sincroniza o pedido vinculado quando houver;
- grava histórico em `cashbook_payment_route_audit`;
- não permite alterar transferências internas por esse fluxo.

## Formas específicas por adquirente/carteira

`store_payment_methods` passa a ter:

- `base_code`: natureza canônica da forma de pagamento;
- `preferred_financial_account_id`: conta preferencial para conferência;
- `code` flexível e único por loja para variantes específicas.

Exemplo válido:

- nome: **Cartão de débito InfinitePay**;
- código interno gerado automaticamente: variante própria;
- base: `debit_card`;
- conta preferencial: **InfinitePay**.

A venda continua sendo tratada como débito nos campos legados, mas preserva o código específico para pré-conciliação e conferência. A conta preferencial passa automaticamente a aceitar essa forma específica.

A tela **Configurações da Loja → Pagamento** permite criar e editar formas específicas e não exibe mais o código técnico abaixo do nome do card.

## Duplicata / venda PJ→PJ

Duplicata não será tratada como dinheiro disponível no caixa no momento da venda. O modelo futuro correto é:

`Venda PJ → título/duplicata → Contas a Receber → baixa → forma real de liquidação → conta financeira`.

## Segurança e invariantes

- RPCs de leitura/ajuste financeiro não são executáveis por `anon`;
- tabela de auditoria não possui leitura direta para `anon` nem `authenticated`;
- conta preferencial de forma de pagamento precisa pertencer à mesma loja;
- não pode existir mais de uma conta `Entrada das vendas` por loja;
- vínculos de contas e lançamentos continuam tenant-safe;
- teste read-only permanente: `scripts/homologation/sql/07_financial_reconciliation_and_payment_variants_integrity.sql`.
