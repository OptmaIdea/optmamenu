# POS_9 — Encaixe mínimo do componente de classificação no Livro Diário

## Arquivo criado

```txt
src/pages/private/admin/financial/cashbook/components/CashbookClassificationFields.tsx
```

Commit:

```txt
5d9a3d3 - feat: cria campos classificacao livro diario
```

## O que o componente faz

- Exibe `Categoria` em pt-BR;
- Exibe `Conta financeira` em pt-BR;
- Carrega opções pelo hook `useCashbookClassificationOptions`;
- Sugere conta pela forma de pagamento:
  - dinheiro -> Caixa físico;
  - Pix -> Carteira Pix;
  - cartão -> Recebíveis de cartão;
- Exporta `buildManualCashbookClassification` para montar o payload do `CashbookService.create`.

## Encaixe mínimo no CashbookPage.tsx

### 1. Importar

```tsx
import CashbookClassificationFields, {
    buildManualCashbookClassification,
} from './components/CashbookClassificationFields';
```

### 2. Adicionar campos no CashbookFormState

```ts
accountPlanCode: string;
financialAccountCode: string;
```

### 3. Inicializar no openCreateForm

```ts
accountPlanCode: '',
financialAccountCode: direction === 'in' ? 'cash_drawer' : 'cash_drawer',
```

### 4. Inicializar no openEditForm

```ts
accountPlanCode: entry.account_plan_code || '',
financialAccountCode: '',
```

### 5. No create, antes de CashbookService.create

```ts
const classification = buildManualCashbookClassification({
    direction: formState.direction,
    paymentMethodCode: formState.paymentMethodCode,
    accountPlanCode: formState.accountPlanCode,
    financialAccountCode: formState.financialAccountCode,
});
```

### 6. Enviar no payload

```ts
account_plan_code: classification.account_plan_code,
source_financial_account_code: classification.source_financial_account_code,
destination_financial_account_code: classification.destination_financial_account_code,
affects_cash_drawer: classification.affects_cash_drawer,
affects_financial_result: classification.affects_financial_result,
is_transfer: classification.is_transfer,
```

### 7. Inserir no modal antes de Observações

```tsx
<CashbookClassificationFields
    storeId={storeId}
    direction={formState.direction}
    paymentMethodCode={formState.paymentMethodCode}
    accountPlanCode={formState.accountPlanCode}
    financialAccountCode={formState.financialAccountCode}
    onAccountPlanCodeChange={(value) => setFormState({ ...formState, accountPlanCode: value })}
    onFinancialAccountCodeChange={(value) => setFormState({ ...formState, financialAccountCode: value })}
/>
```

## Cuidado

Preservar o `catch` já validado localmente:

- regra de negócio prevista deve mostrar toast;
- console deve permanecer limpo;
- erros inesperados continuam indo para `console.error`.

## Validação esperada

1. `npm run build`;
2. abrir Nova Entrada;
3. conferir Categoria e Conta financeira em pt-BR;
4. criar lançamento com categoria;
5. validar Supabase:
   - `account_plan_code` preenchido;
   - origem/destino preenchido;
   - `affects_cash_drawer` correto;
   - `affects_financial_result` correto;
6. console limpo.
