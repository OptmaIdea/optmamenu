# POS_9 — Plano de contas gerencial, balancete e BI financeiro

## Contexto

Após validar a classificação no Livro Diário com `Categoria` e `Conta financeira`, foi definido que o plano de contas deve evoluir para uma estrutura editável, hierárquica e gerencial, servindo como base para tomada de decisão.

O objetivo não é apenas registrar lançamentos, mas responder perguntas como:

- para onde o dinheiro está indo;
- quais são os maiores custos;
- quais são as maiores fontes de receita;
- quais categorias, segmentos, canais, produtos ou clientes geram mais resultado;
- quais despesas crescem mais ao longo do tempo;
- qual a composição do resultado por período.

## Direção funcional

O plano de contas deve ser:

- editável pela administração;
- hierárquico, com grupos e contas lançáveis;
- compatível com códigos estruturados, exemplo `1.1.1`;
- capaz de alimentar balancete e relatórios gerenciais;
- integrado ao Livro Diário;
- integrado futuramente a vendas, compras, estoque, clientes, fornecedores, canais e centros de custo.

## Exemplo de estrutura

```txt
1 - Receitas
  1.1 - Receitas Operacionais
    1.1.1 - Vendas
    1.1.2 - Serviços
    1.1.3 - (-) Devoluções sobre vendas
    1.1.4 - (-) Cancelamentos sobre vendas
  1.2 - Receitas Bancárias
  1.3 - Receitas Tributárias
  1.4 - Entradas de Caixa
  1.5 - Receitas não Operacionais

2 - Despesas
  2.1 - Matéria-Prima
  2.2 - Despesas Industriais
  2.3 - Despesas Administrativas
  2.4 - Despesas Comerciais
    2.4.6 - Brindes
    2.4.8 - Comissões de Vendas
    2.4.13 - Fretes
    2.4.14 - Pedágio
  2.6 - Despesas Financeiras
  2.10 - Embalagem
  2.13 - Despesas com veículos da empresa
```

## Conceitos importantes

### Grupo

Conta usada apenas para organização e totalização.

Exemplo:

```txt
2.4 - Despesas Comerciais
```

Não deve receber lançamento diretamente se `is_postable = false`.

### Conta lançável

Conta que aceita lançamentos do Livro Diário.

Exemplo:

```txt
2.4.13 - Fretes
2.4.14 - Pedágio
1.1.1 - Vendas
```

### Conta analítica com exploração

Algumas contas devem abrir telas de detalhe e análise.

Exemplo:

```txt
1.1.1 - Vendas
```

Ao abrir essa conta, o sistema deve permitir analisar:

- vendas por categoria de produto;
- vendas por segmento;
- vendas por canal;
- vendas por cliente;
- vendas por período;
- ticket médio;
- margem estimada;
- comparação com períodos anteriores;
- curva ABC de produtos/categorias;
- vendas por loja/unidade, quando houver multilojas.

## Balancete gerencial

Criar visão de balancete por período, com árvore expandível:

```txt
Conta                         Entradas      Saídas       Saldo
1 - Receitas                  10.000,00     0,00         10.000,00
  1.1 - Operacionais          9.500,00      0,00         9.500,00
    1.1.1 - Vendas            9.500,00      0,00         9.500,00
2 - Despesas                  0,00          4.000,00     -4.000,00
  2.4 - Comerciais            0,00          900,00       -900,00
    2.4.13 - Fretes           0,00          300,00       -300,00
    2.4.14 - Pedágio          0,00          120,00       -120,00
Resultado                     10.000,00     4.000,00     6.000,00
```

## Relatórios e consultas desejadas

### Receitas

- maiores fontes de receita;
- vendas por categoria;
- vendas por produto;
- vendas por canal: WhatsApp, loja pública, balcão, QR/mesa, outros;
- vendas por cliente;
- vendas recorrentes;
- crescimento ou queda por período.

### Custos e despesas

- maiores custos por categoria;
- evolução de despesas fixas;
- despesas comerciais;
- fretes e pedágios;
- embalagens;
- comissões;
- perdas e ajustes;
- despesas por veículo, viagem ou entrega futura.

### Resultado

- receita bruta;
- deduções/cancelamentos/devoluções;
- receita líquida;
- despesas operacionais;
- despesas comerciais;
- resultado operacional;
- ajustes não operacionais;
- resultado final do período.

## Modelo de dados futuro sugerido

### cashbook_account_plan

Evoluir ou criar nova migration para suportar:

```txt
code
parent_code
name
description
kind
level
path
is_group
is_postable
nature
active
sort_order
metadata
```

### cashbook_entries

Continuar usando:

```txt
account_plan_code
source_financial_account_id
destination_financial_account_id
affects_cash_drawer
affects_financial_result
is_transfer
```

### Dimensões gerenciais futuras

Além do plano de contas, permitir cruzamentos com:

```txt
product_id
category_id
customer_id
supplier_id
channel
store_location_id
cost_center_id
vehicle_id
trip_id
order_id
purchase_id
```

Nem todas precisam entrar agora, mas a arquitetura deve permitir.

## UX desejada

### Tela Plano de Contas

- árvore expandível/recolhível;
- criar grupo;
- criar conta lançável;
- editar nome/código/tipo;
- ativar/inativar;
- impedir excluir conta com lançamentos;
- permitir reordenar;
- mostrar badge: grupo / lançável;
- buscar por código/nome;
- filtro por receitas, despesas, transferências, ajustes.

### Tela Balancete

- filtro por período;
- árvore com totalizadores;
- expandir/recolher;
- clicar na conta para abrir análise;
- exportar CSV/Excel/PDF futuramente;
- comparar com período anterior.

### Tela de análise da conta

Ao clicar em `1.1.1 - Vendas`, abrir visão com:

- total vendido;
- quantidade de pedidos;
- ticket médio;
- ranking de categorias/produtos;
- canais de venda;
- clientes principais;
- evolução diária/semanal/mensal;
- comparação com período anterior.

## Sequência recomendada

1. Criar migration de hierarquia do plano de contas.
2. Criar seeds gerenciais iniciais.
3. Criar service de plano de contas hierárquico.
4. Criar tela administrativa `Plano de contas`.
5. Adaptar select do Livro Diário para exibir contas lançáveis.
6. Criar balancete inicial por período.
7. Criar drill-down de contas, começando por `1.1.1 - Vendas`.
8. Integrar dimensões comerciais: produto, categoria, canal e cliente.

## Regra importante

O plano de contas classifica o lançamento.
A conta financeira mostra onde o dinheiro está ou de onde saiu.

Exemplo:

```txt
Categoria/plano: 1.1.1 - Vendas
Conta financeira: Carteira Pix
```

Isso significa:

```txt
Foi uma receita de venda, recebida na carteira Pix.
```

Outro exemplo:

```txt
Categoria/plano: 2.4.14 - Pedágio
Conta financeira: Caixa físico
```

Isso significa:

```txt
Foi uma despesa de pedágio, paga com dinheiro da gaveta.
```

Esses dois eixos não devem ser misturados.
