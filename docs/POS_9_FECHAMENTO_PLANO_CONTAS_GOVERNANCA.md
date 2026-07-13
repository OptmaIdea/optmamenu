# POS_9 — Fechamento do Plano de Contas com Governança

## Objetivo

Registrar o fechamento da etapa de Plano de Contas gerencial do OptmaMenu, consolidando a árvore hierárquica, o balancete, a governança de edição, a exclusão segura e os indicadores de acompanhamento.

---

## Escopo implementado

### 1. Plano de contas hierárquico

A estrutura do Plano de Contas passou a operar em árvore, com grupos e contas lançáveis.

Foram consolidados campos como:

- `display_code`;
- `parent_code`;
- `level`;
- `path`;
- `is_group`;
- `is_postable`;
- `nature`;
- `analysis_enabled`.

A tela administrativa permite visualizar a árvore por ramos gerenciais:

- Entradas;
- Saídas;
- Transferências;
- Todos.

A listagem foi ajustada para considerar o ramo raiz da árvore, não apenas o tipo técnico da conta. Isso garante que grupos de ajuste dentro de Entradas ou Saídas apareçam corretamente no local esperado.

---

## 2. Numeração automática

Foi criado fluxo para sugerir o próximo código filho disponível a partir do grupo pai.

A criação de conta filha preenche automaticamente:

- próximo `display_code`;
- ordem sugerida.

A regra foi protegida contra reaproveitamento indevido de número dentro do mesmo grupo.

---

## 3. Bloqueio de duplicidade

O backend passou a bloquear código visual duplicado entre contas ativas do mesmo grupo.

A tentativa de criar ou renomear uma conta para um código já utilizado retorna erro amigável.

Essa proteção fica no banco e não depende apenas do frontend.

---

## 4. Governança histórica

Foi definida a regra principal:

> Uma conta com lançamentos não pode ter sua identidade histórica alterada.

Contas com lançamentos ficam com identidade protegida.

A identidade histórica inclui:

- código na árvore;
- nome exibido;
- grupo pai;
- tipo;
- natureza;
- marcação de grupo;
- marcação de conta lançável.

Campos ainda permitidos para edição segura:

- descrição administrativa;
- análise gerencial;
- ordem;
- status ativo/inativo.

A UI passou a bloquear visualmente os campos protegidos quando `identity_locked = true`, além de exibir aviso explicativo no modal.

---

## 5. Exclusão segura

Foi implementado fluxo de exclusão segura para contas criadas pelo usuário.

Uma conta só pode ser apagada quando:

- foi criada pelo usuário;
- está ativa;
- não possui lançamentos;
- não possui contas filhas;
- não é estrutura base do sistema.

A UI mostra o botão **Apagar** somente quando:

```txt
can_delete_safe = true
```

Mesmo assim, o backend continua sendo a trava final por meio da RPC segura de exclusão.

---

## 6. Estrutura base protegida

Grupos e contas base do sistema ficam protegidos contra alterações perigosas.

A UI oculta ações indevidas em estruturas protegidas, como editar, inativar e apagar.

A proteção considera:

- códigos raiz estruturais;
- metadados de grupo do sistema;
- metadados de conta protegida;
- metadados de estrutura base.

---

## 7. Balancete por plano de contas

A tela passou a incluir a aba **Balancete**, separada da aba **Editar contas**.

O balancete utiliza a árvore gerencial e permite acompanhar lançamentos classificados por conta.

A regra conceitual permanece:

- contas inativas continuam aparecendo em períodos onde possuírem movimento ou saldo relevante;
- inativar conta não apaga histórico;
- alteração futura não reescreve relatórios passados.

---

## 8. Card de governança

Foi criada RPC de resumo de governança:

```sql
public.get_cashbook_account_plan_governance_summary_safe()
```

Ela retorna indicadores como:

- total de contas;
- contas ativas;
- contas inativas;
- contas lançáveis;
- contas com lançamentos;
- contas com filhos;
- contas protegidas;
- contas com histórico travado;
- candidatas à exclusão segura;
- erros de consistência de flags.

No frontend, foi criado o componente:

```txt
AccountPlanGovernanceSummaryCard
```

Ele mostra de forma discreta:

- Histórico protegido;
- Apagáveis com segurança;
- Estrutura base;
- Consistência.

O estado saudável esperado é:

```txt
flag_consistency_errors = 0
```

---

## 9. Menu financeiro

O Plano de Contas foi incluído no menu lateral financeiro entre:

- Livro diário;
- Plano de contas;
- Contas financeiras.

A permissão utilizada segue o escopo financeiro existente:

```txt
cashbook.view
```

---

## Validações realizadas

Foram validados em execução:

- build limpo;
- console limpo;
- listagem correta das contas;
- bloqueio ao tentar alterar nome de conta com lançamento;
- exclusão disponível somente para contas criadas pelo usuário;
- exclusão bloqueada para contas com lançamentos, filhos ou proteção de sistema;
- RPC de resumo de governança funcionando;
- `flag_consistency_errors` esperado como zero;
- menu lateral financeiro atualizado.

---

## Decisão de produto

O Plano de Contas do OptmaMenu deve permitir evolução futura sem reescrever o passado.

A regra operacional adotada é:

> Corrigir o futuro sem apagar ou distorcer o histórico.

Quando uma conta usada historicamente precisar mudar de significado, o fluxo correto é:

1. preservar a conta antiga;
2. inativar para novos lançamentos, quando necessário;
3. criar uma nova conta com o próximo código disponível;
4. usar a nova conta nos lançamentos futuros.

Reclassificações antigas, quando forem necessárias, devem ser tratadas em fluxo separado, auditado e com confirmação explícita.
