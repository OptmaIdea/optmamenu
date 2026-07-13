# POS_9 — Fechamento das Contas Financeiras

## Status

Concluído e validado em ambiente operacional.

Esta etapa consolida o segundo eixo da classificação financeira do OptmaMenu:

```txt
Plano de contas = o que aconteceu?
Conta financeira = onde o dinheiro está?
```

## Escopo fechado

Foram fechados os seguintes pontos:

- tela de Contas financeiras acessível pelo menu Financeiro;
- modal para criar e editar contas financeiras;
- labels em português do Brasil para tipos e códigos conhecidos;
- diagnóstico de saúde das contas financeiras por loja;
- saneamento automático de padrões quando existe exatamente uma conta ativa por tipo;
- definição manual de padrão quando existe mais de uma conta ativa do mesmo tipo;
- validação da conta Pix padrão da Gelinhares.

## UX — criação e edição

Arquivo ajustado:

```txt
src/pages/private/admin/settings/financialAccounts/FinancialAccountsSettingsPage.tsx
```

Mudança validada:

```txt
Antes: o formulário de edição abria acima da lista inteira.
Depois: Nova conta e Editar abrem em modal.
```

Benefícios:

- fluxo visual mais previsível;
- menos deslocamento de tela;
- padrão mais próximo do Plano de Contas;
- melhor experiência em tablet/mobile.

## Labels em pt-BR

A tela passou a usar helpers centralizados de labels financeiros:

```txt
src/utils/finance/ptBrFinancialLabels.ts
```

Funções usadas/esperadas:

```txt
getFinancialAccountTypeLabel
getFinancialAccountCodeLabel
```

Exemplos de tradução visual:

```txt
cash_drawer      -> Caixa físico
safe             -> Cofre
bank_main        -> Banco principal
pix_wallet       -> Carteira Pix
card_acquirer    -> Maquininha
card_receivable  -> Recebíveis de cartão
owner            -> Proprietário
```

## Diagnóstico de saúde

Arquivo criado:

```txt
docs/sql_diagnostics/validate_store_financial_accounts_health.sql
```

O diagnóstico valida se cada loja possui as contas essenciais para o Livro Diário:

- Caixa físico;
- Cofre;
- Banco;
- Carteira Pix;
- Maquininha;
- Recebíveis de cartão;
- Proprietário.

Também valida:

- ausência de conta ativa por tipo essencial;
- falta de conta padrão ativa por tipo;
- múltiplas contas padrão ativas no mesmo tipo;
- códigos duplicados por loja.

O diagnóstico foi corrigido para usar tabelas temporárias, evitando o erro de CTE fora de escopo no SQL Editor do Supabase.

## Saneamento automático de padrões

Arquivo criado:

```txt
docs/sql_fixes/fix_store_financial_accounts_single_active_defaults.sql
```

Regra aplicada:

```txt
Se a loja possui exatamente uma conta ativa daquele tipo
e nenhuma conta ativa já está marcada como padrão,
essa conta pode ser marcada automaticamente como padrão.
```

Essa regra evita escolhas indevidas quando há mais de uma opção ativa.

## Definição manual de padrão

Arquivo criado:

```txt
docs/sql_fixes/set_store_financial_account_default_manual.sql
```

Caso validado:

```txt
Loja: Gelinhares
Tipo: Carteira Pix
Conta padrão: 542 — InfinitePay
```

Resultado validado:

```txt
status: ok
store_name: Gelinhares
store_slug: gelinharessjn
account_type: pix_wallet
default_code: 542
default_name: InfinitePay
is_default: true
```

## Decisão de produto

Quando existe mais de uma conta ativa do mesmo tipo, o sistema não deve escolher automaticamente.

Exemplo real:

```txt
Gelinhares > Pix
- Carteira Pix
- InfinitePay
```

A escolha da conta padrão é uma decisão operacional da loja.

Para a Gelinhares, foi definido:

```txt
InfinitePay é a conta Pix padrão operacional.
Carteira Pix pode permanecer ativa como conta auxiliar/legado.
```

## Papel das contas financeiras no Livro Diário

As contas financeiras devem orientar onde o dinheiro se encontra ou para onde se movimenta:

- dinheiro físico no balcão: Caixa físico;
- dinheiro guardado: Cofre;
- valores bancários: Banco;
- Pix: Carteira Pix ou provedor Pix configurado;
- cartão antes de cair no banco: Recebíveis de cartão;
- origem/destino do proprietário: Proprietário;
- transferências internas: origem e destino financeiros distintos.

## Regra conceitual consolidada

```txt
Conta do plano de contas explica o motivo econômico.
Conta financeira explica o local financeiro do dinheiro.
```

Exemplos:

```txt
Venda via Pix
- Plano de contas: Venda via Pix
- Conta financeira: InfinitePay / Carteira Pix

Sangria do caixa para o cofre
- Plano de contas: Transferência do caixa para o cofre
- Origem: Caixa físico
- Destino: Cofre

Depósito no banco
- Plano de contas: Depósito do caixa no banco
- Origem: Caixa físico
- Destino: Banco
```

## Resultado esperado após fechamento

Após aplicar saneamento automático e definição manual, o diagnóstico deve retornar:

```txt
summary com issue_count = 0
issues vazio
duplicate_codes vazio
```

## Próxima etapa recomendada

Com Plano de Contas e Contas Financeiras saudáveis, a próxima etapa natural é revisar o Livro Diário para garantir que os lançamentos manuais, vendas e transferências internas usem corretamente:

```txt
account_plan_code
source_financial_account_id
destination_financial_account_id
is_transfer
affects_cash_drawer
affects_financial_result
```

Essa ligação deve preservar a regra já consolidada:

```txt
Pix, cartão e banco não podem inflar o caixa físico.
Saída em dinheiro não pode aprofundar caixa físico negativo.
Transferência interna não afeta resultado financeiro.
```
