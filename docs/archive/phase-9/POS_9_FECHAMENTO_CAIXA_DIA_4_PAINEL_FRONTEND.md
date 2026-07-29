# POS_9 - Financeiro - Fechamento do caixa do dia - Painel frontend

## Status

Componente visual criado.

## Arquivo criado

- `src/pages/private/admin/financial/cashbook/components/DayClosingPanel.tsx`

Commit:

- `3938371cd0d6c1a720453f35435b11cef38db4eb`

## Objetivo

Criar a primeira area visual do Fechamento do caixa do dia dentro do Livro Diario.

A direcao de UX e ficar como terceira aba:

```txt
Lancamentos | Pendentes de recebimento | Fechamento do dia
```

## O que o componente faz

- permite selecionar data do fechamento;
- carrega previa via `CashbookService.getDayClosingPreview`;
- mostra valores esperados por forma de pagamento;
- mostra pendentes/cancelados informativos;
- possui tabela de notas/moedas;
- calcula total de dinheiro contado;
- permite informar Pix conferido;
- permite informar debito conferido;
- permite informar credito conferido;
- permite informar outros recebimentos;
- calcula diferencas em tempo real;
- exige observacao para fechar com divergencia;
- salva rascunho via `CashbookService.saveDayClosing`;
- fecha caixa via `CashbookService.saveDayClosing` com status `closed`.

## Como encaixar na aba existente

Arquivo:

- `src/pages/private/admin/financial/cashbook/components/PendingReceivablesPanel.tsx`

### 1. Ajustar imports

Trocar:

```tsx
import { CheckCircle2, Clock, History, RefreshCw } from 'lucide-react';
```

por:

```tsx
import { Calculator, CheckCircle2, Clock, History, RefreshCw } from 'lucide-react';
```

Adicionar:

```tsx
import DayClosingPanel from './DayClosingPanel';
```

### 2. Ajustar o tipo da aba

Trocar:

```tsx
type CashbookTab = 'entries' | 'receivables';
```

por:

```tsx
type CashbookTab = 'entries' | 'receivables' | 'closing';
```

### 3. Ajustar o atributo que esconde a lista

Trocar:

```tsx
data-cashbook-receivables-active={activeTab === 'receivables' ? 'true' : 'false'}
```

por:

```tsx
data-cashbook-secondary-active={activeTab === 'entries' ? 'false' : 'true'}
```

E trocar o CSS:

```tsx
.my-6:has([data-cashbook-receivables-active="true"]) + div {
  display: none;
}
```

por:

```tsx
.my-6:has([data-cashbook-secondary-active="true"]) + div {
  display: none;
}
```

### 4. Adicionar o botao da terceira aba

Depois do botao `Pendentes de recebimento`, adicionar:

```tsx
<button
  type="button"
  onClick={() => setActiveTab('closing')}
  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-black transition ${
    activeTab === 'closing'
      ? 'bg-teal-600 text-white shadow-sm'
      : 'text-gray-500 hover:bg-teal-50 hover:text-teal-700 dark:text-gray-400 dark:hover:bg-teal-950/30 dark:hover:text-teal-300'
  }`}
>
  <Calculator size={16} />
  Fechamento do dia
</button>
```

### 5. Renderizar o painel

No final do JSX, depois do bloco:

```tsx
{activeTab === 'receivables' && (...)}
```

adicionar:

```tsx
{activeTab === 'closing' && <DayClosingPanel storeId={storeId} canClose={canConfirm} />}
```

## Validacao sugerida

Depois de aplicar o encaixe:

```bash
npm run build
```

Checklist:

1. abrir `/admin/cashbook`;
2. confirmar que a aba `Lancamentos` continua como padrao;
3. confirmar que a aba `Pendentes de recebimento` continua funcionando;
4. clicar em `Fechamento do dia`;
5. conferir se a previa carrega para a data atual;
6. trocar a data para `2026-07-01` e conferir os valores esperados do teste;
7. preencher valores conferidos;
8. salvar rascunho;
9. testar fechar caixa;
10. conferir build e console limpos.

## Observacao

A atualizacao direta do arquivo de abas foi bloqueada pela ferramenta nesta rodada. Por isso, o componente foi criado isolado e este documento registra o patch de encaixe para aplicar de forma segura no Antigravity ou em edicao local.
