# PDV — Fase 2: rota, bootstrap e catálogo operacional

Data: 24/07/2026

## Objetivo

Criar a fundação navegável do PDV dedicado sem reutilizar o `PrivateLayout`
administrativo e sem antecipar sessão de caixa, offline ou periféricos.

## Entregas

- rota autenticada `/admin/pdv`;
- alias autenticado `/pdv`;
- layout exclusivo `PdvLayout`, sem sidebar;
- proteção por vínculo ativo e `pdv.view`;
- redirecionamento automático do operador somente-PDV;
- fallback contextual de rotas negadas para `/admin/pdv`;
- bootstrap seguro de loja, operador e locais autorizados para venda;
- local de estoque preso ao terminal por loja;
- catálogo reduzido com categorias, produtos, códigos e estoque disponível;
- busca por nome, código interno, SKU ou EAN;
- atualização Realtime de `inventory_location_balances`;
- estrutura extensível `product_codes`.

## Estrutura de códigos

A tabela `product_codes` não usa enum fechado. `code_type` aceita identificadores
extensíveis, como:

```text
internal
ean
sku
supplier
legacy
```

O valor normalizado:

- remove espaços e pontuação;
- preserva zeros à esquerda;
- usa maiúsculas;
- é único por loja enquanto o código estiver ativo.

Um produto pode ter vários códigos, mas somente um código primário ativo por tipo.

## RPC `get_pos_bootstrap`

Entrada:

```text
p_store_id uuid
p_location_id uuid default null
```

Regras:

1. exige usuário autenticado;
2. exige vínculo ativo;
3. exige `pdv.view` ou proprietário;
4. aceita somente local ativo, da loja e com `allow_sales=true`;
5. escolhe por padrão o local público, depois o padrão e então a ordenação;
6. retorna somente dados necessários ao PDV;
7. calcula:

```text
available_stock = greatest(on_hand - reserved, 0)
```

O frontend não consulta a linha completa de `products`, evitando expor custo e
outros campos administrativos ao operador somente-PDV.

## Realtime

`inventory_location_balances` foi adicionada à publicação
`supabase_realtime`. A tela usa o listener central do projeto, filtrado por
`store_id`, e refaz o bootstrap ao receber alteração de saldo.

## UX inicial

A tela já funciona em celular, tablet e computador:

- cabeçalho compacto;
- identificação da loja, local e operador;
- indicador online/offline;
- busca grande;
- categorias em faixa horizontal;
- cards responsivos;
- sinalização de estoque normal, baixo e zerado;
- painel reservado para o carrinho.

O carrinho e a finalização permanecem visualmente bloqueados porque fazem parte
da Fase PDV-3 e dependem da RPC transacional própria do PDV.

## Segurança

- `product_codes` possui RLS;
- leitura: proprietário, Produtos ou PDV;
- escrita: somente proprietário ou `products.manage`;
- `anon` não possui acesso;
- `get_pos_bootstrap` é a superfície reduzida do operador;
- não foi concedido `products.view` ao caixa;
- funções auxiliares de trigger não são executáveis por clientes.

## Próxima etapa

Fase PDV-3:

1. estado próprio `usePosStore`;
2. carrinho persistido por loja/local/operador;
3. inclusão por card e leitor-teclado;
4. `− / quantidade / +` e quantidade digitável;
5. Cliente de balcão e busca reduzida de cliente;
6. pagamento, dinheiro recebido e troco;
7. RPC `create_pos_sale_safe`;
8. finalização idempotente e bloqueio de envio duplicado;
9. lançamento no Livro Diário e auditoria do operador.

Continuam fora desta etapa:

- abertura/fechamento de sessão de caixa;
- venda offline completa;
- câmera para código de barras;
- impressão térmica;
- empacotamento Android;
- Centro de Atendimento e WhatsApp oficial.
