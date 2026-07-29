# Fase 9.14A — Classificação parcial dos diagnósticos Advisors

## Status

**Classificação parcial registrada.**

Este documento registra a leitura do primeiro resultado enviado da consulta `docs/sql_diagnostics/diagnose_advisors_914a.sql`.

O arquivo recebido continha principalmente o bloco de definições de funções, não os blocos completos de grants/RLS/classificação. Portanto, esta classificação ainda depende dos resultados de grants e tabelas para virar migration corretiva.

---

## Resultado recebido

Arquivo analisado:

- `Result SQL.txt`

Conteúdo principal:

- definições SQL de funções selecionadas para revisão manual.

Funções presentes no resultado:

- `get_login_store_options()`;
- `get_my_visible_activity_logs(...)`;
- `get_store_permission_catalog()`;
- `get_store_permission_matrix_v3(p_store_id uuid)`;
- `get_store_settings_center(p_store_id uuid)`;
- `touch_store_permission_version(p_store_id uuid, p_reason text)`;
- `trg_touch_store_permission_version()`;
- `update_store_settings_section(p_store_id uuid, p_section text, p_settings jsonb)`;
- `validate_store_slug(p_store_id uuid, p_slug text)`.

---

## Classificação parcial por função

### `get_login_store_options()`

Classificação proposta:

- `authenticated_only_candidate`.

Motivo:

- usa `auth.uid()` para filtrar vínculos do usuário;
- é usada no login/escolha de loja após autenticação;
- não há motivo funcional para execução por `anon`.

Direção provável:

- revogar `EXECUTE` de `anon`;
- manter `EXECUTE` para `authenticated`.

---

### `get_my_visible_activity_logs(...)`

Classificação proposta:

- `authenticated_only_candidate`.

Motivo:

- verifica `auth.uid()` e lança erro se não houver usuário autenticado;
- valida vínculo com a loja;
- retorna histórico pessoal do colaborador.

Direção provável:

- revogar `EXECUTE` de `anon`;
- manter `EXECUTE` para `authenticated`.

---

### `get_store_permission_catalog()`

Classificação proposta:

- `authenticated_only_candidate`, com atenção à origem da UI de permissões.

Motivo:

- retorna catálogo ativo de permissões;
- não possui `auth.uid()` no corpo;
- expor catálogo completo para `anon` não é necessário para loja pública.

Direção provável:

- revogar `EXECUTE` de `anon`;
- manter `EXECUTE` para `authenticated` se o frontend/admin depender da RPC;
- avaliar RLS/policies da tabela `store_permission_catalog` em paralelo.

---

### `get_store_permission_matrix_v3(p_store_id uuid)`

Classificação proposta:

- `authenticated_only_candidate`.

Motivo:

- valida `auth.uid()`;
- exige `can_access_security_section_v3(p_store_id, 'roles', false)`;
- é função administrativa de matriz de permissões.

Direção provável:

- revogar `EXECUTE` de `anon`;
- manter `EXECUTE` para `authenticated`.

---

### `get_store_settings_center(p_store_id uuid)`

Classificação proposta:

- `authenticated_only_candidate`.

Motivo:

- valida `auth.uid()`;
- exige `settings.view` ou ownership;
- retorna dados de configuração da loja conforme permissões internas.

Direção provável:

- revogar `EXECUTE` de `anon`;
- manter `EXECUTE` para `authenticated`.

---

### `update_store_settings_section(p_store_id uuid, p_section text, p_settings jsonb)`

Classificação proposta:

- `authenticated_only_candidate`.

Motivo:

- valida `auth.uid()`;
- valida seção permitida;
- exige `can_access_settings_section(..., true)`;
- altera configurações administrativas.

Direção provável:

- revogar `EXECUTE` de `anon`;
- manter `EXECUTE` para `authenticated`.

---

### `touch_store_permission_version(p_store_id uuid, p_reason text)`

Classificação proposta:

- `internal_or_admin_only`.

Motivo:

- função técnica para incrementar `store_permission_versions`;
- não possui `auth.uid()` obrigatório;
- pode ser chamada por triggers ou outras RPCs;
- execução direta via REST por `anon` não é desejável.

Direção provável:

- revogar `EXECUTE` de `anon`;
- avaliar revogar também de `authenticated`, mantendo uso interno por trigger/RPC;
- validar dependências antes de migration.

---

### `trg_touch_store_permission_version()`

Classificação proposta:

- `internal_or_admin_only`.

Motivo:

- função de trigger;
- não deve ser executada diretamente via RPC pública;
- chama `touch_store_permission_version`.

Direção provável:

- revogar `EXECUTE` de `anon`;
- avaliar revogar também de `authenticated`;
- manter funcionamento via trigger.

---

### `validate_store_slug(p_store_id uuid, p_slug text)`

Classificação proposta:

- `depends_on_usage`.

Motivo:

- valida disponibilidade/formato de slug;
- não possui `auth.uid()`;
- pode ser admin-only se usado apenas em Configurações;
- poderia ser público se existir fluxo futuro de autocadastro/loja pública.

Direção provável:

- confirmar uso no frontend;
- se apenas admin/configurações, revogar `anon` e manter `authenticated`;
- se fluxo público futuro for desejado, criar função pública separada e mais restrita.

---

## Observação sobre o resultado recebido

O resultado enviado não incluiu, ou não preservou no arquivo exportado, os blocos de:

- RLS/grants das tabelas;
- grants detalhados por função;
- colunas `anon_can_execute`, `authenticated_can_execute`, `service_role_can_execute`;
- classificação SQL proposta por função.

Sem esses blocos, ainda não é seguro gerar migration corretiva final.

---

## Próxima coleta recomendada

Rodar diagnósticos menores e separados para evitar que o SQL Editor/exportação capture apenas o último resultado.

Arquivos recomendados:

- `docs/sql_diagnostics/diagnose_advisors_914a_tables_only.sql`;
- `docs/sql_diagnostics/diagnose_advisors_914a_function_grants_only.sql`.

---

## Direção provável da 9.14B

Se os grants confirmarem `anon=true`, a primeira migration corretiva provavelmente poderá:

1. Revogar `anon` de funções claramente administrativas:
   - `get_login_store_options`;
   - `get_my_visible_activity_logs`;
   - `get_store_permission_matrix_v3`;
   - `get_store_settings_center`;
   - `update_store_settings_section`.
2. Revogar `anon` de funções técnicas:
   - `touch_store_permission_version`;
   - `trg_touch_store_permission_version`.
3. Tratar `validate_store_slug` somente após confirmar uso.
4. Tratar RLS das tabelas em migration separada.

---

## Importante

Ainda não aplicar migration corretiva até termos os blocos completos de grants/RLS.
