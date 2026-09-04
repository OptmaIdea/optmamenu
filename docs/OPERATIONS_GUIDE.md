# Guia Operacional Unificado (Produtos, Estoque, Fornecedores, Compras e PDV)

> **Versão Autorizada:** `0.10.0-rc.1`  
> **Escopo:** Operação diária do estabelecimento, gestão de produtos, controle físico de estoque multilocal, compras, PDV rápido e fechamento de caixa.

---

## 📦 1. Gestão de Catálogo de Produtos e Vida do Produto

### 1.1 Cadastro e Edição de Produtos

- O cadastro de produtos é realizado por páginas dedicadas (`/admin/products/new` e `/admin/products/:id/edit`).
- Os campos obrigatórios incluem Nome, Categoria, Preço Base e SKU/Código de Barras.
- O pipeline de imagens otimiza o upload convertendo automaticamente para o formato **WebP** com dimensões padronizadas.

### 1.2 Vida do Produto (`/admin/products/:id/lifecycle`)

A aba Vida do Produto consolida todas as informações históricas do item:

- **Resumo de Movimentações**: Total de entradas, saídas, vendas e saldo atual por localização.
- **Histórico de Preços e Margens**: Exibe preços praticados, custo médio ponderado e margem efetiva por unidade vendida.
- **Filtro de Períodos (`DateRangeFilter`)**: Permite filtrar a análise por predefinições padrão (`Últimos 7 dias`, `Últimos 30 dias`, `Este Mês`, `Personalizado`).

---

## 🏭 2. Estoque Multilocal, Transferências e Divergências

### 2.1 Controle de Saldos por Localização

- O OptmaMenu suporta múltiplos locais de estoque (ex: Depósito Central, Estoque Cozinha, Bar).
- A tabela `inventory_location_balances` mantém os saldos `on_hand` (físico total) e `reserved` (reservado para pedidos online).
- O saldo disponível real é calculado por `on_hand - reserved`.

### 2.2 Transferências Internas (`/admin/transfers`)

- Transferências de produtos entre localizações seguem o fluxo auditável: **Rascunho → Enviada → Recebida**.
- No momento do recebimento, os saldos das localizações de origem e destino são atualizados simultaneamente de forma atômica no banco.

### 2.3 Ajuste de Divergências Físicas (`/admin/stock/movements`)

- Divergências entre o saldo no sistema e a contagem física são corrigidas via lançamento de ajuste (Entrada/Saída manual por divergência).
- Requer permissão explícita `stock.manage` e gera registro auditável com justificativa obrigatória.

---

## 🚚 3. Fornecedores, Compras e Cotações

### 3.1 Gestão 360º do Fornecedor (`/admin/suppliers`)

- Cadastro completo de fornecedores, CNPJ, contatos comerciais, condições de pagamento e prazos de entrega.
- Aba de histórico de compras realizadas por fornecedor.

### 3.2 Pedidos de Compra e Cotações (`/admin/purchases`)

- Emissão de solicitações de compra e cotações de preços.
- Cada nova cotação em lote cria uma **rodada** com identificador `RDC-...`; todas as cotações enviadas às empresas ficam relacionadas e disponíveis na aba **Rodadas de cotação**.
- Em `/admin/stock/quotations`, a rodada funciona como uma análise concorrencial: agrupa ofertas por produto, sinaliza itens indisponíveis ou propostas expiradas e sugere o menor preço unitário válido.
- O responsável pode manter a sugestão por item, trocar fornecedores e quantidades/preços manualmente ou usar **Comprar tudo em** para concentrar a compra em uma única empresa.
- Ao confirmar o plano, o sistema cria um pedido de compra em rascunho para cada fornecedor selecionado. A geração é transacional e só pode ocorrer uma vez por rodada.
- Prazo, frete, pagamento, quantidade atendida e qualidade do fornecedor permanecem critérios obrigatórios de decisão do responsável.
- No celular, os filtros da listagem são recolhíveis e as cotações aparecem em cartões compactos.
- Ao dar entrada na nota fiscal/pedido de compra concluído, o sistema dá entrada automática no estoque do local selecionado e gera a provisão no Livro Caixa.

---

## 💻 4. Operação de PDV Rápido e Venda Direta (`/admin/pdv`)

### 4.1 Interface do Operador de Caixa

- O PDV dedicado em `/admin/pdv` é otimizado para agilidade no balcão:
  - Busca por nome, SKU ou leitura de código de barras.
  - Seleção de cliente cadastrado ou cliente eventual de balcão.
  - Atalhos de teclado para adição e finalização de itens.

### 4.2 Prévia de Comanda e Fechamento Parcial

- Suporte a recebimento parcial de comanda/mesa com cálculo automático do saldo devedor restante.
- Aplicação de regras de preço de atacado combinado na hora do fechamento.

---

## 💰 5. Livro Diário de Caixa e Fechamento de Turno (`/admin/cashbook`)

### 5.1 Abertura, Sangria e Reforço de Caixa

- A abertura de caixa exige a informação do saldo inicial troco.
- **Sangria**: Retirada de valores em espécie para depósito ou segurança.
- **Reforço**: Aporte manual de troco no caixa.

### 5.2 Fechamento Diário de Caixa e Reconciliação

- Ao fechar o caixa, o operador digita o saldo em espécie contado.
- Se houver divergência entre o saldo esperado e o contado:
  1. O sistema classifica a diferença como Sobra ou Falta de Caixa.
  2. Registra uma ocorrência em `cashbook_closing_occurrences`.
  3. Permite a reconciliação formal (ajuste auditado com aprovação do gerente).
