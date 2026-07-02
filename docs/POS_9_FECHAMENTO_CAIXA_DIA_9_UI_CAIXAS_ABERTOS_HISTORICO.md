# POS_9 - Financeiro - Fechamento do caixa do dia - UI caixas abertos e historico

## Status

Primeira versao visual de caixas abertos, caixas atrasados e historico implementada.

## Arquivo alterado

- `src/pages/private/admin/financial/cashbook/components/DayClosingPanel.tsx`

Commit:

- `4917968a9451c5a5dc6ae76b9f4420de62077c8f`

## O que foi implementado

### 1. Caixas abertos

A tela passa a carregar:

- `CashbookService.listDayClosingStatus(storeId, 120, 3)`.

Com isso, mostra dias com movimento ainda nao fechados.

Cada caixa aberto mostra:

- data;
- quantidade de lancamentos;
- total realizado;
- idade em dias;
- pendentes, se houver;
- indicador de atraso quando aplicavel.

### 2. Caixas atrasados

Se houver caixas abertos acima do limite temporario de 3 dias, aparece alerta visual.

Regra temporaria:

- `allowed_open_days = 3`.

Regra futura:

- tornar configuravel por loja.

### 3. Substituicao do date picker livre

A selecao principal deixa de ser por data livre e passa a ser feita pela lista de caixas abertos.

Fechamentos antigos podem ser consultados pelo historico.

### 4. Caixa fechado bloqueado

Quando a data selecionada ja possui fechamento `closed`:

- o formulario de edicao deixa de aparecer;
- a mensagem fica mais amigavel;
- a tela mostra resumo do fechamento;
- a alteracao/reabertura fica para fluxo posterior com permissao superior.

### 5. Historico de fechamentos

Adicionada area `Historico de fechamentos`.

Ela mostra:

- data;
- horario de fechamento;
- esperado;
- conferido;
- diferenca;
- observacao;
- detalhes externos salvos em metadata;
- botao `Ver detalhes`.

### 6. Comportamento apos fechar caixa

Ao fechar caixa:

- o formulario e limpo;
- a lista de caixas abertos e atualizada;
- o caixa fechado sai da lista de abertos;
- o fechamento aparece no historico.

## Fora do escopo desta entrega

Ainda nao implementado:

- reabrir caixa fechado;
- permissao superior para alterar fechado;
- configuracao por loja do prazo maximo;
- multiplos caixas reais por turno/terminal/usuario;
- sangria/retirada de caixa;
- impressao/exportacao do fechamento.

## Validacao sugerida

1. Rodar `git pull`.
2. Rodar `npm run build`.
3. Abrir `/admin/cashbook`.
4. Ir em `Fechamento do dia`.
5. Confirmar que aparecem caixas abertos.
6. Confirmar que caixas antigos aparecem como atrasados.
7. Selecionar um caixa aberto e conferir valores.
8. Fechar caixa.
9. Confirmar que o formulario limpa/atualiza.
10. Confirmar que o caixa fechado aparece no historico.
11. Clicar em `Ver detalhes`.
12. Confirmar que formulario fica bloqueado e mostra resumo do fechamento.
13. Conferir console limpo.
