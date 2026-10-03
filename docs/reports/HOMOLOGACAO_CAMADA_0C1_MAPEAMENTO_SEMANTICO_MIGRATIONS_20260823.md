# Homologação 0C.1 — Mapeamento semântico do drift de migrations

**Data:** 23/08/2026  
**Branch:** `agent/homologacao-geral-20260820`

## Evidência

A comparação `supabase migration list` mostrou grande divergência entre timestamps locais e remotos. A inspeção dos nomes de 21–26/07 confirmou que grande parte das alterações existe nos dois lados com **nomes iguais ou muito próximos**, mas versões/timestamps diferentes.

Isso indica que, durante parte do desenvolvimento, migrations foram aplicadas ao remoto por um caminho que registrou novas versões na tabela `supabase_migrations.schema_migrations`, enquanto arquivos locais continuaram com seus timestamps originais.

## Exemplos de pares semânticos

| Local | Remoto | Observação |
|---|---|---|
| `202607220015_add_store_member_invite_email_delivery` | `20260721213440_add_store_member_invite_email_delivery` | mesmo objetivo; inspeção pontual mostrou SQL equivalente em essência |
| `202607221940_fix_member_contact_email_and_access_timeline_grants` | `20260722164114_fix_member_contact_email_and_access_timeline_grants` | mesmo nome, timestamp diferente |
| `202607221946_fix_user_permissions_and_profile_details_grants` | `20260722164849_fix_user_permissions_and_profile_details_grants` | mesmo nome, timestamp diferente |
| `202607222004_fix_user_permission_products_group_and_member_avatars` | `20260722171107_fix_user_permission_products_group_and_member_avatars` | mesmo nome, timestamp diferente |
| `202607222026_fix_profile_request_grant_and_products_permission_legacy` | `20260722173255_fix_profile_request_grant_and_products_permission_legacy` | mesmo nome, timestamp diferente |
| `202607222052_grant_review_store_profile_change_request` | `20260722175313_grant_review_store_profile_change_request` | mesmo nome, timestamp diferente |
| `202607230344_enrich_sale_stock_movements_with_customer` | `20260723010523_enrich_sale_stock_movements_with_customer` | mesmo nome, timestamp diferente |
| `202607231448_create_public_order_tracking_by_token` | `20260723120113_create_public_order_tracking_by_token` | mesmo nome, timestamp diferente |
| `202607231940_create_order_message_events_assisted_whatsapp` | `20260723163327_create_order_message_events_assisted_whatsapp` | mesmo nome, timestamp diferente |
| `202607232112_extend_ready_reservation_and_finalize_with_payment` | `20260723180037_extend_ready_reservation_and_finalize_with_payment` | mesmo nome, timestamp diferente |
| `202607232155_configure_ready_hold_active_order_count_and_pickup_payment` | `20260723183508_configure_ready_hold_active_order_count_and_pickup_payment` | **não é seguro tratar como simples rename**: a versão remota possui SQL adicional em relação ao arquivo local auditado |
| `202607232155_extend_ready_from_remaining_time` | `20260723185436_extend_ready_from_remaining_time` | conteúdo local auditado coincide semanticamente com a migration remota |
| `202607232345_centralize_combined_category_pricing` | `20260723203749_centralize_combined_category_pricing` | mesmo nome, timestamp diferente |
| `202607240020_category_pricing_scope_and_secure_image_upload` | `20260723212107_category_pricing_scope_and_secure_image_upload` | mesmo nome, timestamp diferente |
| `202607240115_expose_complete_public_pricing_configuration` | `20260723221912_expose_complete_public_pricing_configuration` | mesmo nome, timestamp diferente |
| `202607242215_harden_pos_stock_conflict_and_payment_status` | `20260724185442_harden_pos_stock_conflict_and_payment_status` | mesmo nome, timestamp diferente |
| `20260725032000_sync_order_payment_status_from_cashbook` | `20260725000706_sync_order_payment_status_from_cashbook` | mesmo nome, timestamp diferente |
| `20260725034000_reconcile_orphan_reserved_balances` | `20260725002454_reconcile_orphan_reserved_balances` | mesmo nome, timestamp diferente |
| `20260725045500_include_sale_discrepancies_in_product_lifecycle` | `20260725014837_include_sale_discrepancies_in_product_lifecycle` | mesmo nome, timestamp diferente |
| `20260726010800_add_reward_media_library` | `20260725220855_add_reward_media_library` | mesmo nome, timestamp diferente |
| `20260726015500_limit_reward_media_library_to_15` | `20260725225506_limit_reward_media_library_to_15` | mesmo nome, timestamp diferente |
| `20260726024600_reward_images_storage_delete_policy` | `20260725234928_reward_images_storage_delete_policy` | mesmo nome, timestamp diferente |
| `20260726032000_reward_images_authenticated_select_policy` | `20260726001239_reward_images_authenticated_select_policy` | mesmo nome, timestamp diferente |
| `20260726042000_schedule_expired_order_cleanup` | `20260726011154_schedule_expired_order_cleanup` | mesmo nome, timestamp diferente |
| `20260726044500_add_automatic_expiration_filter_to_admin_orders` | `20260726013459_add_automatic_expiration_filter_to_admin_orders` | mesmo nome, timestamp diferente |
| `20260726053500_store_slug_governance_and_aliases` | `20260726020613_store_slug_governance_and_aliases` | mesmo nome, timestamp diferente |
| `20260726074000_preserve_public_customer_marketing_consent` | `20260726023853_preserve_public_customer_marketing_consent` | mesmo nome, timestamp diferente |

