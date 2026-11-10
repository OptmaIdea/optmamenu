# Fase 10.2B — Configuração administrativa do estoque online

Data: 01/08/2026

## Objetivo

Expor na área administrativa as regras que controlam quanto do estoque do local vinculado à slug poderá ser vendido no catálogo público.

## Local da configuração

`/admin/settings` → `Pedido Online` → `Estoque da loja pública`

## Campos disponíveis

### Local de estoque vinculado à slug

Seleciona o `stock_locations.id` usado como origem autoritativa do catálogo público por meio de `stores.public_sales_location_id`.

A slug não soma outros locais nem usa o saldo global para decidir disponibilidade.

### Reserva mínima para venda local

Campo persistido em:

```json
{
  "online_stock_local_reserve_default": 0
}
```

Quantidade protegida para atendimento presencial antes de liberar saldo para o canal online.

### Limite máximo disponível online

Campo persistido em:

```json
{
  "online_stock_limit_default": null
}
```

Quando `null`, todo o saldo restante após a reserva local pode ser vendido online. Quando numérico, funciona como teto.

### Limite de poucas unidades

Campo persistido em:

```json
{
  "online_stock_low_threshold": 5
}
```

Com valor zero, o aviso público de poucas unidades fica desativado.

### Mostrar quantidade exata

Campo persistido em:

```json
{
  "online_stock_show_exact": false
}
```

Quando desligado, o catálogo mostra apenas `Disponível`, `Poucas unidades` ou `Indisponível no momento`.

### Publicar produtos por padrão

Campo persistido em:

```json
{
  "online_stock_publish_products_by_default": true
}
```

Define o comportamento padrão dos produtos ativos. Exceções individuais ficam reservadas para a futura grade específica de publicação por produto.

## Fórmula

```text
disponível_local = físico_local - reservado_local
saldo_após_reserva = max(disponível_local - reserva_local, 0)
disponível_online = min(saldo_após_reserva, limite_online)
```

Quando não há limite online, `disponível_online = saldo_após_reserva`.

## Arquivos

- `src/services/onlineOrderSettingsService.ts`
- `src/pages/private/admin/settings/onlineOrders/OnlineStockPolicySection.tsx`
- `src/pages/private/admin/settings/onlineOrders/OnlineOrderSettingsPage.tsx`

## Observações

- O contrato público continua autoritativo no backend.
- A configuração administrativa reutiliza `update_store_settings_section` para persistir `order_settings`.
- Não foi criada uma segunda fonte de verdade no frontend.
- A seleção do local continua sendo validada por `update_store_commercial_settings`.
