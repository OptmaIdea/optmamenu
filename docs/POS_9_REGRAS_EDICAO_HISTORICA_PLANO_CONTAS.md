# POS_9 — Regras de edição histórica do Plano de Contas

## Objetivo

Definir como o sistema deve tratar alterações em contas do Plano de Contas quando já existem lançamentos vinculados.

A regra central é:

> Uma conta com lançamentos não pode ter sua identidade histórica alterada.

Isso evita que o balancete, os relatórios e a auditoria passem a contar uma história diferente da realidade operacional.

---

## Problema que queremos evitar

Exemplo indevido:

```txt
1.1.1.4 - Energia
```

Depois de vários lançamentos nessa conta, o usuário altera para:

```txt
1.1.1.4 - Internet
```

Resultado ruim:

- lançamentos antigos de energia passariam a aparecer como internet;
- balancetes de períodos passados ficariam semanticamente errados;
- auditoria até registraria a troca, mas o relatório padrão ficaria confuso;
- o usuário poderia tomar decisão baseada em dado histórico distorcido.

---

## Regra 1 — Conta sem lançamentos pode ser editada normalmente

Se a conta nunca recebeu lançamento e não tem filhos, ela pode ter:

- nome alterado;
- código exibido alterado;
- grupo pai alterado;
- tipo/natureza ajustados;
- flags ajustadas;
- exclusão segura, quando for criada pelo usuário.

Exemplo:

```txt
1.1.1.5 - Conta teste
```

Pode virar:

```txt
1.1.1.5 - Venda na notinha
```

porque ainda não existe histórico financeiro vinculado.

---

## Regra 2 — Conta com lançamentos não pode mudar identidade

Quando a conta já possui lançamentos, a UI comum deve bloquear alterações que mudem sua identidade histórica.

Bloquear:

- nome principal;
- código exibido;
- grupo pai;
- tipo (`income`, `expense`, `transfer`, `adjustment`);
- natureza (`credit`, `debit`, `neutral`);
- `is_group`;
- `is_postable` quando isso afetar a leitura histórica;
- `affects_financial_result`;
- `is_transfer`.

Permitir com cuidado:

- descrição interna;
- inativação para novos lançamentos;
- talvez uma observação de substituição futura, via metadata/auditoria.

---

## Regra 3 — Correção de nomenclatura sem mudança semântica

Pode existir um caso aceitável de correção textual simples:

```txt
Energia eletrica
```

para:

```txt
Energia elétrica
```

ou:

```txt
Internet Vivo
```

para:

```txt
Internet / Vivo
```

Mas isso deve ser tratado como exceção controlada, não como edição livre.

Regra sugerida para a UI comum:

- bloquear edição de nome quando houver lançamentos;
- futuramente criar fluxo específico: “Solicitar correção de rótulo histórico”.

Esse fluxo deve exigir confirmação explícita e registrar auditoria detalhada.

---

## Regra 4 — Mudança de categoria deve criar nova conta

Se a conta atual não representa mais a realidade, o usuário deve criar nova conta.

Exemplo:

Conta antiga:

```txt
2.3.1.2 - Energia
```

Nova conta correta:

```txt
2.3.1.6 - Energia elétrica
```

A conta antiga pode ser inativada para novos lançamentos:

```txt
2.3.1.2 - Energia [inativa]
```

Os lançamentos antigos continuam aparecendo no balancete do período em que ocorreram.

---

## Regra 5 — Mover lançamentos é operação excepcional

Mover lançamentos de uma conta para outra não deve ser edição comum do Plano de Contas.

Exemplo possível, mas sensível:

```txt
Mover lançamentos de 2.3.1.2 - Energia
para 2.3.1.6 - Energia elétrica
```

Esse tipo de operação deve ser um fluxo próprio de reclassificação, com:

- filtro por período;
- prévia dos lançamentos afetados;
- motivo obrigatório;
- confirmação explícita;
- auditoria forte;
- registro de usuário, data/hora e origem/destino.

Não deve acontecer implicitamente ao editar a conta.

---

## Regra 6 — Inativar é o caminho seguro

Quando a conta tem histórico, o caminho mais seguro é:

1. inativar a conta antiga para novos lançamentos;
2. criar uma nova conta com o nome/código correto;
3. manter o histórico antigo preservado;
4. permitir que o balancete continue exibindo a conta antiga nos períodos onde houve movimentação.

Exemplo:

```txt
2.3.1.2 - Energia [inativa]
2.3.1.6 - Energia elétrica [ativa]
```

---

## Regra 7 — Balancete deve respeitar histórico

Mesmo inativa, uma conta com lançamentos deve aparecer em relatórios/balancetes quando:

- o período consultado contém lançamentos daquela conta;
- o usuário escolhe incluir contas inativas;
- ou o relatório precisa manter integridade histórica.

A conta inativa não deve aparecer como opção para novos lançamentos comuns.

---

## Regra 8 — Implementação recomendada no backend

A RPC `upsert_cashbook_account_plan_safe` deve validar se a conta já possui lançamentos.

Se possuir lançamentos, bloquear alteração de campos de identidade:

- `display_code`;
- `parent_code`;
- `name` em regra comum;
- `kind`;
- `nature`;
- `is_group`;
- `is_postable`;
- `affects_financial_result`;
- `is_transfer`.

Mensagem sugerida:

```txt
Esta conta possui lançamentos e não pode ter sua identidade alterada. Inative-a e crie uma nova conta para preservar o histórico.
```

---

## Regra 9 — Implementação recomendada na UI

Para conta com lançamentos:

- ocultar ou desabilitar edição de campos de identidade;
- permitir apenas descrição/observação, se necessário;
- mostrar aviso:

```txt
Esta conta possui lançamentos. Para preservar o histórico, ela não pode ser renomeada ou movida. Inative esta conta e crie uma nova para uso futuro.
```

Também pode haver ação rápida:

```txt
Criar substituta
```

Essa ação criaria uma nova conta filha no mesmo grupo, com próximo código sugerido.

---

## Regra 10 — Auditoria

Toda tentativa de alteração bloqueada por histórico pode futuramente gerar evento de auditoria leve.

Toda alteração permitida deve registrar:

- usuário;
- data/hora;
- dados antigos;
- dados novos;
- origem da alteração;
- motivo, quando aplicável.

---

## Decisão atual

Para a etapa atual do OptmaMenu:

1. conta sem lançamentos pode ser editada/apagada se criada pelo usuário;
2. conta com lançamentos não pode ser apagada;
3. conta com lançamentos não deve ter identidade editável pela UI comum;
4. a operação segura é inativar e criar nova conta;
5. reclassificação/migração de lançamentos será fluxo futuro separado.
