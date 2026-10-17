# Especificação Técnica da Fase 10 — Loja Pública, Microsite Comercial e Experiência do Cliente

> **Versão oficial:** `0.10.0-rc.1`  
> **Status:** Fase 10.1A — blueprint aprovado para implementação controlada  
> **Última validação:** 30/07/2026  
> **Branch de trabalho:** `agent/fase-10-loja-publica-blueprint`  
> **Fonte principal:** handoff homologado e auditoria direta do código/migrations da `main`

---

## 1. Objetivo e limites

A Fase 10 transforma a slug pública em um microsite comercial mobile-first, preservando a loja existente e evoluindo por feature flags. O objetivo é melhorar descoberta, carrinho, checkout, entrega, identidade visual e rastreamento sem comprometer estoque, preços, segurança ou operação presencial.

Nesta fase:

- a loja atual permanece como fallback;
- não haverá refatoração big bang;
- preço, estoque, entrega e pedido serão revalidados no backend;
- WhatsApp será canal complementar, não substituto do checkout;
- a demonstração de `01/08/2026` representa piloto/blueprint no domínio oficial, não lançamento estável `1.0.0`;
- autenticação OTP permanece dependente do OptmaSMSGate e não bloqueia a fundação.

---

## 2. Estado atual auditado

### 2.1 Rotas públicas existentes

| Rota | Contexto | Situação |
|---|---|---|
| `/s/:storeSlug` | loja remota | existente |
| `/loja/:storeSlug` | loja remota | existente |
| `/cardapio/:storeSlug` | alias legado | existente |
| `/q/:storeSlug/:tableCode` | mesa/QR | existente |
| `/mesa/:storeSlug/:tableCode` | mesa/QR | existente |
| `/checkout` | checkout público | existente |
| `/p/:publicOrderToken` | rastreamento | existente |

As rotas usam o mesmo `Catalog`, diferenciando mesa pela presença de `tableCode`. A Fase 10 separará os contratos de experiência remota e mesa, ainda que componentes visuais sejam compartilhados.

### 2.2 Serviços e RPCs existentes

- `PublicStorefrontService`
  - `get_public_storefront_by_slug`
  - `get_public_catalog_by_slug`
  - `get_public_sales_channels_by_slug`
  - `get_public_payment_methods_by_slug`
  - `get_public_delivery_methods_by_slug`
- `PublicOrderService`
  - `quote_public_order_by_slug`
  - `create_public_order_by_slug_v2`
  - `get_public_order_by_token`
- motor autoritativo de preço:
  - `calculate_store_cart_pricing`
- reservas e expiração:
  - `stock_reservations`
  - `cancel_expired_reservations`

### 2.3 Lacunas confirmadas

- carrinho persistido não está isolado por loja;
- modalidade de entrega/retirada não persiste após reload;
- checkout atual força `pickup`, mesmo após selecionar entrega;
- checkout de entrega não coleta endereço;
- aviso global de pedido mínimo não representa regras por região/modalidade;
- mesa aparece misturada à experiência remota;
- drawer de carrinho interrompe a compra ao ocupar grande parte da tela;
- logo é exposta pela RPC e serviço, mas não é aplicada corretamente no cabeçalho;
- WhatsApp flutuante do layout contém fallback fixo;
- `stock_quantity` não representa disponibilidade online com reserva mínima e limite;
- existem dois caminhos históricos de finalização (`CartDrawer` e `/checkout`);
- o mecanismo automático que executa a limpeza de reservas ainda precisa ser confirmado.

---

## 3. Decisões de experiência

### 3.1 Contextos separados

**Slug comum** (`/s`, `/loja`, `/cardapio`):

- entrega;
- retirada;
- sem mesa/comanda.

**QR/mesa** (`/q`, `/mesa`):

- contexto de mesa/comanda;
- sem entrega;
- sem retirada na experiência inicial.

### 3.2 Card e configurador de produto

Clicar no card ou no botão `+` abre o modal/configurador. O botão `+` significa **configurar e adicionar**, não adição imediata.

O configurador deve:

- mostrar foto, descrição e preço-base;
- permitir incrementar/decrementar quantidade;
- calcular preço projetado considerando o carrinho inteiro;
- considerar produtos da mesma categoria e do mesmo grupo de precificação;
- mostrar preço aplicado, economia, faixa atingida e, quando disponível, próxima faixa;
- preparar complementos, adicionais e observações futuras;
- confirmar por botão como `Adicionar 5 ao carrinho • R$ 16,25`.

