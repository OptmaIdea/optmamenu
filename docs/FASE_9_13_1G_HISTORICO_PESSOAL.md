# Fase 9.13.1G — Histórico pessoal e auditoria de alterações

## Status

**Concluída funcionalmente.**

Esta frente fecha a rastreabilidade pessoal do colaborador em `/admin/my-history`, sem transformar o Meu Histórico em uma auditoria operacional completa do sistema.

---

## Objetivo

Garantir que eventos relevantes para o próprio usuário apareçam em seu histórico pessoal, com contexto suficiente para auditoria, transparência e governança.

A frente cobre:

- alterações de papel/função do colaborador;
- atribuição ou remoção de função personalizada;
- solicitações cadastrais e seus andamentos;
- ocorrências visíveis do vínculo do colaborador;
- eventos pessoais de sessão e segurança;
- exibição amigável no frontend.

---

## Escopo consolidado do Meu Histórico

O `/admin/my-history` representa o histórico pessoal de acesso, segurança e vínculo do colaborador.

Entram no Meu Histórico:

- login, logout, loja acessada e sessão encerrada;
- alteração de papel/função do usuário afetado;
- função personalizada atribuída ou removida do usuário afetado;
- permissões e eventos pessoais quando o usuário for o alvo;
- admissão, suspensão, desligamento, reativação e demais ocorrências marcadas como visíveis ao membro;
- solicitações cadastrais do próprio usuário;
- aprovação, rejeição, cancelamento, conferência e aplicação de alterações cadastrais.

Não entram automaticamente neste escopo:

- vendas feitas pelo usuário;
- pedidos atendidos;
- produtos criados ou editados;
- compras lançadas;
- cotações aprovadas;
- transferências iniciadas ou recebidas;
- ajustes de estoque;
- ações financeiras operacionais.

Essas ações pertencem à auditoria operacional, timeline da entidade ou a uma futura visão de **Minhas Atividades Operacionais**.

---

## Banco de dados e RPCs envolvidas

### `change_store_member_role`

Alteração de papel base do membro.

Ajustes consolidados:

- registra `store_security_logs` com ação `store_member_role_changed`;
- registra ocorrência `role_change` em `store_member_occurrences`;
- ocorrência fica `visible_to_member=true`;
- metadata passa a guardar:
  - `old_role`;
  - `new_role`;
  - `reason`;
  - `actor_user_id`;
  - `actor_name`;
  - `actor_email`;
  - `target_user_id`;
  - `target_user_name`;
  - `target_user_email`;
  - `clear_individual_overrides`;
  - dados de função personalizada removida, quando aplicável.

### `assign_store_custom_role_to_member`

Atribuição ou remoção de função personalizada.

Ajustes consolidados:

- registra `store_security_logs` com `store_custom_role_assigned` ou `store_custom_role_removed`;
- registra ocorrência `role_change`;
- ocorrência fica `visible_to_member=true`;
- metadata registra função personalizada anterior/nova, papel base, responsável, alvo e motivo.

### `get_my_visible_activity_logs`

RPC oficial da tela `/admin/my-history`.

Ajustes consolidados:

- busca eventos de sessão e segurança feitos pelo próprio usuário;
- busca eventos onde o usuário logado é o alvo, quando forem relevantes ao histórico pessoal;
- consolida ocorrências visíveis do próprio membro em `store_member_occurrences`;
- consolida solicitações cadastrais visíveis do próprio usuário em `store_member_profile_change_requests`;
- evita duplicidade para alteração de papel/função, priorizando a ocorrência pessoal visível em vez do log administrativo bruto;
- mantém dados sensíveis protegidos em solicitações cadastrais.

---

## Backfill aplicado

Foi aplicado backfill para eventos antigos de `role_change`:

- eventos antigos passaram para `visible_to_member=true`;
- metadata histórica foi enriquecida a partir de `store_security_logs`;
- foram adicionados responsável, alvo, motivo, função anterior, nova função e referência ao log de segurança.

O backfill preserva o texto original da ocorrência e não altera o significado histórico do evento.

---

## Frontend

Arquivo principal:

- `src/pages/private/admin/settings/myHistory/MyHistory.tsx`

Ajustes consolidados:

- `formatMyHistoryDetails` deixou de cair em texto genérico para `role_change`;
- exibe função anterior e nova função traduzidas;
- exibe responsável pela alteração;
- exibe motivo;
- exibe função personalizada quando aplicável;
- evita repetição visual de motivo;
- mantém fallback para eventos ainda não mapeados.

---

## Resultado validado

Validação visual realizada em `/admin/my-history`:

- eventos de mudança de função aparecem para o usuário afetado;
- duplicidade entre log administrativo e ocorrência pessoal foi removida;
- cards exibem detalhes amigáveis;
- data/hora aparece corretamente;
- loja acessada e sessão encerrada seguem funcionando;
- eventos antigos passaram a aparecer após backfill.

---

## Decisão de produto

O Meu Histórico fica restrito a:

> sessão + segurança pessoal + vínculo/função + solicitações cadastrais + ocorrências visíveis do colaborador.

Ações operacionais feitas pelo usuário de acordo com suas permissões não entram automaticamente nesta tela. Quando necessário, serão tratadas em uma futura frente própria de auditoria operacional por usuário ou Minhas Atividades Operacionais.

---

## Próximos passos naturais

Após este fechamento, a sequência pode seguir para configurações funcionais que estavam aguardando rastreabilidade, especialmente:

- Pedido Online em Configurações;
- Mensagens e textos padrão;
- ajustes finos em Configurações Comerciais/Estoque;
- hardening de Advisors/RLS em rodada própria, sem misturar com UX funcional.
