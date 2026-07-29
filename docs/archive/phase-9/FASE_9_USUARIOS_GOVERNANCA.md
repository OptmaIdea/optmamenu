# Fase 9 — Usuários, permissões, governança e segurança

## Status

**Fechamento funcional consolidado.**

A Fase 9 consolidou a estrutura de usuários, colaboradores, papéis, permissões, segurança operacional, Meus Dados, Meu Histórico, solicitações cadastrais, funções personalizadas e governança de acesso do OptmaMenu.

Esta documentação registra o fechamento funcional da fase. A rodada de **Advisors/RLS/hardening Supabase** permanece separada e deve ser tratada em frente própria, sem misturar com o fechamento funcional.

---

## Objetivo da fase

A Fase 9 evolui o conceito de “usuário do sistema” para uma visão mais completa de:

- membro de loja;
- colaborador;
- prestador;
- responsável operacional;
- administrador;
- proprietário;
- usuário com múltiplos vínculos.

A fase trata de:

- usuários e membros de loja;
- separação entre dados globais do usuário e dados do vínculo com a loja;
- Meus Dados;
- Meu Histórico;
- solicitações cadastrais;
- avatar;
- onboarding;
- ocorrências de colaborador;
- permissões por papel;
- funções personalizadas;
- permissões individuais por usuário;
- ações sensíveis;
- Configurações e Segurança;
- realtime de permissões;
- governança de alterações.

---

## Resultado funcional consolidado

A fase deixa o OptmaMenu com:

- rotas pessoais padronizadas para `/admin/my-profile` e `/admin/my-history`;
- dados globais separados de dados por vínculo de loja;
- fluxo de solicitações cadastrais com aprovação/rejeição/aplicação;
- histórico pessoal visível ao colaborador;
- permissões por papel;
- funções personalizadas baseadas em papel;
- permissões individuais que prevalecem sobre função personalizada;
- função personalizada que prevalece sobre papel base;
- realtime centralizado por `store_permission_versions`;
- padrão `view=false` e `manage=false` consolidado;
- Configurações e Segurança separadas no menu;
- Configurações da Loja centralizada em abas;
- Mensagens, Pedido Online e Aparência integrados a Configurações;
- exibição de função personalizada na escolha de loja/login;
- documentação de checklist para novas permissões.

---

## Separação entre `profiles` e `store_members`

A Fase 9 consolidou uma separação essencial.

### `profiles`

Representa os dados globais do usuário no OptmaMenu.

Exemplos:

- nome completo;
- CPF;
- data de nascimento;
- avatar global;
- dados principais do usuário proprietário/master.

### `store_members`

Representa o vínculo do usuário com uma loja específica.

Exemplos:

- apelido no contexto da loja;
- avatar usado naquele vínculo;
- e-mail de contato da relação com a loja;
- telefone, celular e WhatsApp;
- endereço de correspondência;
- cargo/função;
- status do vínculo;
- informações adicionais;
- histórico operacional;
- permissões e ações sensíveis;
- função personalizada vinculada.

Essa separação permite que a mesma pessoa seja proprietária de uma loja e colaboradora em outra, usando dados e permissões distintos em cada contexto operacional.

---

## Usuários multilojas

Foram tratados cenários em que um usuário possui mais de um vínculo.

Regras consolidadas:

- o contexto ativo deve respeitar o `member_id` do vínculo selecionado;
- solicitações cadastrais devem usar `member_id`, não apenas `store_id`;
- usuário suspenso não acessa a loja suspensa;
- usuário com loja própria continua podendo acessar sua própria loja;
- avatar, apelido, histórico e dados de vínculo devem respeitar a loja ativa;
- a tela de escolha de loja/login deve priorizar função personalizada quando existir.

Exemplo validado:

- papel base: `manager` / Gerente;
- função personalizada: `Subgerente Nível I`;
- login deve exibir `Subgerente Nível I` quando `custom_role_name` estiver presente.

---

## Ocorrências críticas de membro

A fase definiu ocorrências críticas para o ciclo do colaborador:

- admissão;
- suspensão;
- desligamento;
- reativação;
- alteração de função/papel;
- atribuição/remoção de função personalizada.

### Regras

