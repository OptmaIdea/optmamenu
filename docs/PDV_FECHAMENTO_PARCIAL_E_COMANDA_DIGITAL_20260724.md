# PDV — Fechamento parcial e direção da comanda digital

**Data:** 24/07/2026  
**Estado:** correções do PDV e das telas Produtos/Categorias; comanda definida
como próxima frente, ainda não implementada.

## 1. Correções deste marco

- O carrinho do PDV passou a consultar `quote_pos_cart_safe`.
- A prévia usa o mesmo motor central da slug e da finalização.
- O carrinho mostra preço-base, preço aplicado, origem da regra, economia e total.
- Dinheiro recebido e troco usam o total já precificado.
- A finalização continua recalculando no backend e permanece idempotente.
- Produtos busca por nome, descrição, código interno, SKU e EAN.
- Produtos e Categorias possuem rolagem horizontal também no topo da tabela.
- A coluna Produto deixou de ficar sobreposta às demais colunas.
- Produtos descontinuados não entram na contagem nem no modal da categoria.
- O PDV possui manifesto e identidade de instalação próprios.

## 2. Exemplo validado

Categoria `Picolé cremoso zero lactose`, escopo combinado:

- 4 Acerola + 4 Abacaxi;
- preço-base: R$ 3,75 por unidade;
- faixa combinada de 8: R$ 3,25 por unidade;
- subtotal-base: R$ 30,00;
- desconto automático: R$ 4,00;
- total: R$ 26,00.

## 3. Separação operacional

Os três fluxos permanecem distintos:

1. **Pedido online/slug:** cliente cria pedido e o painel acompanha a fila.
2. **PDV de balcão:** venda e pagamento ocorrem no mesmo atendimento.
3. **Mesa/comanda:** o garçom registra consumo; o caixa recebe e fecha depois.

A comanda não deve ser simulada como uma venda pendente do PDV nem como um pedido
online. Ela precisa de ciclo de vida e permissões próprias.

## 4. Comanda digital recomendada

### Fluxo mínimo

1. Garçom abre uma comanda para mesa, nome ou código.
2. Adiciona itens em uma ou mais rodadas.
3. O motor central recalcula a comanda completa a cada alteração.
4. Itens confirmados geram o efeito de estoque definido para o atendimento.
5. Garçom envia a comanda para preparo/entrega, sem lançar recebimento.
6. Caixa localiza a comanda aberta.
7. Caixa confere, informa pagamento e dinheiro recebido.
8. O sistema calcula o troco, lança o Livro Diário e encerra a comanda.

### Estados iniciais

- `open` — aberta para consumo;
- `awaiting_payment` — consumo encerrado, aguardando caixa;
- `closed` — recebida e concluída;
- `cancelled` — cancelada com motivo e auditoria.

### Responsabilidades

- **Garçom:** abrir, adicionar, alterar e enviar itens conforme permissão.
- **Caixa:** receber, alterar forma de pagamento autorizada e encerrar.
- **Gerente/owner:** cancelar itens já enviados, reabrir, transferir mesa e tratar
  divergências.

### Regras obrigatórias

- nenhum lançamento no saldo financeiro antes do recebimento;
- preço final sempre pelo motor central;
- vínculo de operador em toda inclusão, alteração e cancelamento;
- cancelamento de item confirmado deve reverter estoque quando aplicável;
- fechamento idempotente para impedir cobrança duplicada;
- suporte futuro a divisão de conta, pagamento parcial, transferência e junção de
  mesas, sem incluir essas extensões no primeiro MVP.

## 5. Próxima sequência

1. homologar a precificação do PDV com os usuários externos;
2. tratar eventuais regressões do uso real;
3. desenhar e implementar o MVP da comanda digital;
4. adicionar troca rápida de operador/PIN e refinamentos da PWA;
5. avançar para fechamento de caixa por sessão/turno.
