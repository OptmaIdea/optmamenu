# Roadmap — Mensagens, Engajamento e Atendente Virtual OptmaMenu

## Status

**Brainstorm estratégico e guia crítico inicial.**

Este documento define uma visão gradual para transformar o OptmaMenu em uma solução de atendimento digital, mensagens, engajamento e automação acessível ao pequeno lojista.

A proposta nasce de uma premissa central:

> O OptmaMenu deve ajudar o pequeno lojista a entrar no mundo digital com atendimento acolhedor, responsável e mensurável, começando pelo simples e evoluindo para automação inteligente conforme a loja amadurece.

---

## Por que este módulo é importante

Para muitos pequenos lojistas, especialmente em cidades pequenas, bairros e regiões do interior, atendimento digital ainda parece algo distante, caro ou reservado a empresas grandes.

O OptmaMenu pode mudar essa percepção ao oferecer um caminho gradual:

1. Configurar mensagens simples.
2. Atender melhor pelo WhatsApp.
3. Registrar contatos e pedidos.
4. Entender o que gera retorno.
5. Automatizar pequenas etapas.
6. Evoluir para integração oficial.
7. Criar um atendente virtual com inteligência.

O objetivo não é substituir o lojista, mas dar a ele uma ferramenta que aumente sua presença, organização e qualidade de atendimento.

---

## Visão de produto

O módulo de mensagens deve evoluir em camadas:

| Fase | Nome | Objetivo |
|---|---|---|
| 1 | Configurações de Mensagens | Permitir textos operacionais seguros e acolhedores |
| 2 | Envio assistido via WhatsApp | Abrir mensagens prontas para envio manual pelo lojista |
| 3 | Registro e histórico | Guardar o que foi preparado/enviado/confirmado manualmente |
| 4 | Dashboard de mensagens | Medir retorno, uso, categorias e impacto no pedido |
| 5 | Automação via n8n | Automatizar fluxos simples com controle e baixo custo |
| 6 | Integração oficial | Evoluir para WhatsApp Business Platform/API quando houver maturidade |
| 7 | Atendente virtual inteligente | Criar atendimento assistido por IA, com limites, contexto e auditoria |

---

## Princípio de escala gradual

O pequeno lojista não deve ser obrigado a começar pelo mais complexo.

A jornada recomendada é:

### Nível 1 — Manual bem orientado

- Textos padrão.
- WhatsApp aberto manualmente.
- Sem automação de disparo.
- Sem métricas sofisticadas.
- Foco em clareza, educação e consistência.

### Nível 2 — Assistido

- Sistema monta a mensagem.
- Lojista revisa antes de enviar.
- Sistema registra que a mensagem foi preparada.
- Lojista marca manualmente como enviada, respondida ou sem resposta.

### Nível 3 — Mensurável

- Dashboard mostra volume de mensagens.
- Mensagens por tipo.
- Pedidos gerados após contato.
- Clientes recorrentes.
- Modelos com melhor retorno.
- Horários com melhor resposta.

### Nível 4 — Automatizado com n8n

- Automação de baixa complexidade.
- Fluxos controlados.
- Gatilhos explícitos.
- Logs de execução.
- Pausa manual.
- Aprovação do owner para mensagens sensíveis.

### Nível 5 — Profissional e oficial

- Integração WhatsApp Business Platform/API.
- Webhooks.
- Templates oficiais.
- Métricas de entrega/lido quando disponíveis.
- Atendimento multiagente.
- Controle de custos por conversa/template.
- Políticas de consentimento e opt-out.

### Nível 6 — Atendente virtual inteligente

- IA com contexto da loja.
- Respostas baseadas no cardápio, horários, estoque, entrega e políticas.
- Limites de segurança.
- Escalonamento para humano.
- Auditoria.
- Treinamento por base de conhecimento aprovada pelo owner.

---

## Configurações de Mensagens — escopo inicial

A primeira entrega deve ficar em:

```txt
/admin/settings?tab=messages
```

### Deve incluir

- Mensagem inicial do WhatsApp.
- Pedido recebido.
- Pedido aceito.
- Pedido em preparo.
- Pedido pronto para retirada.
- Pedido saiu para entrega.
- Pedido concluído.
- Pedido cancelado.
- Instruções de pagamento.
- Instruções de retirada.
- Instruções de entrega.
- Agradecimento pós-compra.
- Pedido de avaliação.
- Mensagem sobre fidelidade/pontos.

### Deve separar

| Tipo | Exemplo | Risco |
|---|---|---|
| Operacional | "Seu pedido foi recebido." | Baixo a médio |
| Relacionamento | "Obrigado pela preferência." | Médio |
| Avaliação | "Pode nos avaliar?" | Médio |
| Fidelidade | "Você possui pontos disponíveis." | Médio |
| Marketing | "Promoção hoje!" | Alto |

Mensagens promocionais devem ser tratadas com cuidado e preferencialmente ficar em **Central de Marketing**, não misturadas com mensagens operacionais.

