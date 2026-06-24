# Fase 9.13.1H — Pedido Online em Configurações

## Status

**Em execução — etapa 1 implementada no frontend sem SQL novo.**

Esta frente substitui o placeholder da aba **Pedido Online** em `/admin/settings` por uma tela real de configuração.

## Objetivo

Organizar as configurações do Pedido Online usando estruturas já existentes no Supabase.

A etapa inicial cobre:

- loja pública ativa;
- catálogo público ativo;
- slug público;
- local de venda pública;
- pedido mínimo para entrega;
- retirada sem mínimo por padrão;
- tempo de reserva;
- WhatsApp principal;
- e-mail principal;
- mensagens padrão de WhatsApp, entrega e retirada;
- leitura de métodos públicos de entrega/retirada.

## Decisão técnica

Não foi criada migration nem tabela nova.

A tela usa estruturas existentes:

- `stores.public_store_enabled`;
- `stores.public_catalog_enabled`;
- `stores.slug`;
- `stores.minimum_order_value`;
- `stores.reservation_time_minutes`;
- `stores.public_sales_location_id`;
- `stores.contacts`;
- `store_settings.order_settings`;
- `store_delivery_methods`.

RPCs usadas:

- `get_store_settings_center`;
- `update_store_commercial_settings`;
- `update_store_settings_section` com seção `orders`.

## Arquivos criados ou alterados

Criados:

- `src/services/onlineOrderSettingsService.ts`
- `src/pages/private/admin/settings/onlineOrders/OnlineOrderSettingsPage.tsx`

Alterado:

- `src/pages/private/admin/settings/appearance/Appearance.tsx`

O arquivo `Appearance.tsx` ficou temporariamente como wrapper para `OnlineOrderSettingsPage`, porque `StoreSettings.tsx` ainda importa esse caminho como `Config` na aba `orders`.

## Ajuste futuro recomendado

Em uma próxima revisão, trocar o import em `StoreSettings.tsx` para apontar diretamente para `OnlineOrderSettingsPage`.

Depois disso, a antiga pasta `appearance` poderá ser removida ou reavaliada caso não tenha uso real.

## Quando atualizar o snapshot Supabase

Não foi necessário atualizar o snapshot nesta etapa, porque o schema atual já confirmou as estruturas necessárias.

Atualizar `docs/supabase_audit/schema_public_current.sql` quando houver alteração em RPC, view, tabela, policy, trigger ou quando a tela acusar coluna/RPC inexistente.

## Próximos ajustes recomendados

1. Testar `/admin/settings?tab=orders` em modo owner/admin.
2. Testar `settings.orders.view=true` e `settings.orders.manage=false`.
3. Validar persistência em `store_settings.order_settings`.
4. Conferir se a loja pública já consome as chaves novas de `order_settings`.
5. Migrar o import direto em `StoreSettings.tsx` quando for conveniente.
