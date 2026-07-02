# POS_9 - Financeiro - Fechamento do caixa do dia - Base tabela e RPCs

## Status

Base backend preparada.

## Contexto

O diagnostico consolidado confirmou que ainda nao existe estrutura propria para fechamento do caixa do dia.

As tabelas existentes relacionadas ao fluxo financeiro sao:

- `cashbook_entries`;
- `store_payment_methods`.

O diagnostico tambem confirmou que `cashbook_entries` possui os campos necessarios para calcular realizado, pendente e cancelado por dia:

- `store_id`;
- `entry_date`;
- `occurred_at`;
- `type`;
- `direction`;
- `amount`;
- `payment_method`;
- `payment_method_code`;
- `status`;
- `affects_balance`;
- `metadata`.

## Migration criada

Arquivo:

- `supabase/migrations/20260702023000_create_cashbook_day_closings.sql`

Commit:

- `8e05fe14f8d822251da3a504cc9060d58173680b`

## O que a migration cria

### 1. Tabela `cashbook_day_closings`

Tabela para registrar o fechamento do caixa do dia por loja e data.

Principais campos:

- loja;
- data de fechamento;
- status;
- valores esperados por forma de pagamento;
- valores conferidos por forma de pagamento;
- denominacoes de dinheiro contado;
- diferencas;
- totais pendentes;
- totais cancelados;
- observacoes;
- metadata/auditoria;
- usuario responsavel;
- timestamps.

### 2. Unique por loja/data

Impede duplicidade de fechamento para a mesma loja e data:

- `store_id`;
- `closing_date`.

### 3. RLS

- `anon` bloqueado;
- leitura para proprietario ou permissao financeira de caixa;
- escrita para proprietario ou permissao temporaria existente de caixa.

Permissao temporaria usada:

- `cashbook.create`.

Permissao futura sugerida:

- `cashbook.close_day`.

### 4. RPC de previa

Funcao:

- `get_cashbook_day_closing_preview_safe(p_store_id, p_closing_date)`

Ela calcula:

- dinheiro esperado;
- pix esperado;
- cartao de debito esperado;
- cartao de credito esperado;
- outros esperados;
- total esperado;
- pendentes do dia;
- cancelados do dia;
- fechamento existente, se houver.

Regras:

Entram no realizado:

- `status <> cancelled`;
- `affects_balance = true`.

Nao entram no realizado:

- pendentes;
- cancelados;
- `affects_balance = false`.

### 5. RPC de salvamento

Funcao:

- `save_cashbook_day_closing_safe(...)`

Ela salva ou atualiza o fechamento do dia, registrando:

- valores esperados calculados pelo sistema;
- valores conferidos pelo usuario;
- diferencas;
- pendentes;
- cancelados;
- denominacoes de dinheiro;
- observacoes;
- metadata.

## Validacao criada

Arquivo:

- `docs/sql_diagnostics/validate_cashbook_day_closings.sql`

Commit:

- `4e60f55a6c617c186abcda0e2f582eb5d198d914`

## Proxima etapa

1. Aplicar a migration no Supabase.
2. Rodar o SQL de validacao.
3. Validar a previa para uma data com movimento.
4. Depois criar service frontend.
5. Depois criar a area visual de Fechamento do caixa do dia no Financeiro/Livro Diario.

## Observacoes importantes

Esta etapa ainda nao implementa a tela.

O objetivo e primeiro validar a base do fechamento no banco, sem mexer na UX do Livro Diario ja estabilizada.
