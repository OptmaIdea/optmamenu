# Contas a Pagar — UI operacional (2026-09-05)

## Escopo

Este bloco expõe no painel administrativo a fundação financeira de compras já criada no backend, sem misturar obrigação financeira com movimentação de caixa.

### Rota

- `/admin/accounts-payable`
- alias: `/admin/payables`

A rota exige `accounts_payable.view`.

## Contas a Pagar

A tela possui:

- visão consolidada de saldo em aberto;
- contagem de títulos atrasados, próximos de vencer e quitados;
- filtros por busca, status, fornecedor e intervalo de vencimento;
- visualização desktop em tabela e mobile em cards;
- detalhe financeiro por título, com parcelas, pagamentos, ajustes e histórico;
- baixa parcial ou total por parcela;
- escolha da forma de pagamento e da Conta Financeira de saída;
- referência e observação da baixa;
- estorno auditável de pagamento;
- abatimento, crédito do fornecedor, devolução, correção e outros ajustes;
- estorno auditável de ajustes;
- cancelamento da obrigação apenas conforme as regras do backend.

Criar ou visualizar a obrigação não movimenta saldo. A saída financeira ocorre somente ao confirmar uma baixa.

## Condições de compra

Na aba `Condições de compra` é possível:

- visualizar modelos ativos/inativos;
- criar e editar condições;
- distinguir à vista e a prazo;
- informar agendas como `30/60` e `30/60/90`;
- associar uma forma de pagamento prevista;
- definir a condição padrão da loja;
- manter modelos iniciais do sistema como presets editáveis por loja.

A sugestão automática da cotação permanece responsabilidade do backend e preserva separadamente condição sugerida, enviada, respondida pelo fornecedor e aceita.

## Segurança

A UI respeita:

- `accounts_payable.view` — acesso à tela;
- `accounts_payable.manage` — ajustes, cancelamento e condições;
- `accounts_payable.pay` — baixa financeira;
- `accounts_payable.reverse_payment` — estorno de pagamento.

A RPC `list_accounts_payable_payment_options_safe` fornece à tela somente contas financeiras e formas de pagamento ativas necessárias para a operação; não retorna saldos. O papel `anon` não possui `EXECUTE`.

## Atalhos

Foi adicionado acesso contextual para Contas a Pagar nas telas de Compras, Livro de Compras, Livro Diário e Contas Financeiras.

## Fora deste bloco

Permanecem separados para etapas seguintes:

- reformulação do recebimento físico;
- Central de Pendências;
- conciliação bancária completa;
- política de saldo negativo/cheque especial.
