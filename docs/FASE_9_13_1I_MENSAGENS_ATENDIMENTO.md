# Fase 9.13.1I — Configurações de Mensagens e Atendimento

## Status

**Concluída funcionalmente.**

Esta etapa transforma a aba **Configurações da Loja → Mensagens** em uma área de governança de comunicação operacional e atendimento. O foco é ajudar o pequeno lojista a se comunicar melhor com clientes, com clareza, acolhimento, responsabilidade e segurança.

Esta frente não cria disparos automáticos, campanhas, segmentação de marketing, mascote ou automações de WhatsApp. Esses temas ficam separados para módulos próprios.

---

## Objetivo

Permitir que o lojista configure textos usados em:

- atendimento inicial via WhatsApp;
- acompanhamento do pedido online;
- confirmação de pedido;
- preparo, entrega e retirada;
- instruções de pagamento;
- agradecimento pós-compra;
- pedido de avaliação com cuidado;
- comunicação de fidelidade/pontos com cuidado;
- consentimento de mensagens;
- integração opcional com OptmaSMSGate.

O diferencial de produto é orientar o lojista simples a ter um atendimento digital mais profissional, humano e responsável.

---

## Risco jurídico e reputacional

Mensagens de atendimento afetam diretamente a confiança do cliente. Uma mensagem mal escrita, excessivamente promocional, invasiva, ofensiva, enviada sem contexto ou sem consentimento pode gerar:

- desgaste da loja;
- reclamações;
- bloqueio no WhatsApp;
- sensação de invasão;
- perda de confiança;
- risco jurídico e LGPD;
- exposição desnecessária de dados pessoais.

O OptmaMenu deve orientar o lojista, mas não substitui assessoria jurídica. A responsabilidade pelo conteúdo enviado, finalidade do uso de dados e base legal é do lojista/controlador.

---

## Mensagem operacional x marketing

### Mensagem operacional/transacional

Mensagem ligada diretamente ao pedido, atendimento ou serviço solicitado pelo cliente.

Exemplos:

- pedido recebido;
- pedido aceito;
- pedido em preparo;
- saiu para entrega;
- pronto para retirada;
- instruções de pagamento;
- cancelamento;
- agradecimento pós-compra.

Essas mensagens entram nesta etapa.

### Mensagem promocional/marketing

Mensagem voltada a estimular compra, campanha, cupom, promoção, recuperação de cliente ou relacionamento em massa.

Exemplos:

- promoção do dia;
- cupom;
- aniversariantes;
- clientes inativos;
- campanhas por segmento;
- mensagens em massa;
- automações promocionais.

Essas mensagens ficam para a **Central de Marketing** ou módulo futuro, com regras próprias de consentimento e opt-out.

---

## Boas práticas de comunicação

A interface incentiva o lojista a:

- escrever mensagens curtas;
- usar tom respeitoso e humano;
- evitar caixa alta;
- evitar excesso de emojis;
- evitar intimidade exagerada;
- não prometer prazo que não controla;
- não expor dados sensíveis sem necessidade;
- separar atendimento operacional de promoção;
- revisar a prévia antes de salvar;
- usar mensagens promocionais somente com consentimento.

---

## WhatsApp manual e limites atuais

No estado atual do produto:

- o WhatsApp é o canal principal;
- o OptmaMenu pode preparar textos e abrir o WhatsApp manualmente;
- a confirmação de envio é manual pelo lojista;
- status como entregue/lido dependem de API oficial ou marcação manual;
- automações oficiais de WhatsApp ficam para integração futura.

A interface não promete automação, entrega garantida ou leitura automática.

---

## Escopo implementado

Arquivo principal:

- `src/pages/private/admin/settings/messages/MessageSettings.tsx`

A tela foi evoluída para conter:

- cards informativos de atendimento, LGPD e WhatsApp manual;
- texto de consentimento;
- grupos de mensagens;
- editor com textarea;
- contador de caracteres;
- variáveis clicáveis;
- prévia com dados fictícios;
- classificação de risco;
- aviso para mensagens de relacionamento;
- botão restaurar padrão da mensagem;
- botão restaurar todos os padrões;
- botão salvar;
- modo leitura quando não há permissão de edição;
- persistência em JSONB;
- carregamento direto de `stores.config` para garantir persistência após reload.

Também foi integrada à aba interna:

- `/admin/settings?tab=messages`

---

## Grupos e mensagens

### Atendimento

- mensagem inicial do WhatsApp;
- mensagem padrão de atendimento manual.

### Pedido

- pedido recebido;
- pedido aceito;
- pedido em preparo;
- saiu para entrega;
- pronto para retirada;
- pedido cancelado.

### Instruções

- instruções de pagamento;
- instruções de retirada;
- instruções de entrega.

### Relacionamento

- agradecimento pós-compra;
- pedido de avaliação;
- fidelidade/pontos.

Mensagens de relacionamento aparecem com aviso de cuidado para não virarem envio repetitivo ou promocional sem consentimento.

---

## Variáveis suportadas na tela

- `{cliente_nome}`
- `{loja_nome}`
- `{pedido_codigo}`
- `{valor_total}`
- `{tempo_estimado}`
- `{endereco}`
- `{link_pedido}`
- `{forma_pagamento}`
- `{tipo_entrega}`

A prévia substitui variáveis por dados fictícios para facilitar a revisão pelo lojista.

---

## Persistência

Nesta etapa não foram criadas tabelas ou RPCs novas para mensagens.

A persistência atual usa:

