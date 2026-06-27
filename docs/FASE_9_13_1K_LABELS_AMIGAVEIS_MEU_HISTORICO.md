# Fase 9.13.1K — Labels amigáveis no Meu Histórico

## Status

**Aberta para refinamento visual/textual.**

Esta frente nasce após o fechamento funcional da 9.13.1J, quando o fluxo de alteração cadastral de nome foi validado e ficou claro que alguns registros do **Meu Histórico** ainda exibem rótulos técnicos.

A etapa é de UI/UX textual. Não deve alterar regras de permissão, RLS, Advisors, cálculo efetivo de permissões ou estrutura de banco.

---

## Objetivo

Melhorar a legibilidade do **Meu Histórico**, traduzindo termos técnicos para linguagem amigável ao usuário final.

Exemplos observados:

- `name_change` deve aparecer como `Alteração de nome`;
- `applied` deve aparecer como `Aplicada`;
- `full_name` ou `name` devem aparecer como `Nome completo`;
- status de solicitações cadastrais devem ser exibidos em português claro.

---

## Escopo inicial

Arquivo principal:

- `src/pages/private/admin/settings/myHistory/MyHistory.tsx`

Ajustes previstos:

- ampliar `ACTION_LABELS` para eventos pessoais e solicitações cadastrais;
- criar tradutores locais para:
  - tipo de solicitação cadastral;
  - status de solicitação;
  - campos cadastrais;
- aplicar tradução no bloco `profile_request_*`;
- manter fallback seguro para eventos desconhecidos.

---

## Fora do escopo

- alterar RPC `get_my_visible_activity_logs`;
- mexer em permissões;
- alterar RLS/policies;
- alterar estrutura de tabelas;
- alterar fluxo de aprovação/aplicação cadastral;
- mexer em Advisors.

---

## Diretriz de produto

O histórico deve ser compreensível para colaborador comum, não apenas para desenvolvedor.

Preferir:

- `Alteração de nome` em vez de `name_change`;
- `Aplicada` em vez de `applied`;
- `Nome completo` em vez de `full_name` ou `name`;
- `Observação do responsável` em vez de `admin_notes`.

---

## Critérios de aceite

- Cards do Meu Histórico não devem exibir `name_change` em texto principal ou detalhes.
- Status técnicos comuns devem aparecer em português.
- O fluxo já validado de alteração cadastral deve continuar aparecendo no histórico.
- Build deve passar sem erros.
- Console deve permanecer limpo.

---

## Observação

Como é refinamento de frontend, a primeira entrega pode ser aplicada apenas em `MyHistory.tsx`.

Se no futuro a RPC retornar `display_action` e `details` já totalmente amigáveis, a UI pode ficar mais simples, mas nesta rodada a correção local é suficiente e segura.
