# Fase 9.13.1H — Pedido Online e Aparência em Configurações

## Status

**Concluída funcionalmente.**

Esta frente substituiu o placeholder da aba **Pedido Online** em `/admin/settings` por uma tela real de configuração e separou a personalização visual na aba **Aparência da Loja**.

A validação final registrou:

- `npm run build` sem erros;
- console limpo;
- Pedido Online salvando corretamente;
- Aparência da Loja salvando e persistindo alterações em `stores.config`;
- loja pública refletindo alterações visuais;
- botão global da loja pública respeitando loja ativa/inativa;
- permissões `view/manage` funcionando para Pedido Online e Aparência da Loja;
- snapshot Supabase atualizado em `docs/supabase_audit/schema_public_current.sql`.

---

## Objetivo

Organizar as configurações de Pedido Online e Aparência da Loja em áreas próprias dentro de **Configurações da Loja**, aproveitando estruturas já existentes no Supabase e criando apenas as permissões necessárias para a nova aba visual.

A etapa cobre:

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
- leitura de métodos públicos de entrega/retirada;
- aba dedicada para Aparência da Loja;
- permissões dedicadas para Aparência da Loja;
- persistência de layout em `stores.config`.

---

## Pedido Online

### Estruturas usadas

A tela de Pedido Online usa estruturas já existentes:

- `stores.public_store_enabled`;
- `stores.public_catalog_enabled`;
- `stores.slug`;
- `stores.minimum_order_value`;
- `stores.reservation_time_minutes`;
- `stores.public_sales_location_id`;
- `stores.contacts`;
- `store_settings.order_settings`;
- `store_delivery_methods`.

### RPCs usadas

- `get_store_settings_center`;
- `update_store_commercial_settings`;
- `update_store_settings_section` com seção `orders`.

### Arquivos criados

- `src/services/onlineOrderSettingsService.ts`
- `src/pages/private/admin/settings/onlineOrders/OnlineOrderSettingsPage.tsx`

### Comportamento validado

- A aba `/admin/settings?tab=orders` abre corretamente.
- O salvamento grava os dados comerciais e o JSON de `store_settings.order_settings`.
- O toast de salvamento aparece.
- `Loja pública ativa = false` desativa o atalho interno da tela.
- O botão global da casinha no `PrivateLayout` respeita `public_store_enabled`.
- `settings.orders.view/manage` funciona com leitura e edição.

---

## Aparência da Loja

### Estrutura usada

A tela de Aparência da Loja salva e lê personalização visual em:

- `stores.config`.

### RPCs e consultas usadas

- `get_store_config_admin` para carregar a configuração visual da loja ativa;
- update direto em `stores.config` para persistir alterações.

### Arquivo principal

- `src/pages/private/admin/settings/appearance/Appearance.tsx`

### Comportamento validado

- A aba `/admin/settings?tab=appearance` abre corretamente.
- O botão **Salvar Aparência da Loja** aparece dentro da tela mesmo com `withoutHeader=true`.
- O salvamento mostra toast e aviso visual.
- As alterações persistem após reload.
- A loja pública reflete as cores e demais dados salvos.
- `settings.appearance.view/manage` funciona com leitura e edição.

---

## Permissões de Aparência da Loja

A nova aba passou a usar permissões próprias:

- `settings.appearance.view`
- `settings.appearance.manage`

### Observação importante

Inicialmente as permissões foram inseridas em `security_permission_catalog`, mas a tela de permissões e as RPCs de matriz usam o catálogo operacional correto:

- `store_permission_catalog`
- `store_role_permission_templates`

A correção final adicionou as permissões em `store_permission_catalog`, criou/backfillou templates em `store_role_permission_templates` para todos os papéis e executou `touch_store_permission_version` para atualizar realtime/cache de permissões.

### Frontend ajustado

- `StoreSettings.tsx` passou a usar `settings.appearance.view/manage` na aba `appearance`.
- `PrivateLayout.tsx` passou a incluir `settings.appearance.view` na lista de permissões de abas de Configurações.
- `Security.tsx` passou a exibir **Aparência da Loja** em `ROLE_PERMISSION_TREE` com `view` e `manage`.

---

## Organização das abas

As responsabilidades ficaram separadas:

| Aba | Responsabilidade | Persistência |
|---|---|---|
| Pedido Online | Regras de pedido, loja pública, entrega, retirada, mínimo, WhatsApp e mensagens | `stores` + `store_settings.order_settings` |
| Aparência da Loja | Cores, logo, banner, textos institucionais, contatos públicos, redes sociais e preview | `stores.config` |

---

## Snapshot Supabase

O snapshot foi atualizado após as alterações no catálogo de permissões:

- `docs/supabase_audit/schema_public_current.sql`

Atualizar novamente quando houver alteração em:

- RPC;
- view;
- tabela;
- policy/RLS;
- trigger;
- catálogo de permissões;
- templates de permissões.

---

## Ajustes futuros anotados

A frente está fechada funcionalmente, mas a tela de Aparência da Loja deve receber uma revisão posterior de UX:

- reorganizar identidade visual, logo, favicon, banner e cores;
- melhorar preview real da loja pública;
- separar textos institucionais, contatos e redes sociais;
- validar upload e tamanhos recomendados;
- remover campos antigos/duplicados;
- melhorar a experiência em `manage=false`;
- revisar mensagens e instruções de layout para lojista não técnico.

---

## Resultado

A frente 9.13.1H fica encerrada como:

**Pedido Online e Aparência da Loja em Configurações concluídos funcionalmente, com permissões dedicadas, persistência validada e Supabase snapshot atualizado.**
