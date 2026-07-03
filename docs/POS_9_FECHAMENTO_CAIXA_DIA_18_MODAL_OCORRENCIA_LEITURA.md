# POS_9 - Financeiro - Fechamento do caixa do dia - Modal com leitura da ocorrencia

## Status

Leitura de ocorrencias conectada ao modal de detalhes do fechamento.

## Arquivos alterados/criados

- `src/services/cashbookDiscrepancyService.ts`
- `src/pages/private/admin/financial/cashbook/components/DayClosingPanel.tsx`

## Commits

- `f44d117926ca676438ddf7e9d532b33597804b1c` — cria leitura divergencias caixa
- `abfa080464c1d5693103d283961702aacd5a488f` — mostra ocorrencia no modal fechamento

## O que foi implementado

### 1. Service de leitura

Criado service simples para ler a tabela:

- `cashbook_closing_occurrences`

Metodo:

```ts
CashbookDiscrepancyService.listByStore(storeId)
```

A leitura usa RLS da tabela.

### 2. Modal Ver detalhes

O modal do fechamento agora localiza a ocorrencia vinculada pelo `closing_id`.

Quando houver ocorrencia, o modal mostra:

- status da ocorrencia;
- nivel da divergencia;
- esperado;
- conferido;
- diferenca;
- observacao de abertura;
- observacao de resolucao, se houver;
- data/hora de criacao;
- data/hora de resolucao, se houver.

### 3. Historico

No historico, quando a ocorrencia vinculada ainda estiver aberta, aparece badge:

```txt
Ocorrencia aberta
```

## O que ainda nao foi implementado

Ainda nao ha acao de resolucao pelo front.

Proxima etapa:

- botao/area para alterar status;
- selecionar tipo de resolucao;
- informar observacao obrigatoria;
- chamar RPC de resolucao.

## Validacao sugerida

1. Rodar `git pull`.
2. Rodar `npm run build`.
3. Abrir `/admin/cashbook`.
4. Ir em `Fechamento do dia`.
5. Abrir `Historico de fechamentos`.
6. Confirmar badge `Ocorrencia aberta` no fechamento divergente.
7. Clicar em `Ver detalhes`.
8. Confirmar bloco `Ocorrencia de divergencia` no modal.
9. Conferir console limpo.