Após adicionar:

- o modal fecha;
- aparece confirmação breve e não bloqueante;
- o catálogo continua visível;
- a barra inferior do carrinho é atualizada;
- nenhum drawer grande abre automaticamente.

### 3.3 Carrinho

No mobile, o carrinho será representado por barra discreta:

```text
3 itens • R$ 26,00              Ver carrinho
```

O carrinho completo abre somente por ação do usuário. Ele permite revisar itens, quantidades, descontos, modalidade, observações e seguir ao checkout.

### 3.4 Checkout

Fluxo máximo de três etapas:

1. Como receber;
2. Seus dados;
3. Revisar e finalizar.

WhatsApp só abre após o pedido estar criado e validado, contendo resumo e link de rastreamento.

---

## 4. Contrato do carrinho V2

```ts
export type PublicStoreContextType = 'remote' | 'table';
export type PublicFulfillment = 'pickup' | 'delivery' | 'table';

export interface PublicCartStateV2 {
  schemaVersion: 2;
  context: {
    type: PublicStoreContextType;
    tableCode?: string;
  };
  store: {
    id: string;
    slug: string;
    canonicalSlug: string;
  };
  items: PublicCartItemV2[];
  fulfillment: {
    type: PublicFulfillment;
    deliveryMethodCode?: string;
  };
  delivery?: {
    address?: DeliveryAddress;
    location?: DeliveryLocation;
    quote?: DeliveryQuote;
  };
  customer?: {
    type: 'guest' | 'registered';
    name?: string;
    phone?: string;
    customerId?: string;
  };
  attribution?: {
    source?: string;
    campaignId?: string;
    bannerId?: string;
    qrCode?: string;
  };
  notes?: string;
  updatedAt: string;
}
```

Regras obrigatórias:

- carrinho isolado por loja e contexto;
- troca de loja exige confirmação para limpar o carrinho anterior;
- contexto de mesa não pode virar entrega;
- alteração de item/endereço invalida cotações aplicáveis;
- persistência versionada para migração do `localStorage` legado;
- cotação autoritativa antes da criação do pedido.

---

## 5. Preço e desconto

O backend continua sendo autoridade. O frontend pode calcular uma prévia imediata, mas deve confirmar com `quote_public_order_by_slug`.

A cotação considera:

- quantidade já existente do produto;
- produtos da mesma categoria;
- produtos do mesmo grupo de precificação;
- precedência produto → grupo → categoria → preço-base;
- snapshots de preço, regra, faixa e quantidade.

O configurador projeta o carrinho completo antes da adição. Quando uma nova quantidade altera a faixa do grupo/categoria, todos os itens afetados devem ser atualizados.

O backend atual retorna a faixa aplicada. A próxima faixa deverá ser exposta explicitamente ou calculada a partir das faixas públicas carregadas.

---

## 6. Entrega, retirada e pedido mínimo

### 6.1 Regra de comunicação

Remover aviso global absoluto como `Pedido mínimo: R$ 20,00`.

Usar comunicação geral:

```text
Entrega sujeita à área atendida, taxas e condições.
Conheça nossas regras.
```

Cada modalidade/regra informa suas próprias condições.

### 6.2 Retirada

- sem taxa;
- sem pedido mínimo por padrão;
- instruções configuráveis;
- backend valida a configuração efetiva.

### 6.3 Entrega

- endereço textual obrigatório;
- CEP opcional como assistente de preenchimento;
- localização opcional e complementar;
- regras variáveis por região, bairro, CEP, raio ou cálculo futuro por rota;
- taxa, mínimo, gratuidade e estimativa pertencem à regra aplicável.

```ts
export interface DeliveryAddress {
  postalCode?: string;
  street: string;
  number: string;
  complement?: string;
  district: string;
  city: string;
  state: string;
  reference?: string;
}

export interface DeliveryLocation {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  source: 'device' | 'map_pin';
  capturedAt: string;
}
```

A localização não substitui o endereço, pois o comprador pode solicitar entrega em ponto diferente de sua posição atual.

### 6.4 Cotação de entrega

```ts
export interface DeliveryQuote {
  id: string;
  ruleId?: string;
  methodCode: string;
  coverageType: 'all' | 'district' | 'postal_code' | 'radius' | 'polygon' | 'manual';
  pricingType: 'free' | 'fixed' | 'distance' | 'manual';
  subtotal: number;
  fee: number;
  minimumOrder: number;
  freeAbove?: number;
  eligible: boolean;
  reason?: string;
  estimateMinMinutes?: number;
  estimateMaxMinutes?: number;
  expiresAt: string;
}
```

