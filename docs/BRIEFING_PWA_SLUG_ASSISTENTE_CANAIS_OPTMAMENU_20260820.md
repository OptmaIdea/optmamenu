# Briefing — PWA por slug, atendente virtual e canais — OptmaMenu

**Data-base:** 20/08/2026  
**Status:** briefing arquitetural; não representa entrega implementada.

---

## 1. Visão de produto

Um dos diferenciais do OptmaMenu será permitir que o lojista tenha algo próximo de **seu próprio site/loja virtual**, sem exigir desenvolvimento nativo dedicado.

A identidade pública pertence à loja:

- nome;
- logo;
- cores;
- catálogo;
- redes sociais;
- forma de atendimento;
- políticas;
- futuramente domínio próprio.

O OptmaMenu fornece a infraestrutura, mas a experiência pública deve parecer prioritariamente a experiência da loja contratante.

---

## 2. Arquitetura de PWA em dois níveis

### 2.1 Shell administrativo OptmaMenu

PWA para proprietário/funcionários:

- administração;
- PDV;
- estoque;
- pedidos;
- financeiro;
- alertas operacionais;
- operação com conectividade degradada em escopo controlado.

Identidade: OptmaMenu.

### 2.2 PWA público por slug

PWA instalável por loja pública:

- nome da loja;
- ícone/logo pública própria;
- theme color própria;
- catálogo;
- carrinho;
- pedidos;
- conta do cliente;
- fidelidade;
- notificações;
- atendimento.

A mesma empresa pode ter mais de uma unidade/slug com identidade pública diferente.

---

## 3. URL pública sem domínio próprio

Enquanto domínio customizado não estiver disponível, o endereço hospedado deve ser curto, memorável e visualmente tratado como parte da marca.

Direção proposta:

```text
https://<host-optmamenu>/s/<slug>
```

Na UI, preferir exibir algo como:

```text
Sua loja: <host>/s/minhaloja
```

com botão copiar/QR code e preview da identidade.

Quando os domínios institucionais futuros forem adquiridos/configurados, a escolha do host canônico deve considerar SEO, redirecionamentos e estabilidade. Este briefing não presume que nenhum domínio já esteja registrado.

### Campo de domínio customizado nesta rodada

Pode existir no painel como **campo morto/desabilitado**, por exemplo:

```text
Domínio próprio
minhaloja.com.br
Recurso em preparação
```

Sem salvar DNS, emitir certificado ou prometer provisionamento antes da fase própria.

---

## 4. Manifest e identidade dinâmica

Objetivo técnico:

- manifest administracional fixo do OptmaMenu;
- manifest público gerado/servido conforme slug;
- `name`, `short_name`, icons, theme/background color oriundos da configuração pública da loja;
- ícones validados e redimensionados em pipeline próprio;
- fallback OptmaMenu somente quando a loja não tiver asset válido.

### Ponto de atenção

Browsers fazem cache agressivo de manifest/service worker. Mudanças de logo/nome precisam de versionamento e estratégia de atualização para não deixar PWA antigo preso no dispositivo.

---

## 5. Offline e PWA administrativo

A decisão de produto é suportar conexão instável inclusive em PDV/estoque.

### Camadas propostas

1. **App shell** cacheado: UI, fontes/assets essenciais e rota base.
2. **Snapshot local** em IndexedDB: catálogo operacional mínimo, produtos, regras e saldos vistos por último.
3. **Fila local de comandos**: toda mutação offline recebe `client_operation_id` único.
4. **Pending sync explícito**: operação local nunca se apresenta como confirmada pelo servidor antes do ACK.
5. **Sincronização idempotente**: retry seguro após reconexão.
6. **Resolução de conflito**: estoque/preço alterado remotamente precisa de tela/ocorrência operacional quando não for possível aplicar automaticamente.

### Limites honestos

Sem coordenador local, dois terminais simultaneamente offline não conseguem garantir estoque global forte.

Assim:

- PDV offline registra intenção/venda pendente e sincroniza;
- saldo visto offline é snapshot;
- transferência, fechamento e ajuste crítico ficam pendentes até servidor confirmar;
- loja pública/checkout não conclui pedido novo offline porque preço/estoque precisam de validação autoritativa;
- futura appliance/hub local pode melhorar este cenário em lojas de internet instável.

---

## 6. Atendente virtual por loja

### Objetivo

Substituir FAQ exaustiva por atendimento conversacional opcional, sem abrir mão de veracidade.

O assistente deve conhecer somente conteúdo autorizado e consultar dados dinâmicos por ferramentas/API.

### Fontes autorizadas possíveis

- apresentação da empresa;
- endereços e horários;
- canais de contato;
- formas de pagamento;
- formas de entrega/retirada;
- políticas da loja;
- termos públicos;
- catálogo;
- descrição de produtos;
- ingredientes cadastrados;
- alergênicos cadastrados;
- disponibilidade atual consultada no backend;
- promoções vigentes consultadas no backend;
- FAQ/documentos internos expressamente publicados para o assistente.

