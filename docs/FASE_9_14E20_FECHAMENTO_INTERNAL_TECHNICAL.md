# Fase 9.14E.20 — Fechamento do bloco internal technical

## Status

Concluída.

Esta etapa fecha documentalmente o grupo `internal_technical_candidate` remanescente da auditoria 9.14E.

## Base validada

Após a 9.14E.18 e o fechamento documental 9.14E.19:

- total geral: **125 funções** executáveis por `authenticated`;
- grupo `internal_technical_candidate`: **2 funções**.

## Funções remanescentes

As duas funções remanescentes são:

- `set_store_role_permission_v3(p_store_id uuid, p_role text, p_permission_code text, p_allowed boolean, p_reason text)`;
- `set_store_role_permissions_bulk_v3(p_store_id uuid, p_role text, p_changes jsonb, p_reason text)`.

## Histórico da decisão

Essas funções já haviam sido avaliadas na 9.14E.12 como exceções intencionais.

A 9.14E.20 registra o fechamento definitivo para evitar retorno posterior ao mesmo bloco.

## Motivo para preservar `authenticated`

As funções são chamadas diretamente pelo hook administrativo de permissões e representam o caminho atual para edição de permissões por papel.

Remover o grant de `authenticated` quebraria a tela de Segurança/Permissões, especialmente:

- alteração individual de permissão por papel;
- alteração em lote de permissões por papel;
- sincronização da matriz visual com os templates persistidos.

## Gatilhos de segurança existentes

As funções possuem proteções relevantes:

- exigem `auth.uid()`;
- exigem `p_store_id`;
- normalizam e restringem papéis editáveis;
- rejeitam papéis inválidos;
- exigem permissão de Segurança por meio de `can_access_security_section_v3(p_store_id, 'roles', true)`;
- validam que a permissão existe e está ativa no catálogo;
- atualizam apenas templates da loja informada;
- registram log de segurança quando possível.

## Decisão

Não criar migration.

Manter ambas como exceções intencionais:

- `authenticated`: preservado;
- `anon`: revogado/ausente;
- `service_role`: preservado.

## Observação técnica

Mesmo que o diagnóstico classifique essas funções como `internal_technical_candidate`, no estado atual elas não são apenas helpers internos: são endpoints administrativos ativos para a UI de Segurança.

Portanto, a classificação operacional final é:

- **administrativas ativas / exceção intencional**.

## Hardening futuro recomendado

Sem bloqueio para esta fase.

Sugestões futuras:

1. Manter testes funcionais da matriz de permissões após qualquer alteração em catálogo/template.
2. Considerar logs mais detalhados para alterações em lote, se necessário.
3. Evitar criar novos caminhos paralelos para alteração de permissões por papel.
4. Centralizar novas permissões sempre no catálogo/template/versões/UI/constants/consumidores.

## Resultado final do bloco

O grupo `internal_technical_candidate` fica fechado sem novas alterações SQL.

As 2 funções remanescentes permanecem documentadas como exceções intencionais.

## Próxima etapa recomendada

### 9.14E.21 — Início do grupo `uncategorized_review`

O diagnóstico ainda apresenta:

- `uncategorized_review`: **37 funções**.

Esse grupo deve ser tratado em subgrupos pequenos, com busca de uso real antes de qualquer revogação.
