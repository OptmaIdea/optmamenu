# Pós-Fase 9 — Reavaliação de Pedido Online / Configurações comerciais

## Status

Reavaliado e sem bloqueio atual.

## Motivo

Após o closeout geral da Fase 9, a sequência recomendada indicava revisar a ponta de Pedido Online / Configurações comerciais.

A reavaliação confirmou que essa frente já havia sido concluída funcionalmente na 9.13.1H.

## Base já implementada

A tela de Pedido Online já cobre:

- loja pública ativa/inativa;
- catálogo público ativo/inativo;
- slug público;
- local de venda pública;
- pedido mínimo para entrega;
- retirada sem mínimo por padrão;
- tempo de reserva;
- WhatsApp principal;
- e-mail principal;
- mensagens padrão;
- instruções de entrega;
- instruções de retirada;
- observação do cliente;
- leitura de métodos públicos de entrega/retirada;
- integração com `stores`, `store_settings.order_settings` e `store_delivery_methods`.

## Arquivos principais

- `src/services/onlineOrderSettingsService.ts`;
- `src/pages/private/admin/settings/onlineOrders/OnlineOrderSettingsPage.tsx`;
- `docs/FASE_9_13_1H_PEDIDO_ONLINE_CONFIGURACOES.md`.

## RPCs/consultas usadas

- `get_store_settings_center`;
- `update_store_commercial_settings`;
- `update_store_settings_section` com seção `orders`;
- consulta direta em `stock_locations`;
- consulta direta em `store_delivery_methods`.

## Validações já registradas

A documentação da 9.13.1H registrou:

- `npm run build` sem erros;
- console limpo;
- Pedido Online salvando corretamente;
- permissões `settings.orders.view/manage` funcionando;
- loja pública respeitando status ativo/inativo;
- retirada sem mínimo por padrão;
- persistência em `stores` e `store_settings.order_settings`.

## Decisão

Não abrir nova frente técnica neste momento.

A ponta de Pedido Online / Configurações comerciais fica considerada **sem bloqueio atual**.

## Pontos futuros anotados

Sem bloquear a sequência, ainda podem evoluir futuramente:

1. Taxa por km e regras avançadas de entrega;
2. regras por região/bairro;
3. horários de funcionamento do pedido online;
4. mensagens por canal;
5. integração oficial com WhatsApp Business Platform;
6. preview mais visual do cardápio público;
7. geração/impressão de QR por mesa/comanda;
8. separação futura de regras de entrega, retirada e mesa quando o volume crescer.

## Próxima ponta da sequência

Avançar para:

- Clientes 360º / Vida do Cliente;
- Fidelidade avançada;
- Marketing, segmentos e campanhas.