- Admissão representa o início do vínculo/acesso.
- Suspensão bloqueia temporariamente o acesso ao aplicativo.
- Desligamento encerra o vínculo e remove o acesso.
- Alteração de função registra mudança de papel/cargo/função.
- Suspensão e desligamento exigem motivo.
- Reativação pode ocorrer sem motivo obrigatório.
- O histórico deve preservar entradas, saídas, suspensões, reativações e alterações de função.

---

## Meus Dados

A tela `/admin/my-profile` é o local principal para cada usuário manter seus próprios dados de vínculo.

Todos os usuários autenticados podem acessar:

- `/admin/my-profile`;
- `/admin/my-history`.

O usuário pode editar seus próprios dados operacionais:

- apelido;
- e-mail de contato;
- telefone fixo;
- celular;
- WhatsApp;
- endereço;
- informações adicionais;
- avatar.

Dados documentais exigem solicitação justificada:

- nome completo;
- CPF;
- data de nascimento.

O fluxo validado para alterar nome completo foi:

1. usuário solicita alteração em Meus Dados;
2. responsável revisa/aprova;
3. alteração é aplicada;
4. Meu Histórico registra o evento;
5. listas administrativas passam a exibir o nome cadastral atualizado.

---

## Avatar do usuário

Foi criado o bucket:

- `user-avatars`

Regras:

- o usuário pode enviar seu próprio avatar;
- owner/admin autorizado pode alterar quando permitido;
- avatar deve aparecer em Meus Dados e na sidebar;
- a imagem deve ser exibida em formato circular;
- fallback por iniciais é usado apenas quando não houver avatar.

---

## Onboarding do colaborador

Foram adicionados os controles:

- `onboarding_required`;
- `onboarding_completed_at`.

Regra:

- no primeiro acesso dentro da loja, o colaborador pode ser direcionado para preenchimento dos dados básicos obrigatórios.

---

## Informações adicionais do colaborador

Foi consolidado o uso de `member_additional_info` em JSONB.

Formato base:

```json
[
  {
    "id": "uuid",
    "title": "Alergia",
    "text": "Lactose",
    "sensitive": true,
    "created_at": "..."
  }
]
```

Regras:

- usuário pode incluir nova informação adicional;
- usuário pode editar informação adicional existente;
- usuário pode marcar/desmarcar sensibilidade;
- usuário pode solicitar remoção de informação já salva;
- qualquer usuário pode ver suas próprias informações sensíveis;
- terceiros só veem dados sensíveis mediante permissão;
- owner vê tudo;
- admin pode ter permissões revogadas;
- manager/visualizador/estoquista não veem dados sensíveis de terceiros por padrão.

---

## Solicitações cadastrais

Foi criada a tabela:

- `store_member_profile_change_requests`

Ela registra solicitações de alteração de dados cadastrais feitas pelo próprio usuário ou propostas pela administração.

Tipos principais:

- alteração de nome;
- alteração de CPF;
- alteração de data de nascimento;
- alteração de contato;
- alteração de endereço;
- alteração de avatar;
- alteração de informação adicional;
- remoção de informação adicional;
- outros.

Status usados:

- `pending`;
- `awaiting_member_confirmation`;
- `correction_requested`;
- `approved`;
- `rejected`;
- `cancelled`;
- `applied`.

Fluxo prático consolidado:

1. Usuário solicita alteração por mini formulário.
2. Sistema registra valores antigos e novos.
3. Owner/admin autorizado aprova ou rejeita.
4. Se aprovado, os dados são aplicados em `store_members` ou `profiles`.
5. Se rejeitado, os dados permanecem inalterados.
6. Usuário pode cancelar enquanto a solicitação estiver pendente.
7. Histórico registra antes/depois, responsável e motivo.

---

## Mini formulários de solicitação

A Fase 9 substituiu textarea genérico por formulários específicos.

### Endereço

Campos:

- CEP;
- endereço;
- número;
- complemento;
- bairro;
- cidade;
- UF.

Cada campo mostra o valor atual abaixo do input.

### Contato

Campos:

- e-mail;
- celular;
- WhatsApp;
- telefone fixo.

### Documentos

Campos:

- nome completo;
- CPF;
- data de nascimento.

### Informação adicional

Para alteração de informação adicional existente:

- listar itens existentes;
- selecionar item;
- alterar título;
- alterar texto;
- alterar sensibilidade.

Nova informação adicional continua sendo adicionada diretamente em Meus Dados.

---

## Meu Histórico

A rota padronizada é:

- `/admin/my-history`

