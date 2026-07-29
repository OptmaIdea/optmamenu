# POS_9 — Clientes 360º e vendas diretas — 4 UI mínima de venda direta

## Status

Implementada para build/teste local.

## Objetivo

Criar um fluxo visual mínimo para demonstrar venda direta/presencial usando a RPC e o service já validados.

## Arquivos alterados

### Tela criada

- `src/pages/private/admin/commercial/directSales/DirectSalesPage.tsx`

### Rota adicionada

- `src/AppRoutes.tsx`

Rota:

- `/admin/direct-sales`

Permissão:

- `orders.manage`

## Escopo da UI mínima

A tela permite:

- carregar produtos ativos da loja;
- selecionar produto;
- informar quantidade;
- adicionar itens ao carrinho;
- informar nome do cliente;
- informar telefone/WhatsApp;
- informar código da forma de pagamento;
- concluir venda direta;
- exibir o pedido gerado.

## Integração usada

A tela usa:

- `DirectSalesService.createAdminDirectSale(...)`;
- RPC backend `create_admin_direct_sale_order_safe(...)`.

## Fluxo demonstrável

O fluxo mínimo já permite demonstrar:

1. escolha de produto;
2. montagem de venda;
3. identificação simples do cliente;
4. conclusão da venda;
5. criação de pedido concluído;
6. baixa de estoque;
7. registro de movimentação;
8. integração com caixa e fidelidade via backend.

## Decisões desta etapa

A UI foi mantida propositalmente simples.

Não foram incluídos ainda:

- busca avançada de cliente;
- seleção visual de cliente existente;
- seleção visual de forma de pagamento;
- seleção visual de local de estoque;
- desconto por item na interface;
- múltiplos canais de venda;
- impressão/recibo;
- atalho no sidebar.

Esses pontos ficam para refinamento após build e teste funcional.

## Próximo passo

Rodar localmente:

```bash
npm run build
```

Depois testar no navegador:

- `/admin/direct-sales`

Validações manuais sugeridas:

1. abrir a tela com usuário que tenha `orders.manage`;
2. adicionar produto com estoque disponível;
3. concluir venda como `Cliente balcão`;
4. concluir venda com telefone para criar cliente rápido;
5. verificar pedido em `/admin/orders`;
6. verificar baixa em estoque/movimentações;
7. verificar lançamento no livro diário;
8. verificar cliente/fidelidade quando aplicável.

## Próximos refinamentos prováveis

- botão/atalho no sidebar ou tela de Pedidos;
- seletor de cliente existente;
- forma de pagamento por dropdown;
- local de estoque por dropdown;
- campos de desconto;
- resumo visual pós-venda;
- link para Vida do Cliente;
- permissões de modo leitura quando necessário.
