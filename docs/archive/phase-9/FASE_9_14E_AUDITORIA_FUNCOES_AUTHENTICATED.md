# Fase 9.14E — Auditoria de funções SECURITY DEFINER autenticadas

## Status

**Aberta para diagnóstico.**

Esta frente continua a rodada Advisors/RLS/hardening após:

- 9.14A — diagnóstico/classificação inicial;
- 9.14B — hardening de grants em funções administrativas/internas expostas para `anon`;
- 9.14C — RLS das tabelas de permissões;
- 9.14D — auditoria das funções públicas intencionais.

A 9.14E trata os warnings do tipo:

- `authenticated_security_definer_function_executable`.

---

## Diretriz principal

Não revogar `authenticated` em massa.

Muitas funções `SECURITY DEFINER` executáveis por usuários autenticados são intencionais porque:

- encapsulam operações multi-tabela;
- aplicam regras de negócio;
- centralizam validações de permissão;
- evitam acesso direto a tabelas sensíveis;
- suportam fluxos administrativos do frontend.

A etapa inicial da 9.14E é apenas diagnóstica e documental.

---

## Diferença em relação às frentes anteriores

### 9.14B

Tratou funções administrativas/internas expostas para `anon` por grant direto ou herança de `PUBLIC`.

### 9.14D

Tratou funções que precisam permanecer públicas por design, como loja pública, pedido online, OTP e login de cliente.

### 9.14E

Trata funções chamadas por usuários autenticados.

Essas funções não são automaticamente inseguras por aparecerem no Advisor. O risco depende de:

- validação de `auth.uid()`;
- validação de loja/vínculo;
- permissão granular;
- escopo por `store_id`;
- exposição de dados;
- possibilidade de bypass de RLS;
- se são chamadas diretamente pelo frontend;
- se são apenas internas/técnicas.

---

## Grupos de classificação

### A. Autenticada intencional — manter

Funções usadas pelo frontend/admin e que validam permissões corretamente.

Exemplos esperados:

- funções de estoque;
- compras;
- cotações;
- transferências;
- pedidos;
- configurações;
- segurança;
- Meus Dados;
- Meu Histórico.

Ação provável:

- manter `authenticated`;
- documentar como exceção intencional;
- ajustar corpo apenas se houver falha de escopo/validação.

---

### B. Autenticada com ajuste interno

Funções necessárias ao frontend, mas que podem precisar de reforço:

- validar `auth.uid()` explicitamente;
- validar vínculo com loja;
- validar permissão granular;
- reduzir payload;
- esconder mensagens internas;
- limitar operação ao próprio usuário.

Ação provável:

- manter `authenticated`;
- alterar corpo da função.

---

### C. Interna/técnica — candidata a perder `authenticated`

Funções que não deveriam ser chamadas diretamente por usuários autenticados:

- triggers;
- seed;
- sync técnico;
- versionamento interno;
- funções auxiliares usadas apenas por outras RPCs;
- rotinas de manutenção.

Ação provável:

- revogar `authenticated`;
- preservar `service_role`/postgres;
- confirmar dependências antes da migration.

---

### D. Legado/deprecar

Funções antigas substituídas por versões novas ou seguras.

Ação provável:

- revogar `authenticated`, se não houver uso;
- mover para documentação de legado;
- eventualmente remover em fase futura.

---

## Critérios de aceite da 9.14E

- Diagnóstico SQL criado.
- Nenhuma migration corretiva aplicada na abertura.
- Funções classificadas por módulo e risco.
- Primeira migration corretiva proposta somente para funções internas/óbvias ou baixo risco.
- Funções críticas de operação não alteradas sem validação de uso.

---

## Relação com sugestões do Advisor

O usuário informou que restaram 2 sugestões no Advisor.

Essas sugestões não fazem parte da primeira coleta da 9.14E, a menos que estejam diretamente relacionadas a funções `SECURITY DEFINER` autenticadas.

Sugestões/performance devem ser tratadas em rodada separada ou ao final da 9.14E, para não misturar segurança funcional com otimização.

---

## Próxima ação

Rodar diagnóstico específico de funções `SECURITY DEFINER` executáveis por `authenticated`, retornando:

- nome;
- assinatura;
- linguagem;
- grants;
- classificação preliminar por nome/módulo;
- definição SQL;
- foco de auditoria.
