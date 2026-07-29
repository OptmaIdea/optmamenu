# POS_9 — PDV / Venda direta — Diretriz mobile-first

## Status

Diretriz registrada e primeiro refinamento aplicado.

## Contexto

A venda direta/PDV deve ser uma experiência própria e simplificada, especialmente para quem está operando na frente da loja.

A pessoa do balcão não deve precisar entender ou navegar pelo restante do sistema para vender com segurança.

## Inspiração visual

A referência visual enviada mostra uma experiência de venda com:

- área de categorias/produtos;
- carrinho sempre visível;
- seleção de tipo de atendimento;
- itens com quantidade;
- resumo de total;
- ação principal clara para confirmar.

## Diretriz principal

A tela de PDV deve ser:

```txt
mobile-first
rápida
interativa
com poucos campos obrigatórios
com carrinho claro
com baixo risco de erro operacional
```

## Regra para novas telas

Toda tela nova que exibir listas deve nascer com:

- filtros;
- ordenadores;
- busca quando fizer sentido;
- estado vazio claro;
- ação principal evidente.

Essa regra se aplica a:

- produtos;
- clientes;
- pedidos;
- vendas;
- mesas;
- comandas;
- histórico comercial;
- relatórios operacionais.

## Canais/modos prioritários para PDV

### Mesa

Usado quando há consumo interno com mesa/comanda.

Requisitos esperados:

- selecionar/definir mesa;
- manter consumo aberto;
- adicionar itens ao longo do tempo;
- fechar conta depois;
- permitir cliente cadastrado opcional;
- permitir uso de pontos/fidelidade futuramente.

### Retirada / balcão

Usado quando o cliente pede, paga/retira e vai embora.

Requisitos esperados:

- Cliente de balcão como default;
- telefone opcional;
- fluxo rápido;
- venda já concluída;
- baixa de estoque;
- caixa/livro diário;
- vínculo com cliente operacional de balcão quando existir.

### Delivery

Delivery deve ser priorizado via slug/catálogo online.

Diretriz:

- incentivar o cliente a fazer seu próprio pedido pelo slug;
- evitar lançamento manual de delivery no PDV como fluxo principal;
- delivery manual pode existir depois como exceção/canal alternativo.

## Fora do foco imediato

- e-mail;
- vendedor externo;
- colaborador externo inserindo pedidos;
- canais alternativos complexos.

Esses canais ficam documentados como evolução posterior.

## Primeiro refinamento aplicado

Arquivo alterado:

- `src/pages/private/admin/commercial/directSales/DirectSalesPage.tsx`

Commit:

- `964729ad0bb35255bd292d4ceab73fa8b3a1f275`

### O que foi adicionado

A lista de produtos da venda direta agora possui:

- busca por nome/categoria;
- filtro por categoria;
- ordenador;
- contador de produtos filtrados.

Ordenadores disponíveis:

- Nome A-Z;
- Nome Z-A;
- Menor preço;
- Maior preço;
- Categoria.

## Próximos refinamentos recomendados

### Curto prazo

1. Transformar seleção de produto em cards/tile mobile-first;
2. fixar ou destacar carrinho/resumo no mobile;
3. adicionar modo de atendimento: Balcão, Mesa, Delivery;
4. manter Delivery como orientação para slug;
5. criar primeira estrutura visual de Mesa/Comanda.

### Médio prazo

1. Histórico de vendas separado de Pedidos;
2. PDV com layout mais próximo de aplicativo;
3. categorias rápidas por chips;
4. produtos favoritos/mais vendidos;
5. ações por ícone com tooltip;
6. recibo/impressão futura.

## Cuidados

- não transformar `Pedidos` em histórico de vendas;
- não misturar mesa aberta com venda balcão concluída;
- não forçar telefone para cliente de balcão;
- não forçar delivery manual quando o melhor fluxo for slug;
- preservar permissões e segurança.
