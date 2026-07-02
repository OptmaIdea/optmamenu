# POS_9 - Financeiro - Fechamento do caixa do dia - Caixas abertos e historico

## Status

Primeira base de controle de caixas abertos e fechados preparada.

## Contexto

Durante o teste visual do fechamento, foram definidas regras operacionais mais proximas da rotina real de loja.

O fechamento de caixa nao deve ser tratado como um formulario livre por data.

A regra correta e:

```txt
existem caixas/dias com movimento;
esses caixas precisam ser fechados;
caixas fechados viram historico/auditoria;
caixas abertos por tempo demais geram alerta/ocorrencia.
```

## Regras funcionais registradas

### 1. Caixa fechado

Quando o caixa de uma data for fechado:

- o formulario deve ser limpo ou bloqueado;
- a tela nao deve continuar parecendo editavel;
- a mensagem deve ser amigavel;
- o usuario deve visualizar o resumo do fechamento;
- reabrir/alterar deve ser fluxo posterior, com permissao superior.

Mensagem atual a melhorar:

```txt
Ja existe fechamento para esta data com status closed. Salvar novamente atualizara o registro da mesma data.
```

Mensagem desejada:

```txt
Caixa desta data ja foi fechado.
Confira os detalhes no historico de fechamentos.
```

### 2. Datas abertas

Em vez de date picker livre, a tela deve trabalhar com dias/caixas abertos.

Para a primeira versao operacional:

- mostrar o caixa de hoje;
- mostrar caixas anteriores ainda nao fechados;
- permitir selecionar apenas datas com movimento e nao fechadas;
- permitir datas antigas em fluxo de owner/supervisor posteriormente.

### 3. Prazo para fechamento

O caixa nao deve ficar aberto indefinidamente.

Regra futura configuravel por loja:

- quantidade maxima de dias aberto;
- sugestao inicial: 2 a 5 dias;
- considerar finais de semana e feriados prolongados;
- caixas atrasados geram alerta/ocorrencia.

Enquanto nao houver configuracao, usar valor temporario em RPC:

- `p_allowed_open_days`, default 3.

### 4. Varios caixas

Futuro importante:

- admitir varios caixas abertos;
- cada caixa precisa ser fechado individualmente;
- fechamento por usuario/turno/local/maquina fica para etapa posterior.

A primeira base atual ainda e por loja/data.

### 5. Historico de fechamentos

Precisamos de area para visualizar caixas fechados com:

- data;
- status;
- esperado;
- conferido;
- diferenca;
- dinheiro contado;
- Pix/cartoes conferidos;
- observacoes;
- responsavel;
- data e hora de fechamento;
- detalhes auxiliares salvos em metadata.

## Migration criada

Arquivo:

- `supabase/migrations/20260702193000_list_cashbook_day_closing_status_safe.sql`

Commit:

- `e3aa0ec0a6379489d846853536bbddada9890eec`

## Funcao criada

```sql
public.list_cashbook_day_closing_status_safe(
  p_store_id uuid,
  p_lookback_days integer default 90,
  p_allowed_open_days integer default 3
)
```

## O que a funcao retorna

### `open_days`

Dias com movimento no Livro Caixa que ainda nao possuem fechamento fechado.

Campos principais:

- `entry_date`;
- `entries_count`;
- `realized_total`;
- `pending_count`;
- `pending_total`;
- `status`;
- `age_days`;
- `is_overdue`.

### `recent_closings`

Ultimos fechamentos registrados.

Campos principais:

- `closing_date`;
- `status`;
- `expected_total`;
- `confirmed_total`;
- `difference_total`;
- `notes`;
- `metadata`;
- `closed_by`;
- `closed_at`.

## Service frontend atualizado

Arquivo:

- `src/services/cashbookService.ts`

Commit:

- `fad3c96d2131702d47e89ba85a03e5bb954789ec`

Tipos adicionados:

- `CashbookOpenDayStatus`;
- `CashbookClosingStatusResult`.

Metodo adicionado:

```ts
CashbookService.listDayClosingStatus(storeId, lookbackDays, allowedOpenDays)
```

## Validacao criada

Arquivo:

- `docs/sql_diagnostics/validate_cashbook_day_closing_status.sql`

Commit:

- `faade329323cef420ffa3da806202cdabdd1550f`

## Proximo ajuste frontend

Com essa base, a proxima alteracao visual deve:

1. carregar `listDayClosingStatus` no painel de fechamento;
2. mostrar aviso de caixas abertos/atrasados;
3. substituir o date picker livre por selecao de caixas abertos;
4. bloquear formulario quando a data estiver fechada;
5. mostrar historico de fechamentos recentes;
6. exibir detalhes salvos em `metadata.external_conference_details`.

## Observacao

A configuracao por loja do prazo maximo de fechamento ainda nao foi criada.

Ela deve entrar depois em Configuracoes/Financeiro ou Configuracoes/Operacao, algo como:

- `cashbook_closing_allowed_open_days`;
- valor recomendado: 2 a 5 dias;
- default operacional temporario: 3 dias.
