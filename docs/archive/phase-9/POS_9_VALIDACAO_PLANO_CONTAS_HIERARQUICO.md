# POS_9 — Validação do plano de contas hierárquico

## Migration criada

```txt
supabase/migrations/20260708190000_cashbook_account_plan_hierarchy.sql
```

## Commit da migration

```txt
a15a047 - feat: prepara plano contas hierarquico
```

## Service ajustado

```txt
src/services/cashbookAccountPlanService.ts
```

Commit:

```txt
f6a239d - feat: filtra contas lancaveis no plano
```

## O que validar

Depois de aplicar a migration, conferir:

1. A tabela `cashbook_account_plan` passa a ter campos de hierarquia:
   - `display_code`;
   - `parent_code`;
   - `level`;
   - `path`;
   - `is_group`;
   - `is_postable`;
   - `nature`;
   - `analysis_enabled`.

2. Grupos aparecem na base como:
   - `1 - Receitas`;
   - `1.1 - Receitas operacionais`;
   - `2 - Despesas`;
   - `2.4 - Despesas comerciais`.

3. Contas lançáveis aparecem como:
   - `1.1.1 - Vendas`;
   - `1.1.2 - Serviços`;
   - `2.4.13 - Fretes`;
   - `2.4.14 - Pedágio`;
   - `2.10.1 - Embalagens`.

4. O seletor do Livro Diário deve continuar mostrando apenas contas lançáveis, sem grupos como `Receitas` ou `Despesas`.

5. A conta `sales` / `1.1.1 - Vendas` deve ter `analysis_enabled = true`, pois será a primeira conta a ganhar tela de análise.

## Consulta sugerida para árvore

```sql
select
  code,
  display_code,
  parent_code,
  name,
  kind,
  level,
  path,
  is_group,
  is_postable,
  nature,
  analysis_enabled,
  active,
  sort_order
from public.cashbook_account_plan
where active = true
order by sort_order, display_code nulls last, name;
```

## Consulta sugerida para contas lançáveis de entrada

```sql
select
  code,
  display_code,
  parent_code,
  name,
  kind,
  level,
  path,
  nature,
  analysis_enabled
from public.cashbook_account_plan
where active = true
  and is_group = false
  and is_postable = true
  and kind in ('income', 'adjustment')
order by sort_order, display_code nulls last, name;
```

## Consulta sugerida para contas lançáveis de saída

```sql
select
  code,
  display_code,
  parent_code,
  name,
  kind,
  level,
  path,
  nature,
  analysis_enabled
from public.cashbook_account_plan
where active = true
  and is_group = false
  and is_postable = true
  and kind in ('expense', 'adjustment')
order by sort_order, display_code nulls last, name;
```

## Próximo passo depois da validação

Criar a tela administrativa `Plano de contas`, com:

- árvore expandível;
- criação de grupo;
- criação de conta lançável;
- edição de nome/código;
- ativar/inativar;
- proteção contra exclusão quando houver lançamentos;
- futuro botão de análise para contas com `analysis_enabled = true`.
