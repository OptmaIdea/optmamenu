# POS_9 — Grupos diversos, empréstimos e transferências no plano de contas

## Contexto

Após a validação da página `/admin/account-plan` e do balancete gerencial, foi identificado que algumas contas ainda podem ficar soltas na árvore. Para uso profissional e tomada de decisão, contas soltas devem ser evitadas.

A decisão é criar grupos de acolhimento gerencial com nomes amigáveis, evitando termos excessivamente contábeis como `ativo` e `passivo` na interface principal.

## Decisão principal

Não deixar contas soltas no plano de contas.

Toda conta deve pertencer a um grupo, mesmo quando não for uma receita/despesa operacional direta.

## Nomenclatura amigável sugerida

Em vez de usar diretamente:

```txt
Ativo
Passivo
Patrimônio líquido
```

Preferir, na interface do OptmaMenu:

```txt
Entradas
Saídas
Transferências
Aportes, retiradas e empréstimos
Ajustes e regularizações
```

Os conceitos contábeis podem existir nos metadados/natureza técnica, mas não precisam ser a primeira linguagem do lojista.

## Estrutura gerencial sugerida

### 1 - Entradas

```txt
1 - Entradas
  1.1 - Receitas operacionais
    1.1.1 - Vendas
    1.1.2 - Serviços
    1.1.3 - (-) Devoluções sobre vendas
    1.1.4 - (-) Cancelamentos sobre vendas
  1.2 - Receitas diversas
    1.2.1 - Receitas bancárias
    1.2.2 - Receitas não operacionais
  1.3 - Entradas de caixa
    1.3.1 - Reposição de divergência
    1.3.2 - Reforço de troco
  1.4 - Aportes e empréstimos recebidos
    1.4.1 - Aporte do proprietário
    1.4.2 - Empréstimo recebido
    1.4.3 - Adiantamento recebido
```

### 2 - Saídas

```txt
2 - Saídas
  2.1 - Custos e matéria-prima
    2.1.1 - Matéria-prima
    2.1.2 - Pequenas compras
  2.2 - Despesas administrativas
  2.3 - Despesas comerciais
    2.3.1 - Brindes
    2.3.2 - Comissões de vendas
    2.3.3 - Fretes
    2.3.4 - Pedágio
  2.4 - Despesas financeiras
  2.5 - Embalagens
  2.6 - Despesas com veículos
  2.7 - Saídas diversas e perdas
    2.7.1 - Perda assumida
    2.7.2 - Ajuste negativo
    2.7.3 - Estorno/Reembolso
  2.8 - Retiradas, pagamentos e empréstimos
    2.8.1 - Retirada do proprietário
    2.8.2 - Pagamento de empréstimo
    2.8.3 - Juros de empréstimo
```

### 3 - Transferências internas

```txt
3 - Transferências internas
  3.1 - Entre caixa e cofre
    3.1.1 - Caixa para cofre
    3.1.2 - Cofre para caixa
  3.2 - Entre caixa e banco
    3.2.1 - Caixa para banco
    3.2.2 - Banco para caixa
  3.3 - Pix e cartões para banco
    3.3.1 - Pix para banco
    3.3.2 - Cartão para banco
  3.4 - Troco
    3.4.1 - Troca de dinheiro para troco
```

## Regra conceitual importante

Plano de contas e conta financeira são eixos diferentes:

```txt
Plano de contas: o que aconteceu
Conta financeira: onde o dinheiro entrou ou saiu
```

Exemplo:

```txt
Plano: 1.1.1 - Vendas
Conta financeira: Carteira Pix
```

Significa: venda recebida no Pix.

Outro exemplo:

```txt
Plano: 2.3.4 - Pedágio
Conta financeira: Caixa físico
```

Significa: pedágio pago com dinheiro da gaveta.

## Transferências

Transferência não deve ser interpretada como receita ou despesa operacional.

Ela representa deslocamento de dinheiro entre contas financeiras.

Exemplo:

```txt
Plano: 3.2.1 - Caixa para banco
Origem: Caixa físico
Destino: Banco principal
```

O efeito financeiro operacional deve ser neutro:

```txt
affects_financial_result = false
is_transfer = true
```

Porém pode afetar saldos de contas financeiras:

```txt
affects_cash_drawer = true quando envolve caixa físico
```

## Empréstimos recebidos

Empréstimo recebido não deve ser tratado como venda nem receita operacional.

No caixa, ele aumenta dinheiro disponível, mas não representa faturamento.

Sugestão:

```txt
Plano: 1.4.2 - Empréstimo recebido
Conta financeira de destino: Banco principal ou Caixa físico
```

Flags sugeridas:

```txt
affects_cash_drawer = true somente se entrar no caixa físico
affects_financial_result = false
is_transfer = false
metadata.loan_event = received
```

## Pagamento de empréstimos

Pagamento de empréstimo também não deve ser misturado com despesa operacional comum.

Sugestão:

```txt
Plano: 2.8.2 - Pagamento de empréstimo
Conta financeira de origem: Banco principal ou Caixa físico
```

Separar, quando possível:

```txt
Principal da dívida -> não afeta resultado operacional
Juros -> despesa financeira, afeta resultado
```

Exemplo futuro:

```txt
2.8.2 - Pagamento de empréstimo principal
2.4.x - Juros de empréstimo
```

## Anotação para lançamentos de caixa futuro

Criar recurso futuro no Livro Diário para tipos especiais:

```txt
Empréstimo recebido
Pagamento de empréstimo
Aporte do proprietário
Retirada do proprietário
Transferência entre contas
Reforço de troco
Sangria
Depósito em banco
```

Esses lançamentos devem ter comportamento guiado, com campos específicos e flags automáticas, evitando que o usuário precise entender `affects_financial_result`, `is_transfer` ou `affects_cash_drawer`.

## Próximos passos recomendados

1. Criar migration de reorganização amigável da árvore.
2. Mapear contas soltas atuais para grupos de acolhimento.
3. Criar grupo `3 - Transferências internas`.
4. Criar contas de empréstimos e aportes.
5. Ajustar o modal do Livro Diário para tipos especiais.
6. Criar drill-down do balancete por conta.
