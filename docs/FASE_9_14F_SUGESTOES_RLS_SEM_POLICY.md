# Fase 9.14F — Sugestões RLS Enabled No Policy

## Status

**Aberta com correção segura preparada.**

Esta frente trata as 2 sugestões restantes do Advisor após as rodadas:

- 9.14A — diagnóstico/classificação inicial;
- 9.14B — hardening de grants em funções;
- 9.14C — RLS das tabelas de permissões;
- 9.14D — funções públicas intencionais;
- 9.14E.1 — funções técnicas autenticadas.

---

## Base analisada

Arquivo:

- `docs/ADVISORS.md`

Commit informado:

- `56754d01a89784f27dca4136e3b96b3f36517aca`

O aviso abaixo continua fora do escopo por decisão do projeto:

- `Leaked Password Protection Disabled`.

---

## Sugestões restantes

O final do arquivo lista 2 entradas `rls_enabled_no_policy`:

- `public.store_permission_catalog`;
- `public.store_role_permission_templates_backup_910c`.

Detalhe:

- as duas tabelas estão com RLS habilitado;
- não possuem policies;
- por isso o Advisor informa `RLS Enabled No Policy`.

---

## Interpretação

O estado atual não representa abertura de acesso.

Na 9.14C, essas tabelas foram protegidas com:

- RLS habilitado;
- grants diretos removidos de `anon`;
- grants diretos removidos de `authenticated`;
- acesso preservado para `service_role`/postgres;
- acesso funcional via RPCs controladas.

Ou seja: a ausência de policy estava funcionando como bloqueio por padrão.

---

## Decisão da 9.14F

Criar policies explícitas de negação total para `anon` e `authenticated`.

Objetivo:

- manter as tabelas fechadas;
- registrar a intenção diretamente no banco;
- reduzir ruído do Advisor;
- proteger contra eventual reintrodução acidental de grants diretos no futuro.

---

## Modelo de policy

Para cada tabela:

```sql
CREATE POLICY deny_direct_client_access
ON public.<tabela>
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);
```

Efeito:

- `SELECT`: não retorna linhas;
- `INSERT`: bloqueado;
- `UPDATE`: bloqueado;
- `DELETE`: bloqueado;
- mesmo que algum grant direto volte por acidente, a policy impede acesso por `anon/authenticated`.

---

## Fora do escopo

- Criar policy permissiva;
- conceder SELECT para `authenticated`;
- alterar RPCs de permissões;
- remover a tabela backup;
- mover a tabela backup para outro schema;
- tratar warnings `authenticated_security_definer_function_executable`.

---

## Validação esperada

Após aplicar a migration:

- RLS segue habilitado;
- policies passam a existir;
- grants continuam sem `anon`/`authenticated`;
- o Advisor deve deixar de listar `rls_enabled_no_policy` para essas duas tabelas.
