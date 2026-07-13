# POS_9 — UI de exclusão segura no Plano de Contas

## Contexto

Após a implantação da governança do Plano de Contas, a exclusão física de contas deve ser extremamente restrita.

O backend já possui a RPC segura:

```sql
select public.delete_cashbook_account_plan_safe('<code>');
```

E o diagnóstico:

```txt
docs/sql_diagnostics/validate_cashbook_account_plan_safe_delete.sql
```

## Regra de UI

A tela `/admin/account-plan` só deve exibir o botão **Apagar** quando a conta atender todos os critérios abaixo:

- foi criada pelo usuário;
- não é estrutura base;
- não é grupo/conta protegida;
- não possui lançamentos;
- não possui contas filhas;
- preferencialmente está em uma conta lançável comum criada pela UI.

Mesmo assim, o backend continua sendo a trava final.

## Critérios práticos no frontend

A função sugerida para a tela é:

```ts
function canShowDeleteButton(item: CashbookAccountPlanTreeItem, hasChildren: boolean) {
  return (
    !isSystemProtectedItem(item) &&
    !hasChildren &&
    item.has_entries !== true &&
    (item.metadata?.user_created === true || item.metadata?.user_created === 'true')
  );
}
```

## Fluxo visual recomendado

Na linha da conta:

```txt
Conta filha | Editar | Inativar | Apagar
```

O botão **Apagar** deve ser exibido apenas quando `canShowDeleteButton(...)` retornar `true`.

## Confirmação obrigatória

Antes de chamar a RPC, a tela deve pedir confirmação:

```txt
Apagar esta conta?
Esta ação só é permitida para contas criadas manualmente, sem lançamentos e sem contas filhas.
```

Usar `window.confirm` inicialmente é aceitável para manter o patch pequeno.

## Tratamento de erro

A função deve tratar erros de negócio esperados sem poluir o console:

- código duplicado;
- estrutura base;
- não pode ser apagada;
- possui lançamentos;
- possui contas filhas;
- permissão.

O helper `isExpectedBusinessRuleError` deve incluir também:

```ts
message.includes('já existe uma conta ativa usando o código')
```

## Implementação sugerida

Adicionar handler:

```ts
async function handleDelete(item: CashbookAccountPlanTreeItem) {
  const confirmed = window.confirm(
    `Apagar a conta "${getItemLabel(item)}"?\n\nEsta ação só é permitida para contas criadas manualmente, sem lançamentos e sem contas filhas.`
  );

  if (!confirmed) return;

  try {
    await CashbookAccountPlanTreeService.deleteSafe(item.code);
    toast.success('Conta apagada com segurança.');
    await loadData();
  } catch (error) {
    if (!isExpectedBusinessRuleError(error)) {
      console.error('Erro ao apagar conta do plano de contas:', error);
    }
    toast.error(error instanceof Error ? error.message : 'Erro ao apagar conta do plano de contas.');
  }
}
```

Adicionar o botão apenas dentro do bloco `!isProtected` e quando `canShowDeleteButton(item, hasChildren)` for verdadeiro.

## Próximo passo

Aplicar essa regra no `AccountPlanPage.tsx`, preservando os ajustes recentes de UX:

- abas Balancete / Editar contas;
- modal de edição;
- ordenação por número/A-Z;
- busca com ancestralidade.
