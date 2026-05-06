# OptmaMenu — Fase 8 Comercial

## Objetivo da fase

A Fase 8 consolidou a primeira camada comercial do OptmaMenu, saindo de uma retaguarda operacional forte para uma operação vendável: loja pública por slug, pedidos, clientes, pagamentos, entregas, fidelidade, dashboard comercial e central de marketing.

A entrega foi desenhada para a realidade inicial da Gelinhares: WhatsApp como canal principal, retirada/entrega local, controle de estoque por local, livro diário de caixa simples e uso seguro dos dados dos clientes.

## Entregas principais

| Área | Entrega | Status |
|---|---|---:|
| Loja pública | Catálogo público por slug | Concluído |
| Pedidos | Criação de pedido público com reserva | Concluído |
| Estoque | Reserva, cancelamento e baixa ao concluir venda | Concluído |
| Pagamentos | Formas configuráveis por loja | Concluído |
| Entregas | Métodos configuráveis por loja | Concluído |
| Caixa | Livro diário de caixa inicial | Concluído |
| QR/mesa | Garçom digital inicial por rota pública | Concluído |
| Clientes | Clientes 360º e Vida do Cliente | Concluído |
| Fidelidade | Pontuação avançada inicial por pedido concluído | Concluído |
| Dashboard | Dashboard comercial por período | Concluído |
| Marketing | Segmentos, campanhas e envio manual seguro via WhatsApp | Concluído |

## Rotas administrativas entregues ou refinadas

| Rota | Finalidade |
|---|---|
| `/admin` | Painel operacional diário |
| `/admin/commercial-dashboard` | Dashboard comercial por período |
| `/admin/orders` | Gestão de pedidos |
| `/admin/cashbook` | Livro diário de caixa |
| `/admin/commercial-settings` | Configurações comerciais |
| `/admin/stock-settings` | Configurações de estoque global/local |
| `/admin/customers` | Clientes |
| `/admin/customers/:id/lifecycle` | Vida do Cliente |
| `/admin/loyalty/advanced` | Fidelidade avançada inicial |
| `/admin/marketing` | Segmentos, promoções e comunicações dirigidas |
| `/admin/messages-admin` | Reservada para comunicados operacionais/não promocionais |

## Fluxo comercial consolidado

```text
Cliente acessa loja pública
→ escolhe produtos
→ escolhe retirada/entrega
→ escolhe forma de pagamento
→ pedido reservado
→ estoque fica reservado
→ lojista aceita/prepara
→ lojista conclui pedido
→ reserva é consumida
→ estoque físico baixa
→ livro de caixa recebe entrada, se método afetar caixa
→ fidelidade pontua, se aplicável
```

## Decisões importantes

### Pedido mínimo

O pedido mínimo deve ser aplicado apenas para **entrega**. Para **retirada**, o pedido pode ter qualquer valor. Essa regra deve permanecer configurável nas configurações comerciais/entrega.

### Pagamento “A combinar”

A forma `pending` / “A combinar” é válida para pedidos em que o pagamento será resolvido fora do checkout. Ela não afeta automaticamente o livro de caixa.

### Estoque e reserva

O pedido público deve criar reserva de estoque. A baixa física ocorre apenas na conclusão do pedido, não na criação nem no aceite/preparo.

### Cancelamento seguro

Cancelamentos feitos após as correções da Fase 8 liberam reservas e devolvem os produtos ao estoque disponível. Reservas antigas de testes podem permanecer presas e devem ser tratadas depois por limpeza controlada.

### Marketing seguro

A Central de Marketing não envia mensagens automaticamente. Ela prepara destinatários e mensagens, abre WhatsApp manualmente e permite marcar o envio como manualmente realizado.

## Objetos de banco relevantes

A Fase 8 adicionou ou consolidou estruturas como:

- `store_payment_methods`
- `store_delivery_methods`
- `store_sales_channels`
- `cashbook_entries`
- `customers`
- `customer_segments`
- `customer_segment_members`
- `promotion_campaigns`
- `promotion_campaign_recipients`
- `customer_benefit_rules`
- `loyalty_point_rules`
- `loyalty_transactions`

Também foram estabilizados fluxos em `orders`, `order_items`, `stock_reservations`, `stock_movements` e `inventory_location_balances`.

## RPCs relevantes

Principais RPCs/funções consolidadas na fase:

- `create_reserved_public_order`
- `confirm_reserved_public_order`
- `confirm_order_payment`
- `complete_confirmed_public_order`
- `admin_cancel_public_order_safe`
- `admin_complete_public_order_safe`
- `get_commercial_dashboard_safe`
- `get_marketing_center_safe`
- `refresh_customer_segments_safe`
- `upsert_customer_segment_safe`
- `upsert_promotion_campaign_safe`
- `build_campaign_recipients_preview_safe`
- `prepare_campaign_recipients_safe`
- `get_campaign_recipients_safe`
- `mark_campaign_recipient_manual_sent_safe`
- `apply_order_loyalty_points_advanced`
- `calculate_order_loyalty_points_advanced`

## Ajustes finos registrados para depois

- Venda na Vida do Produto/Movimentações deve mostrar **Ref. = PED-...** e não UUID truncado.
- Card de venda deve mostrar **Destino = nome do cliente**.
- Atividades recentes ainda deve receber vendas concluídas de forma ideal.
- Botões “Nova entrada” e “Nova saída” do Livro de Caixa devem ser habilitados.
- Entregas devem evoluir para taxa por km, meios de transporte e regras avançadas.
- QR Codes reais por mesa/comanda devem ganhar recurso administrativo de geração/impressão.
- Fidelidade avançada deve virar sprint própria de consolidação.
- `/admin/messages-admin` deve ser reaproveitada para mensagens operacionais/não promocionais.

## Resultado

A Fase 8 entrega uma base comercial inicial forte, com fluxo completo de pedido, estoque, caixa, clientes, fidelidade, dashboard e marketing manual seguro. A próxima frente natural é a Fase 9: usuários, permissões, senhas, aprovações, governança e preparação para multilojas/superadmin.