Ela substitui a rota anterior:

- `/admin/meu-historico`

O histórico registra:

- admissão;
- suspensão;
- desligamento;
- alteração de função;
- atribuição/remoção de função personalizada;
- solicitações cadastrais;
- aprovação/rejeição/cancelamento;
- alterações aplicadas;
- antes/depois;
- dados de login/logout quando disponíveis;
- eventos pessoais visíveis ao colaborador.

A frente `9.13.1K` refinou labels amigáveis para evitar termos técnicos como:

- `name_change`;
- `applied`;
- `full_name`;
- `name`.

Diretriz:

- Meu Histórico deve ser compreensível para colaborador comum, não apenas para desenvolvedor.

---

## Permissões

A Fase 9 refinou permissões ligadas a:

- usuários;
- dados sensíveis;
- informações adicionais;
- informações adicionais sensíveis;
- solicitações cadastrais;
- papéis personalizados;
- ações sensíveis;
- permissões por papel;
- permissões individuais;
- configurações;
- segurança;
- realtime de permissões.

Regra geral:

- owner tem acesso integral;
- admin depende de permissões;
- manager, visualizador, estoquista e demais papéis não acessam Usuários por padrão;
- todos acessam Meus Dados e Meu Histórico.

### Hierarquia final de permissões

1. Owner tem acesso integral.
2. Permissão individual em `store_members.permissions`.
3. Função personalizada em `store_custom_roles.permissions`.
4. Papel base em `store_role_permission_templates`.
5. Fallback seguro `false`.

> Importante: o modelo atual usa JSONB em `store_members.permissions` para overrides individuais. A tabela `store_member_permissions` não faz parte do modelo ativo.

### Realtime consolidado

A sincronização em tempo real usa `store_permission_versions` como canal central.

O hook `usePermissions` escuta apenas `store_permission_versions`, evitando listeners duplicados em tabelas de templates, funções e membros.

### `view=false` e `manage=false`

- `view=false`: oculta menu/aba/rota e bloqueia acesso direto.
- `view=true` + `manage=false`: abre em modo leitura, com inputs desabilitados e ações ocultas.

O componente padrão criado para isso é:

- `src/components/security/PermissionLocked.tsx`

---

## Configurações e Segurança

Configurações e Segurança foram separadas no sidebar.

- **Configurações** contém apenas “Configurações da Loja”, com abas internas.
- **Segurança** contém “Senhas e Acesso”.

`security.view` é porteira absoluta do módulo Segurança.

`settings.view` é porteira do conjunto Configurações da Loja.

A Fase 9.13 e complementos fecharam:

- permissões por papel;
- funções personalizadas;
- permissões por usuário;
- ações sensíveis;
- contexto de acesso;
- histórico de atividades;
- Meu Histórico;
- Meus Dados;
- Pedido Online em Configurações;
- Aparência da Loja;
- Mensagens e Atendimento;
- login com função personalizada.

Documentação detalhada:

- `docs/FASE_9_13_PERMISSOES_SEGURANCA.md`;
- `docs/FASE_9_13_1G_HISTORICO_PESSOAL.md`;
- `docs/FASE_9_13_1H_PEDIDO_ONLINE_CONFIGURACOES.md`;
- `docs/FASE_9_13_1I_MENSAGENS_ATENDIMENTO.md`;
- `docs/FASE_9_13_1J_PERMISSOES_PERSONALIZADAS_REALTIME.md`;
- `docs/FASE_9_13_1K_LABELS_AMIGAVEIS_MEU_HISTORICO.md`.

---

## Configurações comerciais fechadas dentro da Fase 9

Embora Configurações seja transversal, as frentes 9.13.1H e 9.13.1I consolidaram itens importantes:

- Pedido Online;
- Aparência da Loja;
- Mensagens e Atendimento;
- permissões dedicadas por aba;
- padrão `view/manage` para leitura/edição;
- persistência de mensagens em `stores.config.message_settings`;
- separação entre mensagens operacionais e marketing;
- aviso LGPD/WhatsApp manual.

---

## Checklist obrigatório para novas permissões

Toda nova permissão deve seguir o checklist consolidado:

