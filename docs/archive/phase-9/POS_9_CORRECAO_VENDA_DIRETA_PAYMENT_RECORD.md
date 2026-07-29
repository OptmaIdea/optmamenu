# POS_9 — Correção da venda direta — payment record

## Status

Correção criada, aguardando aplicação no Supabase.

## Erro observado

Na tela `/admin/direct-sales`, ao tentar concluir a venda, a RPC retornou:

```txt
record "v_payment_method" is not assigned yet
```

## Causa

A primeira versão de `create_admin_direct_sale_order_safe(...)` declarou:

```sql
v_payment_method record;
```

No fluxo de pagamento `pending`, a função tentava atribuir campos diretamente:

```sql
v_payment_method.code := 'pending';
v_payment_method.name := 'Pendente';
```

Em PL/pgSQL, um `record` precisa receber uma linha antes de seus campos serem acessados/atribuídos.

## Correção

A função foi recriada usando variáveis escalares:

- `v_payment_code`;
- `v_payment_name`;
- `v_payment_requires_proof`;
- `v_payment_requires_change_for`;
- `v_payment_affects_cashbook`.

Com isso, o fluxo `pending` não depende mais de um `record` inicializado.

## Migration criada

- `supabase/migrations/20260629150500_fix_direct_sale_payment_record.sql`

## Resultado esperado

Após aplicar a migration, a venda direta deve avançar além da validação de pagamento.

Se houver novo erro, ele deve estar relacionado à próxima camada de integração incremental, como:

- estoque/local;
- método de pagamento real;
- caixa;
- fidelidade;
- coluna/trigger específica.

## Próximo passo

1. Aplicar a migration.
2. Fazer refresh da tela.
3. Tentar concluir venda direta com `pending`.
4. Enviar qualquer novo erro, se aparecer.