## Divergências de conteúdo/versão

Algumas migrations têm nomes apenas próximos, indicando evolução adicional no remoto:

- `fix_public_order_tracking_and_expired_reservation_access` local versus remoto `..._v2`;
- `merge_sale_discrepancy_into_product_movement` local versus remoto `..._v2`;
- `allow_avatar_category_storage_select` local versus remoto `allow_avatar_and_category_storage_select_for_upsert`;
- `harden_public_customer_identity` local versus remoto `harden_public_customer_identity_and_backfill`, seguido por migrations remotas de guard/finalização;
- `reward_media_delete_cleanup` local versus duas migrations remotas mais específicas para delete/cleanup.

Há ainda migrations remotas sem arquivo local correspondente, incluindo as quatro de 01/08, e migrations locais sem entrada remota equivalente.

## Timestamps duplicados locais

Existem dois arquivos com prefixo `202607232155`:

- `202607232155_configure_ready_hold_active_order_count_and_pickup_payment.sql`;
- `202607232155_extend_ready_from_remaining_time.sql`.

No remoto, essas alterações foram registradas separadamente como `20260723183508` e `20260723185436`. Portanto, o prefixo local duplicado não deve ser reparado por rename automático antes de resolver toda a estratégia de histórico.

## Conclusão técnica

**Não usar `migration repair` em massa e não renomear arquivos locais para igualar os timestamps remotos.**

A inspeção pontual provou que migrations de mesmo nome podem não ser byte/semanticamente idênticas; uma delas contém SQL adicional no remoto. Marcar todas como “applied” pelo timestamp local criaria uma história falsa e poderia causar reexecução/duplicação futura.

A estratégia segura passa a ser:

1. preservar `supabase/migrations` atual como histórico legado;
2. obter a cadeia remota real a partir de `supabase_migrations.schema_migrations`/`supabase migration fetch` em ambiente temporário;
3. verificar se essa cadeia remota, aplicada do zero, reproduz o schema atual;
4. diffar o resultado contra o projeto remoto;
5. se houver diferença, gerar uma migration de baseline/finalização que capture o schema atual faltante;
6. somente então definir uma nova baseline canônica para novos ambientes e futuras migrations.

Nenhuma alteração na migration history remota foi feita nesta etapa.