- `stores.config.message_settings` para configurações de mensagens;
- `stores.config.custom_consent_text` como compatibilidade com fluxo já existente;
- `stores.sms_gateway_token` para token do OptmaSMSGate.

Estrutura conceitual salva em `stores.config.message_settings`:

```json
{
  "version": 1,
  "consent": {
    "customer_message_consent_text": "..."
  },
  "operational": {
    "whatsapp_initial_message": "...",
    "manual_service_message": "...",
    "order_received": "...",
    "order_accepted": "...",
    "order_preparing": "...",
    "order_out_for_delivery": "...",
    "order_ready_for_pickup": "...",
    "order_cancelled": "...",
    "payment_instructions": "...",
    "pickup_instructions": "...",
    "delivery_instructions": "...",
    "post_purchase_thanks": "...",
    "review_request": "...",
    "loyalty_points": "..."
  },
  "sms": {
    "use_sms_gateway": false
  },
  "metadata": {
    "updated_at": "...",
    "source": "settings.messages"
  }
}
```

Direção futura preferida, caso o backend seja ajustado:

1. usar `store_settings.message_settings`, se for criado/confirmado;
2. ou usar `update_store_settings_section('messages')`, se a RPC passar a suportar a seção;
3. evitar tabela nova enquanto JSONB resolver bem.

---

## Permissões

### Permissões dedicadas

A frente recebeu migration própria para permissões dedicadas:

- `supabase/migrations/20260625133000_add_settings_messages_permissions.sql`

A migration cria/atualiza no catálogo correto:

- `settings.messages.view`
- `settings.messages.manage`

E popula `store_role_permission_templates` por loja/papel.

### Padrão inicial de papéis

| Papel | `settings.messages.view` | `settings.messages.manage` |
|---|---:|---:|
| owner | true | true |
| admin | true | true |
| manager | true | true |
| sales | true | false |
| viewer | true | false |
| cashier | false | false |
| stock_operator | false | false |
| staff | false | false |

A migration também atualiza `store_permission_versions` para acionar o refresh realtime de permissões.

### Frontend de permissões

Para a permissão aparecer corretamente na matriz, foram necessários estes pontos:

- catálogo correto em `store_permission_catalog`;
- templates em `store_role_permission_templates`;
- versionamento em `store_permission_versions`;
- prefixo correto em `PERMISSION_GROUP_DEFINITIONS`;
- inclusão explícita em `ROLE_PERMISSION_TREE`;
- ordenação visual revisada manualmente.

O aprendizado foi consolidado em:

- `docs/CHECKLIST_NOVAS_PERMISSOES.md`

### Compatibilidade removida

Após validação da migration e da matriz, `MessageSettings.tsx` passou a usar somente:

- `settings.messages.manage`

A compatibilidade temporária com `messages.manage` foi removida. O padrão antigo `messages.view/manage` fica reservado para Central de Mensagens/Marketing, se necessário em módulo futuro.

---

## Fora do escopo inicial

Não entra nesta etapa:

- disparo em massa;
- campanhas;
- segmentação;
- aniversariantes automatizados;
- cupons promocionais;
- recuperação de cliente;
- status entregue/lido;
- integração oficial WhatsApp API;
- mascote/personagem;
- geração de imagem;
- tom de voz avançado;
- IA escrevendo mensagens sem revisão humana.

---

## Mascote e identidade de comunicação

Mascote da Loja é uma boa ideia para o futuro do OptmaMenu, mas não deve ser misturado nesta etapa.

Direção futura:

- módulo de Identidade de Comunicação;
- mascote visual/branding;
- tom de voz sugerido;
- frases de apoio;
- uso moderado em mensagens;
- sempre com revisão humana.

Riscos do mascote:

- linguagem infantilizada em contexto sério;
- exagero emocional;
- tom invasivo;
- promessa inadequada;
- confusão entre atendimento operacional e publicidade.

---

## Validação funcional

Critérios validados na frente:

- build limpo;
- console limpo;
- aba interna `/admin/settings?tab=messages` integrada ao componente real;
- owner/admin/manager autorizado edita e salva;
- JSONB preserva outras chaves de `stores.config`;
- persistência após reload validada;
- prévia renderiza variáveis;
- restaurar padrão funciona;
- permissões aparecem no grupo Configurações da matriz;
- `ROLE_PERMISSION_TREE` atualizado para Mensagens;
- `settings.messages.view/manage` usado como padrão final.

---

## Pendências fora desta frente

As pendências abaixo foram identificadas durante os testes, mas pertencem a uma próxima rodada de Segurança/Funções personalizadas:

- revisar realtime/listener para refletir alterações de permissões entre usuários sem reload em todos os fluxos;
- revisar exibição de nome de colaborador quando cai para e-mail, exemplo Henrique/Rick em Permissões por usuário;
- revisar atribuição/revogação de permissões em funções personalizadas, especialmente quando a função personalizada herda de um papel base;
- validar salvamento e aplicação de overrides em `store_custom_roles.permissions`;
- validar se alterações em funções personalizadas atualizam `store_permission_versions` e disparam refresh nos usuários afetados.

---

## Decisão de produto

A 9.13.1I reforça o diferencial do OptmaMenu:

> ajudar o pequeno lojista a entrar no mundo digital com atendimento acolhedor, claro, responsável e acessível, sem transformar comunicação em spam.

---

## Resultado

A frente 9.13.1I fica encerrada como:

**Configurações de Mensagens e Atendimento concluídas funcionalmente, com persistência validada, permissões dedicadas, integração na matriz de permissões e documentação do checklist para novas permissões.**