1. Criar/atualizar `store_permission_catalog`.
2. Criar/atualizar `store_role_permission_templates`.
3. Atualizar `store_permission_versions`.
4. Ajustar `PERMISSION_GROUP_DEFINITIONS`, quando a UI depender de prefixos/grupos.
5. Ajustar `ROLE_PERMISSION_TREE` com item, label, `accessPermission` e lista de permissões.
6. Conferir ordenação visual manualmente.
7. Ajustar tela/rota consumidora.
8. Documentar em `docs/PERMISSOES_USUARIOS.md` e documentos da frente.

Documento específico:

- `docs/CHECKLIST_NOVAS_PERMISSOES.md`.

---

## Frentes de fechamento da Fase 9.13

### 9.13 — Permissões, Segurança, Realtime e `manage=false`

Status: concluída tecnicamente.

Consolidou:

- `view=false`;
- `manage=false`;
- `security.view` como porteira absoluta;
- Configurações e Segurança separadas;
- `store_permission_versions` como canal central.

### 9.13.1G — Histórico pessoal e auditoria de alterações

Status: concluída funcionalmente.

Consolidou:

- Meu Histórico;
- eventos pessoais;
- sessões;
- alteração de função;
- solicitações cadastrais;
- ocorrências visíveis ao colaborador.

### 9.13.1H — Pedido Online e Aparência

Status: concluída funcionalmente.

Consolidou:

- Pedido Online em Configurações;
- Aparência da Loja;
- permissões dedicadas;
- persistência validada;
- snapshot Supabase atualizado.

### 9.13.1I — Mensagens e Atendimento

Status: concluída funcionalmente.

Consolidou:

- Mensagens operacionais;
- texto de consentimento;
- templates de atendimento;
- OptmaSMSGate;
- permissões `settings.messages.view/manage`;
- separação entre mensagens operacionais e marketing.

### 9.13.1J — Funções personalizadas, realtime e identidade

Status: concluída funcionalmente.

Consolidou:

- função personalizada refletindo em tempo real;
- precedência `individual > função personalizada > papel base`;
- `get_effective_store_permissions` considerando `custom_role_id`;
- fallback de identidade com `full_name`;
- origem real do nome em Permissões por usuário.

### 9.13.1K — Labels amigáveis, histórico e login

Status: concluída funcionalmente.

Consolidou:

- labels amigáveis no Meu Histórico;
- cuidado com encoding textual;
- `get_login_store_options` retornando função personalizada;
- login exibindo `Subgerente Nível I` em vez de apenas `Gerente` quando houver `custom_role_name`.

---

## Hardening Supabase / Advisors

A rodada de Advisors/RLS **não faz parte deste fechamento funcional**.

Diretriz consolidada:

- não misturar fechamento funcional com hardening Supabase;
- manter `docs/ADVISORS.md` como documento de referência;
- sempre desconsiderar o aviso `Leaked Password Protection Disabled`;
- tratar RLS, policies e WARNs de funções em rodada própria.

Pontos de atenção conhecidos ficam para rodada específica:

- `store_permission_catalog` com RLS desabilitado;
- tabela backup `store_role_permission_templates_backup_910c` com RLS desabilitado;
- WARNs de funções `SECURITY DEFINER` executáveis por `anon`.

---

## Estado ao final da Fase 9 funcional

Concluído funcionalmente:

- usuários e vínculos multilojas;
- Meus Dados;
- Meu Histórico;
- solicitações cadastrais;
- avatar;
- ocorrências de colaborador;
- permissões por papel;
- funções personalizadas;
- permissões individuais;
- ações sensíveis;
- realtime de permissões;
- padrão `view/manage`;
- separação Configurações x Segurança;
- Configurações da Loja centralizadas em abas;
- Pedido Online;
- Aparência da Loja;
- Mensagens e Atendimento;
- login com função personalizada;
- documentação operacional das frentes 9.13.1G a 9.13.1K.

Validações registradas pelo usuário:

- build passou;
- console limpo;
- permissões por usuário funcionando;
- funções personalizadas funcionando em tempo real;
- hierarquia de permissões funcionando;
- login exibindo função personalizada;
- snapshot Supabase atualizado após migrations.

---

## Próxima etapa recomendada

1. Revisar se `docs/RPCS_AND_VIEWS.md` está completo com todas as RPCs alteradas nas frentes 9.13.1J e 9.13.1K.
2. Atualizar eventuais documentos de índice/estrutura, se necessário.
3. Abrir rodada separada de Advisors/RLS/hardening Supabase.
4. Só depois avançar para novos módulos grandes.