Base recomendada para pedido mínimo: subtotal comercial dos produtos após precificação autoritativa e antes do frete.

---

## 7. Estoque online

### 7.1 Fórmulas

```text
saldo_fisico_disponivel = on_hand - reserved

disponivel_online =
min(
  max(0, saldo_fisico_disponivel - reserva_minima_local),
  limite_maximo_online
)
```

`limite_maximo_online` pode ser nulo, significando ausência de teto adicional.

### 7.2 Administração

**Configurações → Pedido Online → Estoque online**

- local de venda padrão;
- reserva mínima padrão;
- limite máximo online;
- limiar de baixa disponibilidade;
- modo de exibição;
- comportamento seguro em falha.

**Estoque → Disponibilidade online**

- saldo físico;
- reservado;
- reserva local;
- limite online;
- disponível online;
- status público;
- edição em lote.

**Produto → Estoque e disponibilidade → Venda online**

- herdar padrão;
- habilitar/desabilitar online;
- local de origem;
- reserva mínima própria;
- limite próprio;
- modo de exibição.

### 7.3 Contrato público

```ts
export interface PublicAvailability {
  status: 'available' | 'low_stock' | 'unavailable' | 'unknown';
  availableOnline?: number;
  displayMode: 'exact' | 'low_stock_only' | 'status_only' | 'hidden';
  message?: string;
}
```

O catálogo não recebe o saldo físico bruto como autoridade.

---

## 8. Reserva e criação do pedido

O modelo existente vincula `stock_reservations` a um pedido já criado com status reservado. Portanto, para o piloto:

```text
carrinho
→ revisar checkout
→ criar pedido atomicamente
→ reservar estoque
→ abrir WhatsApp
→ rastrear por token
```

Não será afirmado que iniciar o preenchimento do checkout já cria reserva. Uma sessão de checkout com reserva anterior ao pedido fica como evolução opcional futura.

Pré-condições:

- revalidar preço, entrega, mínimo e estoque na criação;
- transação única;
- idempotência/replay seguro;
- liberação automática de reservas expiradas sem depender de abrir tela administrativa;
- snapshot comercial e de entrega no pedido.

---

## 9. Identidade visual

A RPC pública já expõe `logo_url`, `theme_config` e `visual_config`. O serviço também repassa `logo_url`; a lacuna atual está na renderização/integração do cabeçalho.

A V2 deve suportar:

- logo com fallback para nome da loja;
- capa opcional;
- logo clara/escura futura;
- identidade configurada pela loja;
- preferência do visitante: sistema, claro ou escuro;
- contraste e legibilidade obrigatórios.

O WhatsApp flutuante deve usar somente contato configurado da loja e desaparecer quando não houver número válido.

---

## 10. Slugs e canonicalização

O banco já possui:

- `reserved_store_slugs`;
- `store_slug_history`;
- `resolve_public_store_id_by_slug`;
- proteção de slugs já usadas;
- resolução de slug atual e histórica.

Ao abrir alias histórico:

```text
slug antiga
→ resolver a loja
→ carregar conteúdo
→ substituir a URL pela slug canônica
```

Os prefixos `/s`, `/loja` e `/cardapio` são aliases de rota; o histórico de slug é governado no banco.

---

## 11. Arquitetura de componentes

```text
PublicStoreApp
├── StoreHeader
├── StoreStatusBar
├── StoreNavigation
├── PublicCatalog
│   ├── Search
│   ├── CategoryTabs
│   ├── ProductGrid
│   ├── ProductCard
│   └── ProductConfigurator
├── CartSummaryBar
├── CartPage
├── CheckoutFlow
│   ├── FulfillmentStep
│   ├── CustomerStep
│   └── ReviewStep
├── OrderSuccess
└── PublicOrderTracking
```

Contextos:

```text
RemoteStorefront → entrega e retirada
TableStorefront  → mesa e comanda
```

---

## 12. Feature flags

```ts
export interface PublicStoreFeatures {
  storefrontV2: boolean;
  cartV2: boolean;
  checkoutV2: boolean;
  deliveryRulesV2: boolean;
  onlineStockPolicy: boolean;
  publicCustomerAccount: boolean;
  promotionalBanners: boolean;
  publicAnalytics: boolean;
  onlinePayments: boolean;
}
```

