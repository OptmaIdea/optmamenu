# POS_9 — Plano de contas financeiro hierárquico

## Contexto

Durante a integração de categoria e conta financeira no Livro Diário, foi definida a intenção de evoluir o plano de contas para uma estrutura hierárquica, semelhante a um plano financeiro tradicional.

A referência visual apresentada mostra uma árvore como:

```txt
1 - Receitas
  1.1 - Receitas Operacionais
    1.1.1 - Vendas
    1.1.2 - Serviços
    1.1.3 - (-) Devoluções S/Vendas
    1.1.4 - (-) Cancelamento S/Vendas
  1.2 - Receitas Bancárias
  1.3 - Receitas Tributárias
  1.4 - Entradas de Caixa
  1.5 - Receitas não Operacionais

2 - Despesas
  2.1 - Matéria-Prima
  2.2 - Despesas Industriais
  2.3 - Despesas Administrativas
  2.4 - Despesas Comerciais
    2.4.4 - Anúncios e Publicações
    2.4.6 - Brindes
    2.4.7 - Catálogos
    2.4.8 - Comissões de Vendas
    2.4.9 - Conduções e Refeições
    2.4.12 - Feiras e Exposições
    2.4.13 - Fretes
    2.4.14 - Pedágio
    2.4.15 - Devolução de mercadoria
    2.4.16 - Táxi
    2.4.18 - Viagens e Estadias
  2.5 - Obrigações Tributárias
  2.6 - Despesas Financeiras
  2.7 - Despesas com Sócios
  2.8 - Despesas de Produção
  2.9 - Ativo Fixo
  2.10 - Embalagem
  2.11 - Despesas Fixas
  2.12 - Despesas com Funcionários em geral
  2.13 - Despesas c/ veículos da empresa
  2.14 - Baixa do ativo fixo
```

## Decisão

O plano atual `cashbook_account_plan` continua sendo usado no curto prazo para categorias simples no Livro Diário.

A evolução hierárquica deve ser feita em sequência própria, para não misturar:

- lançamento financeiro;
- conta financeira de origem/destino;
- classificação contábil/gerencial hierárquica;
- tela administrativa de manutenção do plano de contas.

## Modelo futuro sugerido

Adicionar suporte a:

```txt
code                 código estruturado, exemplo: 2.4.13
parent_code          código pai, exemplo: 2.4
name                 nome exibido em pt-BR
type                 receita | despesa | transferência | ajuste | ativo | passivo | patrimônio
level                nível na árvore
path                 caminho textual/materializado
is_group             se é grupo/pasta ou conta lançável
is_postable          se aceita lançamento
nature               devedora | credora | neutra
active               ativo/inativo
sort_order           ordenação
metadata             dados complementares
```

## Regra de lançamento

No Livro Diário, o usuário deve escolher apenas contas lançáveis:

```txt
is_postable = true
```

Grupos como `2.4 - Despesas Comerciais` aparecem na árvore/filtro, mas não devem receber lançamento diretamente se forem apenas agrupadores.

## UX desejada

A seleção de categoria no Livro Diário deve evoluir para:

- select agrupado por árvore;
- busca por código ou nome;
- exibição amigável como `2.4.13 - Fretes`;
- bloqueio visual para grupos não lançáveis;
- filtros por tipo: receitas, despesas, transferências, ajustes.

## Exemplos de uso no OptmaMenu

- venda em dinheiro: `1.1.1 - Vendas`;
- estorno/devolução: `1.1.3 - (-) Devoluções S/Vendas`;
- pedágio: `2.4.14 - Pedágio`;
- frete: `2.4.13 - Fretes`;
- brinde/promocional: `2.4.6 - Brindes`;
- embalagem: `2.10 - Embalagem`;
- despesas com veículo: `2.13 - Despesas c/ veículos da empresa`;
- reforço de troco: manter como evento de caixa, sem virar receita operacional.

## Próximos passos futuros

1. Criar migration de suporte a hierarquia no plano de contas.
2. Criar seeds iniciais com estrutura básica.
3. Criar tela administrativa para expandir/recolher árvore.
4. Migrar categorias simples atuais para nós lançáveis.
5. Atualizar o modal do Livro Diário para listar categorias em árvore/busca.
6. Preservar compatibilidade com `account_plan_code` já gravado em `cashbook_entries`.