---

## Regras de governança

Mensagens são uma área sensível.

### Owner como responsável principal

O poder de configurar mensagens deve ser prioritariamente do owner.

Permissões sugeridas:

- `settings.messages.view`
- `settings.messages.manage`

Padrão recomendado:

| Papel | Visualizar | Gerenciar |
|---|---:|---:|
| owner | Sim | Sim |
| admin | Sim | Sim |
| manager | Sim | Sim, conforme loja |
| stock_operator | Não | Não |
| cashier | Não | Não |
| sales | Sim, opcional | Não por padrão |
| staff | Não | Não |
| viewer | Não | Não |

### Por que restringir

Uma mensagem mal criada pode gerar:

- reclamação do cliente;
- sensação de invasão;
- bloqueio no WhatsApp;
- conflito com promoção indevida;
- descumprimento de oferta;
- risco reputacional;
- risco jurídico ou LGPD.

---

## Boas práticas para mensagens

### Mensagem boa deve ser

- curta;
- clara;
- educada;
- útil;
- contextual;
- revisável;
- sem excesso de emojis;
- sem pressão indevida;
- sem prometer o que a loja não controla.

### Evitar

- CAPS LOCK;
- muitos emojis;
- frases invasivas;
- insistência excessiva;
- promoções para quem não aceitou receber;
- linguagem infantilizada em contextos sérios;
- promessas absolutas de prazo;
- exposição de dados pessoais;
- mensagens automáticas sem opção de parar.

### Exemplo ruim

```txt
🔥🔥🔥 COMPRA AGORA!!! VOCÊ NÃO PODE PERDER!!! RESPONDA RÁPIDO!!! 🔥🔥🔥
```

### Exemplo melhor

```txt
Olá, {cliente_nome}! Tudo bem?
Seu pedido {pedido_codigo} foi recebido pela {loja_nome}.
Vamos confirmar os itens e já te retornamos por aqui. Obrigado pela preferência! 😊
```

---

## Emojis e linguagem visual

O sistema pode permitir emojis, mas deve orientar uso moderado.

### Recomendação

- Permitir emojis em mensagens.
- Mostrar aviso de boas práticas.
- Ter modelos padrão com poucos emojis.
- Evitar emojis em excesso em mensagens de cancelamento, problema ou cobrança.
- Permitir prévia antes de salvar.

### Exemplos bons

- 😊 para acolhimento.
- ✅ para confirmação.
- 🛵 para entrega.
- 🛍️ para retirada.
- ⭐ para avaliação.

### Exemplos a evitar

- Muitos emojis repetidos.
- Emojis com duplo sentido.
- Emojis que pareçam agressivos ou irônicos.
- Tom festivo em mensagem de erro/cancelamento.

---

## Mascote e identidade de comunicação

A ideia de mascote é promissora, mas deve ser tratada como módulo próprio, não misturada à primeira tela de mensagens.

### Módulo futuro sugerido

**Mascote e Voz da Loja**

Funções possíveis:

- definir nome do mascote;
- definir estilo visual;
- definir tom de voz;
- sugerir frases de atendimento;
- aparecer em banners, mensagens e loja pública;
- orientar se a loja fala de forma divertida, elegante, familiar ou objetiva.

### Riscos

- linguagem infantilizada demais;
- mascote incompatível com o público;
- uso inadequado em mensagens sensíveis;
- exagero visual;
- confundir atendimento operacional com brincadeira;
- criar expectativa que a loja não consegue cumprir.

### Recomendação

Na etapa inicial, permitir apenas:

- emojis;
- mensagens prontas;
- tom de voz simples.

Deixar mascote para fase própria.

---

## Dashboard de mensagens e engajamento

Este deve ser um diferencial forte do OptmaMenu.

Mesmo antes da integração oficial, o sistema pode criar métricas próprias com base em eventos internos.

### Nome sugerido do módulo

- Painel de Engajamento
- Dashboard de Atendimento
- Inteligência de Atendimento
- Central de Relacionamento
- Radar de Mensagens
- Análise de Atendimento

Recomendação de nome inicial:

**Painel de Engajamento**

Porque comunica resultado, relacionamento e retorno sem ficar restrito a mensagens.

### Métricas possíveis no início

- mensagens preparadas;
- mensagens marcadas como enviadas;
- respostas manuais registradas;
- pedidos gerados após mensagem;
- clientes recorrentes após contato;
- modelos mais usados;
- mensagens com melhor conversão;
- tempo médio entre pedido e resposta;
- mensagens por canal;
- campanhas manuais com retorno;
- clientes sem resposta;
- pedidos abandonados recuperados.

### Métricas futuras com integração oficial

- entregue;
- lido;
- respondido;
- falha de envio;
- custo por conversa;
- categoria do template;
- janela de atendimento;
- origem do cliente;
- desempenho por automação.

---

## Automação via n8n

