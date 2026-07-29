# POS_9 — PDV Rápido (Modo Balcão/PDV) — Primeira Versão

## Objetivo
Implementar uma experiência visual de PDV rápido, interativo e mobile-first para a venda balcão, sem substituir a tela administrativa de venda direta atual, reaproveitando a lógica operacional existente.

## Arquivos Alterados / Criados
- **[NEW]** `src/pages/private/admin/commercial/directSales/components/QuickPosModal.tsx`: Container fullscreen contendo a busca, chips de categorias e filtros.
- **[NEW]** `src/pages/private/admin/commercial/directSales/components/QuickPosProductCard.tsx`: Cards de produto otimizados para clique.
- **[NEW]** `src/pages/private/admin/commercial/directSales/components/QuickPosCartSheet.tsx`: Drawer de carrinho de compras e checkout.
- **[MODIFY]** `src/pages/private/admin/commercial/directSales/DirectSalesPage.tsx`: Integrado o botão "⚡ Abrir PDV rápido" e acoplado o modal de forma não destrutiva.

## Comportamento
- O operador clica em "⚡ Abrir PDV rápido" na tela administrativa de Venda Direta.
- Um modal fullscreen se abre com a visualização mobile-first dos produtos divididos por categorias.
- Ao clicar nos cards, os produtos são inseridos ou incrementados no carrinho.
- O carrinho exibe o resumo completo de valores, permitindo ajuste de quantidade, aplicação de descontos por quantidade e desconto manual adicional.
- A finalização da venda vincula a forma de pagamento selecionada e o cliente (padrão: "Cliente de balcão").
- No fechamento de venda bem-sucedido, o carrinho é esvaziado e o número do pedido gerado é exibido em destaque.

## Limitações
- Funcionalidades de "Mesa" e "Retirada" aparecem como demarcadas para o futuro (indicadas como "em breve" ou temporariamente inativas).
- O fluxo de Delivery permanece direcionado para o catálogo online (slug).

## O que ficou para depois (Futuro)
- Favoritos e Mais vendidos.
- Badge avançado de promoção e desconto no grid de produtos.
- Gerenciamento completo de Mesas e Comandas.
- Impressão de recibos e comprovantes.
- Histórico de vendas separado da fila operacional de Pedidos.

## Checklist de Validação
- [x] O build e lint passam normalmente sem erros de tipagem.
- [x] A tela de venda direta tradicional (/admin/direct-sales) abre e funciona perfeitamente.
- [x] O modal de PDV Rápido abre com layout limpo e responsivo.
- [x] Busca e filtragem por chips de categoria funcionam em tempo real.
- [x] Adicionar, aumentar, diminuir e remover produtos no carrinho funciona corretamente.
- [x] Descontos de quantidade e desconto adicional manual são aplicados e refletidos no total final.
- [x] Seleção de cliente operacional de balcão e forma de pagamento funcionam sem erros.
- [x] Concluir venda dispara a criação do pedido, mostra o código gerado e a venda reflete corretamente no dashboard comercial.
