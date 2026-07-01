# POS_9 - Financeiro - Abas no Livro Diario para Lancamentos e Recebiveis

## Status

Orientacao de implementacao criada para aplicar sobre o layout atual do Livro Diario.

## Contexto

O fluxo de recebimento pendente foi validado:

- SQL aplicada com sucesso;
- item saiu dos pendentes;
- item foi corretamente para recebidos;
- recalculos ficaram corretos;
- console ficou limpo.

Tambem foi corrigido o console de `/admin/my-profile` com grant da RPC `list_my_profile_change_requests`.

## Problema de UX

O painel `Pendentes de recebimento` atualmente fica acima dos lancamentos.

Isso ficou pouco intuitivo porque compete visualmente com o historico do Livro Diario.

## Decisao

Separar a tela em abas:

```txt
Livro Diario
- Lancamentos
- Pendentes de recebimento
```

## Regra da aba Lancamentos

A aba Lancamentos deve manter:

- cards de resumo;
- modo Livro;
- modo Extrato;
- filtros de periodo, datas, cliente e status;
- tabela/lista de lancamentos;
- acoes de ver, editar e cancelar;
- modais atuais.

## Regra da aba Pendentes de recebimento

A aba Pendentes deve exibir somente:

- `PendingReceivablesPanel`;
- total pendente;
- lista de pendentes;
- selecao de forma real de pagamento;
- botao Confirmar;
- confirmacao via RPC segura;
- reload via `loadData`.

## Implementacao sugerida

No arquivo:

- `src/pages/private/admin/financial/cashbook/CashbookPage.tsx`

### 1. Criar tipo e estado

Perto dos demais tipos:

```tsx
type CashbookMainTab = 'entries' | 'receivables';
```

Perto dos demais `useState`:

```tsx
const [mainTab, setMainTab] = useState<CashbookMainTab>('entries');
```

### 2. Criar contador de pendentes

Adicionar memo simples:

```tsx
const pendingReceivablesCount = useMemo(() => {
  return entries.filter((entry) => {
    const isCancelled = entry.status === 'cancelled' || entry.status === 'canceled';
    const isPendingPayment =
      entry.payment_method_code === 'pending' ||
      entry.payment_method?.toLowerCase() === 'pending' ||
      entry.affects_balance === false;

    return entry.type === 'sale' && entry.direction === 'in' && !isCancelled && isPendingPayment && Boolean(entry.order_id);
  }).length;
}, [entries]);
```

### 3. Adicionar seletor de abas depois dos cards

Logo apos os cards superiores, antes da renderizacao do painel/lista:

```tsx
<div className="flex flex-wrap items-center gap-2 rounded-2xl border border-gray-100 bg-white p-1 shadow-sm dark:border-gray-700 dark:bg-gray-800">
  <button
    type="button"
    onClick={() => setMainTab('entries')}
    className={`rounded-xl px-4 py-2 text-sm font-black transition ${
      mainTab === 'entries'
        ? 'bg-[#19A999] text-white shadow-sm'
        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white'
    }`}
  >
    Lancamentos
  </button>
  <button
    type="button"
    onClick={() => setMainTab('receivables')}
    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-black transition ${
      mainTab === 'receivables'
        ? 'bg-amber-600 text-white shadow-sm'
        : 'text-gray-500 hover:bg-amber-50 hover:text-amber-700 dark:text-gray-400 dark:hover:bg-amber-950/30 dark:hover:text-amber-300'
    }`}
  >
    Pendentes de recebimento
    {pendingReceivablesCount > 0 && (
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${mainTab === 'receivables' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200'}`}>
        {pendingReceivablesCount}
      </span>
    )}
  </button>
</div>
```

### 4. Mover painel para dentro da aba Pendentes

Remover o bloco atual:

```tsx
<div className="my-6">
  <PendingReceivablesPanel
    storeId={storeId}
    entries={entries}
    canConfirm={canCreateCashbookEntry}
    onConfirmed={loadData}
  />
</div>
```

Substituir por render condicional:

```tsx
{mainTab === 'receivables' && (
  <PendingReceivablesPanel
    storeId={storeId}
    entries={entries}
    canConfirm={canCreateCashbookEntry}
    onConfirmed={loadData}
  />
)}
```

### 5. Envolver a lista de lancamentos na aba Lancamentos

O bloco que comeca com:

```tsx
{/* Entries List */}
<div className="bg-white dark:bg-gray-800 rounded-3xl ...">
```

Deve ficar assim:

```tsx
{mainTab === 'entries' && (
  <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
    ...conteudo atual da lista...
  </div>
)}
```

## Validacao

Depois de aplicar:

```bash
npm run build
```

Checklist:

1. abrir `/admin/cashbook`;
2. conferir aba `Lancamentos` como padrao;
3. conferir cards e tabela normais;
4. clicar em `Pendentes de recebimento`;
5. conferir que so o painel de pendentes aparece;
6. confirmar um pendente se houver candidato;
7. conferir que volta/recalcula corretamente;
8. console limpo.

## Observacao

Essa orientacao existe para preservar o layout recente do Livro Diario e evitar sobrescrever alteracoes locais do commit `6a3bcfd117bd288e80c9d96d3be9d3174f7207e7`.
