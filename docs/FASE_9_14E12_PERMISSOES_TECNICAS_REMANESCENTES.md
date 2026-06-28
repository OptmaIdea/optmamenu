# Fase 9.14E.12 — Permissões técnicas remanescentes

## Status

Concluída como documentação de exceções intencionais.

Esta frente auditou as 2 funções restantes classificadas como `internal_technical_candidate` no diagnóstico da 9.14E.

## Base atual

Após a 9.14E.11, o diagnóstico retornou **158 funções** ainda executáveis por `authenticated`.

Grupo atual:

- `internal_technical_candidate`: **2 funções**.

## Funções auditadas

- `set_store_role_permission_v3(p_store_id uuid, p_role text, p_permission_code text, p_allowed boolean, p_reason text)`;
- `set_store_role_permissions_bulk_v3(p_store_id uuid, p_role text, p_changes jsonb, p_reason text)`.

## Uso direto confirmado

As duas funções aparecem em uso direto no frontend/admin:

- `src/hooks/security/useSecurityPermissionsAdmin.ts`.

## Decisão

Não criar migration nesta etapa.

Motivo:

- as funções são o caminho ativo para edição de permissões por papel;
- são usadas pela administração de Segurança/Permissões;
- ambas validam usuário autenticado, loja, papel editável e permissão por meio de `can_access_security_section_v3(p_store_id, 'roles', true)`;
- revogar `authenticated` quebraria a tela de Papéis/Permissões.

## Classificação

As duas funções deixam de ser tratadas como candidatas técnicas internas para revogação imediata e passam a ser documentadas como:

- exceções operacionais intencionais;
- funções administrativas sensíveis;
- dependentes de `security.view`/roles/manage via gate `can_access_security_section_v3`.

## Observação de segurança

Apesar de permanecerem com `authenticated=true`, as funções possuem validações internas relevantes:

- exigem `auth.uid()`;
- exigem `p_store_id`;
- restringem papéis editáveis;
- validam permissão ativa no catálogo;
- registram log de segurança quando possível;
- exigem acesso de gestão à seção `roles`.

## Resultado esperado no Advisor

A contagem não deve cair nesta etapa.

A 9.14E.12 não remove grants. Ela apenas documenta as 2 funções técnicas remanescentes como exceções intencionais porque são usadas pelo admin.

## Próxima etapa recomendada

### 9.14E.13 — Usuários, Segurança e Permissões

Auditar o grupo `users_security_permissions`, atualmente com **56 funções**.

Diretriz:

- trabalhar por subgrupos pequenos;
- começar pelas funções de leitura/admin usadas diretamente;
- preservar funções ativas de Segurança, Usuários e Permissões;
- procurar auxiliares antigas sem uso direto;
- evitar revogação de qualquer função usada por guards, hooks ou telas de segurança.