### Regras obrigatórias

- não inventar informação ausente;
- não inferir alergênico se não estiver cadastrado;
- preço e estoque sempre via contrato autoritativo atual;
- status de pedido somente após autenticação/token compatível;
- nunca acessar diretamente tabelas sem boundary de autorização;
- nunca revelar dados de outro cliente/loja;
- declarar quando não souber;
- oferecer atendimento humano.

### Ferramentas sugeridas do agente

- `get_store_public_info(slug)`;
- `search_public_catalog(slug, query)`;
- `get_public_product_details(slug, product_id)`;
- `get_public_price_quote(slug, items)`;
- `get_public_delivery_options(slug)`;
- `get_public_order_status(token)`;
- `handoff_to_store(slug, channel)`.

O agente não deve ter uma ferramenta genérica `execute_sql` ou acesso amplo ao banco.

---

## 7. Escalonamento humano

O atendimento virtual precisa terminar bem quando não resolver.

Possibilidades por loja/configuração:

- abrir conversa WhatsApp;
- registrar pedido de contato;
- e-mail;
- chat interno futuro;
- SMS apenas para casos definidos;
- canal futuro Telegram/outro.

Registrar motivo do handoff ajuda a construir base do futuro Consultor de Marketing/Atendimento.

---

## 8. Central de preferências e consentimentos

Separar autorização por finalidade e canal.

### Canais

- SMS;
- WhatsApp;
- push/web push;
- e-mail;
- Telegram/outro futuro.

### Finalidades

- operacional/transacional;
- marketing/promocional.

Exemplo: cliente pode aceitar atualização de pedido por SMS e recusar marketing por SMS.

### Registro mínimo

- customer/store;
- canal;
- finalidade;
- granted/revoked;
- timestamp;
- versão dos termos/política quando aplicável;
- origem da alteração;
- evidência/auditoria.

---

## 9. SMS e OptmaSMSGate

OptmaSMSGate será o primeiro canal OTP real.

Casos iniciais:

- OTP de cliente;
- validação de celular de usuário interno;
- recuperação/step-up quando definido.

Casos posteriores:

- alertas operacionais ao cliente;
- campanhas somente com consentimento;
- fallback controlado quando canal principal não estiver disponível.

O OptmaMenu deve consumir uma API estável do OptmaSMSGate, sem conhecer filas/dispositivos internos do gateway.

---

## 10. WhatsApp

Enquanto não houver API oficial plenamente integrada:

- abrir conversa/mensagem pronta é permitido;
- confirmação de `enviado` pode ser ação manual do lojista;
- não afirmar `entregue`/`lido` sem dado real do provedor;
- automações futuras devem passar por consentimento e limites da plataforma.

---

## 11. Push/Web Push

Prioridades:

### Lojista

- novo pedido;
- pedido aguardando ação;
- estoque crítico quando configurado;
- ocorrência financeira/operacional importante.

### Cliente

- mudança de status de pedido;
- aviso operacional opt-in;
- marketing somente com consentimento separado.

A permissão do navegador só deve ser solicitada em contexto compreensível, não no primeiro carregamento sem explicação.

---

## 12. Modo operador / TV de pedidos

Parceiros podem manter telefone, tablet ou TV dedicada.

Criar conceito de rota/mode:

```text
/admin/order-monitor
```

Objetivos:

- lista grande e legível;
- alto contraste;
- atualização realtime/reconexão;
- som configurável;
- aviso visual persistente;
- reconhecimento do pedido;
- relógio/tempo de espera;
- sem informações administrativas desnecessárias;
- opção fullscreen.

Para TV, autenticação/sessão deve ter política própria; não deixar painel público com dados de cliente.

---

## 13. Templates públicos futuros

Fase posterior:

- biblioteca de templates;
- customização avançada;
- serviço pago de criação de template;
- domínio próprio;
- SEO avançado;
- páginas institucionais extras.

A arquitetura atual deve evitar hardcode da Gelinhares para que novos temas não exijam fork do frontend.

---

## 14. SEO e posicionamento

Preparar sem depender de domínio ainda:

- title/description por loja;
- Open Graph por slug;
- canonical correta;
- sitemap/robots conforme publicação;
- dados estruturados quando houver informações reais suficientes;
- evitar indexar checkout/tracking/área privada;
- URLs públicas estáveis.

---

## 15. Sequência de implementação recomendada

1. homologar contratos atuais da slug/carrinho;
2. separar identidade empresa × slug;
3. consolidar customer auth + OTP;
4. criar central de consentimentos;
5. criar PWA shell admin;
6. criar manifest/PWA por slug;
7. implementar push operacional de pedidos;
8. implementar modo operador/TV;
9. criar offline admin/PDV incremental;
10. somente então adicionar assistente virtual, usando contratos já estabilizados.

Assim, a IA não vira uma camada bonita em cima de dados ainda instáveis.
