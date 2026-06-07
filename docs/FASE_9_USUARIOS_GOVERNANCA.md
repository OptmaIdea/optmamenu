# Fase 9 — Usuários, permissões, governança e segurança

## Objetivo da fase

A Fase 9 consolida a estrutura de usuários do OptmaMenu, evoluindo o conceito de “usuário do sistema” para uma visão mais completa de membro, colaborador, prestador, responsável operacional e proprietário de loja.

Esta fase trata de:

- usuários e membros de loja;
- separação entre dados globais do usuário e dados do vínculo com a loja;
- permissões e papéis personalizados;
- ações sensíveis;
- onboarding;
- avatar;
- histórico do colaborador;
- solicitações cadastrais;
- segurança/RLS/Advisors do Supabase.

---

## Separação entre `profiles` e `store_members`

A Fase 9 consolidou uma separação essencial:

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
- permissões e ações sensíveis.

Essa separação permite que a mesma pessoa seja, por exemplo, proprietária de uma loja e colaboradora remota em outra, usando dados distintos em cada contexto operacional.

---

## Usuários multilojas

Foram tratados cenários em que um usuário possui mais de um vínculo.

Regras consolidadas:

- o contexto ativo deve respeitar o `member_id` do vínculo selecionado;
- solicitações cadastrais devem usar `member_id`, não apenas `store_id`;
- usuário suspenso não acessa a loja suspensa;
- usuário com loja própria continua podendo acessar sua própria loja;
- avatar, apelido, histórico e dados de vínculo devem respeitar a loja ativa.

---

## Ocorrências críticas de membro

A fase definiu ocorrências críticas para o ciclo do colaborador:

- Admissão;
- Suspensão;
- Desligamento;
- Alteração de função.

### Regras

- Admissão representa o início do vínculo/acesso.
- Suspensão bloqueia temporariamente o acesso ao aplicativo.
- Desligamento encerra o vínculo e remove o acesso.
- Alteração de função registra mudança de papel/cargo/função.
- Suspensão e desligamento exigem motivo.
- Reativação pode ocorrer sem motivo obrigatório.
- O histórico deve preservar entradas, saídas, suspensões e reativações.

---

## Meus Dados

A tela `/admin/my-profile` passa a ser o local principal para cada usuário manter seus próprios dados de vínculo.

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

---

## Avatar do usuário

Foi criado o bucket: `user-avatars`

Regras:

- o usuário pode enviar seu próprio avatar;
- owner/admin autorizado pode alterar quando permitido;
- avatar deve aparecer em Meus Dados e na sidebar;
- a imagem deve ser exibida em formato circular;
- fallback por iniciais é usado apenas quando não houver avatar.

---

## Onboarding do colaborador

Foram adicionados os controles:

- `onboarding_required`
- `onboarding_completed_at`

Regra:

- no primeiro acesso dentro da loja, o colaborador deve ser direcionado para preenchimento dos dados básicos obrigatórios.

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

## Permissões

A Fase 9 refinou permissões ligadas a:

- usuários;
- dados sensíveis;
- informações adicionais;
- informações adicionais sensíveis;
- solicitações cadastrais;
- papéis personalizados;
- ações sensíveis.

Regra geral:

- owner tem acesso integral;
- admin depende de permissões;
- manager, visualizador, estoquista e demais papéis não acessam Usuários por padrão;
- todos acessam Meus Dados e Meu Histórico.

---

## Solicitações cadastrais

Foi criada a tabela: `store_member_profile_change_requests`

Ela registra solicitações de alteração de dados cadastrais feitas pelo próprio usuário.

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

- `pending`
- `awaiting_member_confirmation`
- `correction_requested`
- `approved`
- `rejected`
- `cancelled`
- `applied`

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

A rota padronizada é: `/admin/my-history`

Ela substitui a rota anterior: `/admin/meu-historico`

O histórico deve registrar:

- admissão;
- suspensão;
- desligamento;
- alteração de função;
- solicitações cadastrais;
- aprovação/rejeição/cancelamento;
- alterações aplicadas;
- antes/depois;
- dados de login/logout quando implementados.

---

## Hardening Supabase / Advisors

Foi feita uma rodada de segurança:

- RLS crítico corrigido;
- anon reduzido ao essencial público;
- funções internas/triggers tratadas;
- `search_path` tratado;
- tabela legacy bloqueada;
- funções públicas mantidas apenas quando necessárias para loja pública, pedido público ou OTP.

Ainda restam WARNs esperados para:

- funções públicas necessárias à loja pública;
- RPCs autenticadas reais do painel/admin.

Esses WARNs ficam para hardening por módulo antes da publicação/testes reais.

---

## Estado ao final da Fase 9.9

A área de usuários está funcional e pronta para fechamento final na etapa 9.9P.

A próxima etapa imediata é:

**9.9P — Fechamento final da área de Usuários**

Objetivo:

- revisar fluxo completo;
- validar permissões;
- validar usuário multilojas;
- validar Meus Dados;
- validar Meu Histórico;
- validar solicitações cadastrais;
- corrigir apenas ajustes finos, sem abrir nova frente grande.