A ativação inicial será restrita à loja piloto. A experiência legada permanece como fallback.

---

## 13. Sequência de implementação

1. `docs: consolidate phase 10 storefront blueprint`
2. `refactor(storefront): establish public store context`
3. `refactor(cart): isolate public carts by store and context`
4. `feat(storefront): add mobile-first catalog shell`
5. `feat(storefront): add product configurator and projected pricing`
6. `feat(checkout): persist pickup and delivery selection`
7. `feat(delivery): add structured delivery rules and quotes`
8. `feat(stock): add online availability policies`
9. `refactor(orders): consolidate public order creation`
10. `feat(storefront): improve public order confirmation`
11. `chore(storefront): enable phase 10 pilot`

Migrations só começam depois da fundação frontend, contratos e aprovação específica das estruturas de entrega/estoque.

---

## 14. Testes obrigatórios

### Carrinho e configurador

- card e `+` abrem o mesmo modal;
- quantidade projetada considera o carrinho existente;
- desconto por categoria/grupo atualiza todos os itens afetados;
- próxima faixa é coerente;
- adicionar não abre drawer automaticamente;
- carrinho persiste após reload;
- carrinhos não se misturam entre lojas/contextos.

### Entrega

- retirada sem mínimo;
- entrega com taxa fixa;
- regra gratuita;
- gratuidade por subtotal;
- mínimo por região;
- CEP ausente;
- endereço incompleto;
- localização aceita/negada;
- troca de endereço invalida cotação;
- região não atendida;
- cotação expirada.

### Estoque

- saldo disponível;
- última unidade;
- reserva mínima;
- limite máximo;
- concorrência;
- expiração e liberação;
- replay idempotente.

### Slug e aparência

- slug atual e histórica;
- canonicalização;
- loja/catálogo desabilitado;
- logo válida/quebrada/ausente;
- temas claro, escuro e sistema;
- mobile e desktop.

---

## 15. Critérios do piloto

O piloto pode ser demonstrado quando:

- abrir pelo domínio oficial;
- aplicar logo e identidade;
- exibir produtos rapidamente;
- card/`+` abrirem configurador;
- mostrar desconto projetado corretamente;
- adicionar não interromper a compra;
- isolar carrinho por loja;
- retirada não exigir mínimo;
- entrega solicitar endereço e aplicar regra;
- criar pedido antes de abrir WhatsApp;
- revalidar preço e estoque;
- rastrear por token;
- permitir fallback imediato ao legado.

---

## 16. Matriz de factualidade

| Capacidade | Classificação |
|---|---|
| Rotas públicas e aliases de prefixo | `EXISTENTE` |
| Histórico e resolução de slug | `EXISTENTE` |
| Carrinho persistente de itens | `EXISTENTE, CONTRATO INSUFICIENTE` |
| Modal de produto | `EXISTENTE, A EVOLUIR` |
| Cotação autoritativa de preço | `EXISTENTE` |
| Grupos combinados de precificação | `EXISTENTE` |
| Checkout público | `EXISTENTE, FORÇA RETIRADA` |
| Endereço no contrato do pedido | `EXISTENTE, NÃO CONECTADO AO CHECKOUT` |
| Regras por região e cotação de frete | `PLANEJADA` |
| Reserva vinculada ao pedido | `EXISTENTE` |
| Job automático de expiração | `A CONFIRMAR` |
| Política de estoque online | `HOMOLOGADA NO BLUEPRINT, NÃO IMPLEMENTADA` |
| Logo no contrato público | `EXISTENTE, NÃO RENDERIZADA CORRETAMENTE` |
| OTP via OptmaSMSGate | `DEPENDENTE DO SMSGATE` |
| Pix dinâmico | `PLANEJADO` |
| Analytics público | `PLANEJADO` |

---

## 17. Parecer

```text
BLUEPRINT APROVÁVEL PARA IMPLEMENTAÇÃO
COM PRÉ-CONDIÇÕES TÉCNICAS CONTROLÁVEIS
```

Pré-condições:

1. preservar o motor autoritativo de preço;
2. não implementar entrega/estoque apenas no frontend;
3. isolar carrinho por loja e contexto;
4. manter fallback legado por feature flag;
5. confirmar execução automática da expiração;
6. começar pela fundação sem migration ampla;
7. tratar `01/08/2026` como demonstração do piloto/blueprint, não lançamento `1.0.0`.