O n8n pode ser a primeira tecnologia de automação por ser flexível, visual e acessível.

### Usos iniciais

- notificar lojista sobre pedido novo;
- registrar evento em planilha/log externo;
- enviar alerta interno;
- disparar mensagem assistida após aprovação;
- atualizar status no OptmaMenu;
- criar rotinas simples de pós-venda;
- integrar com Telegram, e-mail ou webhooks.

### Cuidados

- não automatizar marketing sem consentimento;
- não enviar mensagem sensível sem revisão;
- manter logs;
- permitir pausa/desligamento;
- limitar frequência;
- separar fluxo operacional de promocional;
- registrar owner/responsável pela ativação.

### Alternativas futuras

- filas próprias com workers;
- Supabase Edge Functions;
- servidor Node dedicado;
- filas Redis/BullMQ;
- webhooks oficiais WhatsApp;
- integrações com provedores BSP;
- orquestração própria de agentes.

---

## Atendente virtual inteligente

O objetivo final não é um bot genérico. É um atendente virtual com contexto real da loja.

### O atendente deve saber

- nome da loja;
- horários;
- produtos;
- categorias;
- disponibilidade;
- formas de entrega;
- retirada;
- pedido mínimo;
- promoções autorizadas;
- políticas da loja;
- status do pedido;
- limites de atendimento;
- quando chamar um humano.

### O atendente não deve

- inventar preço;
- prometer entrega sem regra;
- confirmar pagamento sem validação;
- falar sobre dados sensíveis sem autorização;
- discutir assuntos fora da loja;
- oferecer desconto não configurado;
- insistir em venda;
- enviar marketing sem consentimento.

### Mecanismos de segurança

- base de conhecimento aprovada pelo owner;
- respostas com variáveis controladas;
- logs de conversas;
- modo revisão antes do envio;
- limites de assunto;
- escalonamento para humano;
- bloqueio para mensagens sensíveis;
- trilha de auditoria;
- permissões específicas;
- testes antes de ativar.

---

## Caminho recomendado para pequeno comerciante de verba reduzida

### Etapa 1 — Presença digital mínima

- Cadastrar produtos.
- Ativar loja pública.
- Configurar WhatsApp.
- Configurar pedido mínimo.
- Criar mensagens operacionais simples.

### Etapa 2 — Atendimento organizado

- Usar mensagens padrão.
- Confirmar pedidos manualmente.
- Registrar status.
- Agradecer após venda.
- Solicitar avaliação com cuidado.

### Etapa 3 — Relacionamento

- Identificar clientes recorrentes.
- Usar fidelidade.
- Criar mensagens de pontos.
- Separar clientes que aceitaram contato.

### Etapa 4 — Análise

- Ver quais mensagens geram pedidos.
- Ver horários melhores.
- Ver produtos mais buscados.
- Ver clientes que voltam.

### Etapa 5 — Automação controlada

- Criar fluxos n8n simples.
- Automatizar alertas internos.
- Automatizar lembretes operacionais.
- Manter aprovação humana para mensagens ao cliente.

### Etapa 6 — Profissionalização

- Integrar WhatsApp oficial.
- Usar templates aprovados.
- Medir entrega/lido.
- Criar atendente virtual com IA.
- Conectar dashboard, CRM e pedidos.

---

## Critérios de aceite para a primeira etapa

A etapa **Configurações de Mensagens** só deve ser considerada concluída quando:

- existir aba `/admin/settings?tab=messages`;
- existir `settings.messages.view/manage` se necessário;
- `view=false` ocultar a aba;
- `manage=false` deixar a tela em leitura;
- modelos padrão forem carregados;
- mensagens puderem ser editadas e salvas;
- houver prévia com variáveis;
- houver aviso de responsabilidade;
- houver separação entre operacional e marketing;
- houver documentação em `docs/FASE_9_13_1I_MENSAGENS_ATENDIMENTO.md`;
- build e console estiverem limpos.

---

## Documentação futura obrigatória

Criar:

- `docs/FASE_9_13_1I_MENSAGENS_ATENDIMENTO.md`
- `docs/GUIA_MENSAGENS_ATENDIMENTO.md`
- `docs/ROADMAP_ATENDENTE_VIRTUAL_MENSAGENS_ENGAJAMENTO.md`

Este documento já cumpre o papel de roadmap inicial e deve ser evoluído conforme as fases forem implementadas.

---

## Resultado esperado

O OptmaMenu deve se tornar uma solução de engajamento progressiva:

- simples no começo;
- acessível para pequenos lojistas;
- segura em mensagens e dados;
- mensurável por dashboard próprio;
- automatizável com n8n ou stack futura;
- preparada para WhatsApp oficial;
- capaz de evoluir para um atendente virtual inteligente.

O diferencial não é apenas vender online. É ajudar o lojista a atender melhor, parecer mais profissional, entender seus clientes e criar motivos reais para o cliente voltar.
