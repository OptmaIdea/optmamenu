# Fase 9.13.1I — Configurações de Mensagens e Atendimento

## Status

**Em execução.**

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

A interface deve incentivar o lojista a:

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

A interface não deve prometer automação, entrega garantida ou leitura automática.

---

## Escopo inicial implementado

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
- persistência em JSONB.

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

Nesta etapa não foram criadas tabelas ou RPCs novas.

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

### Compatibilidade temporária

A tela `MessageSettings.tsx` ainda reconhece temporariamente:

- `messages.manage`

Isso mantém compatibilidade com ambientes que ainda não aplicaram a migration. Após validação completa da migration e do frontend, a aba de Configurações deve usar prioritariamente:

- `settings.messages.view`
- `settings.messages.manage`

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

## Critérios de aceite

Para fechar funcionalmente a 9.13.1I:

- build limpo;
- console limpo;
- tela acessível pela rota direta `/admin/messages`;
- aba interna `/admin/settings?tab=messages` integrada ao componente real;
- `settings.messages.view=false` oculta aba/rota;
- `settings.messages.view=true` + `settings.messages.manage=false` exibe leitura, campos desabilitados e ações ocultas;
- owner/admin/manager autorizado edita e salva;
- JSONB preserva outras chaves de `stores.config`;
- prévia renderiza variáveis;
- restaurar padrão funciona;
- permissões aparecem no grupo Configurações da matriz;
- snapshot Supabase atualizado após aplicar a migration.

---

## Pendências atuais

- Aplicar a migration `20260625133000_add_settings_messages_permissions.sql` no Supabase.
- Ajustar `StoreSettings.tsx` para a aba `messages` usar `settings.messages.view/manage` no lugar de `messages.view/manage`.
- Validar build local.
- Validar matriz em `/admin/security?tab=roles`.
- Atualizar snapshot Supabase após aplicar a migration.

---

## Decisão de produto

A 9.13.1I deve reforçar o diferencial do OptmaMenu:

> ajudar o pequeno lojista a entrar no mundo digital com atendimento acolhedor, claro, responsável e acessível, sem transformar comunicação em spam.
