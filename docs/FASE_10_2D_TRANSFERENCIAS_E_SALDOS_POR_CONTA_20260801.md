# Fase 10.2D — Transferências e distribuição do saldo por conta

Data: 01/08/2026

## Transferências auditadas

### TRF-20260429-085550-840

Origem: Loja SJN.

- Abacaxi: solicitado 7, disponível 0;
- Amendoim: solicitado 4, disponível 7;
- Tapioca: solicitado 5, disponível 5.

Conclusão: o bloqueio atual é falta física real de Abacaxi na origem, não reserva presa.

### TRF-20260429-003542-345

- Flocos: solicitado 10, disponível 1;
- Manga: solicitado 8, disponível 25;
- Tangerina: solicitado 8, disponível 31.

Conclusão: o bloqueio atual é falta física real de Flocos na origem, não reserva presa.

## UX necessária

Erros operacionais esperados de saldo insuficiente devem:

- exibir nome do produto, disponível e solicitado;
- evitar UUID no toast;
- não usar `console.error` para regra de negócio esperada;
- manter log técnico apenas para falhas inesperadas.

Texto-alvo:

> Não foi possível enviar a transferência. O produto Abacaxi possui 0 unidades disponíveis na origem, mas a transferência solicita 7.

## Filtros da listagem

A nomenclatura e a consulta devem distinguir:

- `Enviadas por este local`: filtra `source_location_id` e mostra o destino;
- `Recebidas neste local`: filtra `destination_location_id` e mostra a origem;
- `Todas`: mostra origem e destino.

## Saldo atual do Livro Diário

Saldo confirmado da Gelinhares no momento da auditoria: R$ 822,20.

### Distribuição já atribuída a contas

- Caixa físico: -R$ 48,00;
- Caixa Loja Centro: R$ 53,70;
- InfinitePay: R$ 65,00;
- Recebíveis de cartão: R$ 88,00;
- CEF: R$ 0,00;
- Carteira Pix genérica: R$ 0,00;
- Maquininha: R$ 0,00;
- Cofre: R$ 0,00;
- Proprietário: R$ 0,00.

Total atribuído diretamente a contas: R$ 158,70.

### Saldo ainda sem conta financeira

- 32 lançamentos confirmados não possuem conta de origem nem de destino;
- saldo líquido não distribuído: R$ 663,50.

Portanto, o card `Saldo atual` está correto como total consolidado, mas ainda não é possível explicar integralmente quanto está em dinheiro, banco/Pix ou cartão porque a maior parte dos lançamentos antigos e alguns fluxos automáticos não foram direcionados a `store_financial_accounts`.

## Fechamento funcional necessário

1. mapear cada forma de pagamento para uma conta financeira padrão da loja;
2. gravar `destination_financial_account_id` nas entradas de venda;
3. gravar `source_financial_account_id` nas saídas;
4. manter cartão em `card_receivable` até liquidação;
5. transferir recebíveis liquidados para banco/Pix conforme conciliação;
6. permitir transferências internas entre caixa, cofre, banco e proprietário;
7. criar visão `Saldo por conta` no Livro Diário;
8. tratar os R$ 663,50 legados por reconciliação assistida, sem atribuição automática cega.
