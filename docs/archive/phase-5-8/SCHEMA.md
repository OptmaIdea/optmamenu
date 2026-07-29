## Table `profiles`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `phone` | `text` |  Nullable Unique |
| `name` | `text` |  Nullable |
| `address` | `text` |  Nullable |
| `district` | `text` |  Nullable |
| `city` | `text` |  Nullable |
| `birthdata` | `date` |  Nullable |
| `cpf` | `text` |  Nullable |
| `points` | `int4` |  Nullable |
| `accepted_policy` | `bool` |  Nullable |
| `accepted_promo` | `bool` |  Nullable |
| `is_admin` | `bool` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |
| `is_active` | `bool` |  Nullable |
| `internal_notes` | `text` |  Nullable |
| `loyalty_points` | `int4` |  Nullable |
| `zip_code` | `text` |  Nullable |
| `address_number` | `text` |  Nullable |
| `complement` | `text` |  Nullable |
| `state` | `text` |  Nullable |
| `mobile_phone` | `text` |  Nullable |
| `whatsapp_phone` | `text` |  Nullable |
| `instagram_url` | `text` |  Nullable |
| `facebook_url` | `text` |  Nullable |
| `website_url` | `text` |  Nullable |
| `avatar_url` | `text` |  Nullable |

## Table `promotions`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `name` | `text` |  |
| `description` | `text` |  Nullable |
| `type` | `promo_type` |  |
| `value` | `numeric` |  |
| `category_id` | `uuid` |  Nullable |
| `product_id` | `uuid` |  Nullable |
| `start_date` | `timestamptz` |  Nullable |
| `end_date` | `timestamptz` |  Nullable |
| `active` | `bool` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `stock_reservations`

Stock Reservations (Relinked)

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `order_id` | `uuid` |  Nullable |
| `product_id` | `uuid` |  Nullable |
| `quantity` | `int4` |  |
| `expires_at` | `timestamptz` |  |
| `created_at` | `timestamptz` |  |
| `store_id` | `uuid` |  |
| `status` | `text` |  |
| `consumed_at` | `timestamptz` |  Nullable |
| `cancelled_at` | `timestamptz` |  Nullable |
| `location_id` | `uuid` |  Nullable |
| `sales_channel` | `text` |  Nullable |
| `metadata` | `jsonb` |  |

## Table `loyalty_transactions_legacy`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  |
| `order_id` | `uuid` |  Nullable |
| `amount` | `int4` |  |
| `description` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `stores`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `created_at` | `timestamptz` |  |
| `user_id` | `uuid` |  |
| `slug` | `text` |  Unique |
| `name` | `text` |  |
| `description` | `text` |  Nullable |
| `logo_url` | `text` |  Nullable |
| `phone_number` | `text` |  Nullable |
| `theme_config` | `jsonb` |  Nullable |
| `legal_name` | `text` |  Nullable |
| `doc_type` | `text` |  Nullable |
| `document` | `text` |  Nullable |
| `fantasy_name` | `text` |  Nullable |
| `establishment_type` | `text` |  Nullable |
| `address` | `jsonb` |  Nullable |
| `contacts` | `jsonb` |  Nullable |
| `consents` | `jsonb` |  Nullable |
| `sms_gateway_token` | `text` |  Nullable |
| `reservation_time_minutes` | `int4` |  Nullable |
| `stock_password_hash` | `text` |  Nullable |
| `config` | `jsonb` |  Nullable |
| `privacy_policy_text` | `text` |  Nullable |
| `terms_of_use_text` | `text` |  Nullable |
| `cookie_policy_text` | `text` |  Nullable |
| `dpo_email` | `text` |  Nullable |
| `dpo_contact` | `text` |  Nullable |
| `token_expiry_seconds` | `int4` |  Nullable |
| `max_token_attempts` | `int4` |  Nullable |
| `public_store_enabled` | `bool` |  |
| `public_catalog_enabled` | `bool` |  |
| `minimum_order_value` | `numeric` |  |
| `public_sales_location_id` | `uuid` |  Nullable |
| `commercial_config` | `jsonb` |  |

## Table `categories`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `created_at` | `timestamptz` |  |
| `store_id` | `uuid` |  |
| `name` | `text` |  |
| `sort_order` | `int4` |  Nullable |
| `active` | `bool` |  Nullable |
| `price_logic_type` | `text` |  Nullable |
| `price_rules` | `jsonb` |  Nullable |
| `description` | `text` |  Nullable |
| `image_url` | `text` |  Nullable |
| `loyalty_eligible` | `bool` |  Nullable |
| `loyalty_multiplier` | `numeric` |  Nullable |
| `pricing_strategy` | `jsonb` |  Nullable |

## Table `products`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `created_at` | `timestamptz` |  |
| `store_id` | `uuid` |  |
| `category_id` | `uuid` |  Nullable |
| `name` | `text` |  |
| `description` | `text` |  Nullable |
| `price` | `numeric` |  |
| `active` | `bool` |  Nullable |
| `sort_order` | `int4` |  Nullable |
| `use_category_pricing` | `bool` |  Nullable |
| `price_logic_type` | `text` |  Nullable |
| `price_rules` | `jsonb` |  Nullable |
| `stock_quantity` | `int4` |  Nullable |
| `images` | `_text` |  Nullable |
| `min_stock` | `int4` |  Nullable |
| `max_stock` | `int4` |  Nullable |
| `last_sale_at` | `timestamptz` |  Nullable |
| `last_stock_entry_at` | `timestamptz` |  Nullable |
| `discontinued` | `bool` |  Nullable |
| `is_discontinued` | `bool` |  Nullable |
| `last_entry_unit_cost` | `numeric` |  Nullable |

## Table `orders`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  Nullable |
| `store_id` | `uuid` |  Nullable |
| `customer_name` | `text` |  Nullable |
| `customer_phone` | `text` |  Nullable |
| `status` | `order_status` |  Nullable |
| `total` | `numeric` |  |
| `payment_method` | `payment_method` |  Nullable |
| `proof_url` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |
| `confirmed_at` | `timestamptz` |  Nullable |
| `completed_at` | `timestamptz` |  Nullable |
| `delivery_address` | `text` |  Nullable |
| `metadata` | `jsonb` |  Nullable |
| `customer_id` | `uuid` |  Nullable |
| `sales_channel` | `text` |  |
| `order_code` | `text` |  Nullable |
| `customer_snapshot` | `jsonb` |  |
| `commercial_metadata` | `jsonb` |  |
| `fulfillment_type` | `text` |  |
| `delivery_address_snapshot` | `jsonb` |  |
| `table_code` | `text` |  Nullable |
| `notes` | `text` |  Nullable |
| `public_order_token` | `text` |  Nullable |
| `expires_at` | `timestamptz` |  Nullable |
| `payment_method_code` | `text` |  Nullable |
| `payment_metadata` | `jsonb` |  |
| `delivery_method_code` | `text` |  Nullable |
| `delivery_fee` | `numeric` |  |
| `subtotal` | `numeric` |  Nullable |
| `delivery_metadata` | `jsonb` |  |

## Table `order_items`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `order_id` | `uuid` |  Nullable |
| `product_id` | `uuid` |  Nullable |
| `quantity` | `int4` |  |
| `unit_price` | `numeric` |  |
| `discount` | `numeric` |  Nullable |
| `store_id` | `uuid` |  Nullable |
| `product_snapshot` | `jsonb` |  |
| `commercial_metadata` | `jsonb` |  |

## Table `inventory_history_legacy`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `store_id` | `uuid` |  Nullable |
| `product_id` | `uuid` |  Nullable |
| `type` | `inventory_move_type` |  |
| `quantity` | `int4` |  |
| `balance_before` | `int4` |  |
| `balance_after` | `int4` |  |
| `order_id` | `uuid` |  Nullable |
| `user_id` | `uuid` |  Nullable |
| `reason` | `text` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |

## Table `store_hours`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `store_id` | `uuid` |  Nullable |
| `day_of_week` | `int4` |  |
| `open_time` | `time` |  Nullable |
| `close_time` | `time` |  Nullable |
| `is_closed` | `bool` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |

## Table `store_schedules_exceptions`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `store_id` | `uuid` |  Nullable |
| `exception_date` | `date` |  |
| `is_closed` | `bool` |  Nullable |
| `open_time` | `time` |  Nullable |
| `close_time` | `time` |  Nullable |
| `reason` | `text` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |

## Table `store_security_logs`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `store_id` | `uuid` |  Nullable |
| `user_id` | `uuid` |  Nullable |
| `user_email` | `text` |  Nullable |
| `action` | `text` |  |
| `details` | `jsonb` |  Nullable |
| `outcome` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |
| `user_name` | `text` |  Nullable |
| `sensitive` | `bool` |  |
| `visible_to_member` | `bool` |  |
| `display_action` | `text` |  Nullable |

## Table `customers`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `store_id` | `uuid` |  |
| `phone` | `text` |  |
| `full_name` | `text` |  Nullable |
| `cpf` | `text` |  Nullable |
| `email` | `text` |  Nullable |
| `birth_date` | `date` |  Nullable |
| `is_whatsapp` | `bool` |  Nullable |
| `contact_preference` | `text` |  Nullable |
| `marketing_consent` | `bool` |  Nullable |
| `loyalty_points` | `int4` |  Nullable |
| `loyalty_tier` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |
| `last_login` | `timestamptz` |  Nullable |
| `status` | `text` |  Nullable |
| `nickname` | `text` |  Nullable |
| `password_hash` | `text` |  Nullable |
| `tags` | `_text` |  Nullable |
| `loyalty_opt_in` | `bool` |  Nullable |
| `current_stamps` | `int4` |  Nullable |
| `current_tier_id` | `uuid` |  Nullable |
| `last_point_activity_at` | `timestamptz` |  Nullable |
| `birth_date_locked` | `bool` |  Nullable |
| `email_verified` | `bool` |  Nullable |
| `source` | `text` |  |
| `data_ownership` | `text` |  |
| `editable_by_store` | `bool` |  |
| `internal_notes` | `text` |  Nullable |
| `customer_metadata` | `jsonb` |  |
| `last_order_at` | `timestamptz` |  Nullable |
| `total_orders` | `int4` |  |
| `total_spent` | `numeric` |  |

## Table `loyalty_transactions`

Logs all loyalty point movements for customers

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `customer_id` | `uuid` |  |
| `type` | `text` |  |
| `points` | `int4` |  |
| `description` | `text` |  Nullable |
| `order_id` | `uuid` |  Nullable |
| `created_at` | `timestamptz` |  |
| `program_id` | `uuid` |  Nullable |
| `related_transaction_id` | `uuid` |  Nullable |
| `reward_id` | `uuid` |  Nullable |
| `created_by` | `uuid` |  Nullable |

## Table `otp_codes`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `phone` | `text` |  |
| `store_id` | `uuid` |  |
| `code` | `text` |  |
| `expires_at` | `timestamptz` |  |
| `created_at` | `timestamptz` |  |
| `attempts` | `int4` |  Nullable |
| `used` | `bool` |  Nullable |
| `purpose` | `text` |  |
| `verified_at` | `timestamptz` |  Nullable |
| `consumed_at` | `timestamptz` |  Nullable |
| `metadata` | `jsonb` |  |

## Table `customer_addresses`

Stores delivery addresses for customers.

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `customer_id` | `uuid` |  |
| `zip_code` | `text` |  |
| `street` | `text` |  |
| `number` | `text` |  |
| `complement` | `text` |  Nullable |
| `district` | `text` |  |
| `city` | `text` |  |
| `state` | `text` |  |
| `is_default` | `bool` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `customer_notifications`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `customer_id` | `uuid` |  |
| `store_id` | `uuid` |  |
| `title` | `text` |  |
| `message` | `text` |  |
| `type` | `text` |  Nullable |
| `read` | `bool` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `customer_consent_logs`

Audit trail for customer consents (LGPD compliance).

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `customer_id` | `uuid` |  |
| `consent_type` | `text` |  |
| `action` | `text` |  |
| `ip_address` | `text` |  Nullable |
| `user_agent` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `fidelity_programs`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `store_id` | `uuid` |  Unique |
| `name` | `text` |  |
| `is_active` | `bool` |  Nullable |
| `points_per_currency` | `numeric` |  Nullable |
| `min_order_value` | `numeric` |  Nullable |
| `enable_join_bonus` | `bool` |  Nullable |
| `join_bonus_points` | `int4` |  Nullable |
| `enable_birthday_bonus` | `bool` |  Nullable |
| `birthday_bonus_points` | `int4` |  Nullable |
| `enable_cashback` | `bool` |  Nullable |
| `points_validity_months` | `int4` |  Nullable |
| `min_points_redemption` | `int4` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |
| `enable_stamps` | `bool` |  Nullable |
| `min_order_for_stamp` | `numeric` |  Nullable |
| `stamps_target` | `int4` |  Nullable |
| `points_per_stamp_block` | `int4` |  Nullable |
| `warn_voucher_expiry_1` | `int4` |  Nullable |
| `warn_voucher_expiry_2` | `int4` |  Nullable |
| `warn_voucher_expiry_3` | `int4` |  Nullable |
| `program_terms` | `text` |  Nullable |
| `voucher_terms` | `text` |  Nullable |

## Table `fidelity_rewards`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `program_id` | `uuid` |  |
| `title` | `text` |  |
| `description` | `text` |  Nullable |
| `points_cost` | `int4` |  |
| `type` | `text` |  |
| `discount_amount` | `numeric` |  Nullable |
| `max_redemptions_per_customer` | `int4` |  Nullable |
| `is_active` | `bool` |  Nullable |
| `created_at` | `timestamptz` |  |
| `stock_quantity` | `int4` |  Nullable |
| `voucher_validity_days` | `int4` |  Nullable |
| `image_url` | `text` |  Nullable |
| `additional_cash_cost` | `numeric` |  Nullable |
| `offer_valid_until` | `timestamptz` |  Nullable |
| `product_id` | `uuid` |  Nullable |
| `product_quantity` | `int4` |  Nullable |
| `discount_percentage` | `numeric` |  Nullable |
| `max_discount_value` | `numeric` |  Nullable |
| `min_order_value` | `numeric` |  Nullable |

## Table `fidelity_tiers`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `store_id` | `uuid` |  |
| `name` | `text` |  |
| `min_points` | `int4` |  |
| `multiplier` | `numeric` |  |
| `color` | `text` |  |
| `icon_url` | `text` |  Nullable |
| `position` | `int4` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `fidelity_vouchers`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `store_id` | `uuid` |  |
| `customer_id` | `uuid` |  |
| `reward_id` | `uuid` |  Nullable |
| `code` | `text` |  |
| `status` | `text` |  |
| `expires_at` | `timestamptz` |  |
| `used_at` | `timestamptz` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `customer_otps`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `phone` | `text` |  |
| `store_id` | `uuid` |  |
| `otp_code` | `text` |  |
| `expires_at` | `timestamptz` |  |
| `created_at` | `timestamptz` |  Nullable |
| `verified` | `bool` |  Nullable |
| `otp_hash` | `text` |  Nullable |
| `attempts` | `int4` |  |
| `used` | `bool` |  |
| `last_sent_at` | `timestamptz` |  Nullable |
| `purpose` | `text` |  |
| `verified_at` | `timestamptz` |  Nullable |
| `consumed_at` | `timestamptz` |  Nullable |
| `metadata` | `jsonb` |  |

## Table `store_messages`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `store_id` | `uuid` |  |
| `title` | `text` |  |
| `message` | `text` |  |
| `created_at` | `timestamptz` |  Nullable |
| `expires_at` | `timestamptz` |  Nullable |

## Table `stock_movements`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `product_id` | `uuid` |  |
| `order_id` | `uuid` |  Nullable |
| `quantity` | `int4` |  |
| `type` | `stock_movement_type` |  |
| `reason` | `text` |  Nullable |
| `user_id` | `uuid` |  Nullable |
| `previous_stock` | `int4` |  |
| `new_stock` | `int4` |  |
| `created_at` | `timestamptz` |  |
| `store_id` | `uuid` |  |
| `affects_physical` | `bool` |  |
| `source` | `text` |  Nullable |
| `source_id` | `uuid` |  Nullable |
| `reason_code` | `text` |  Nullable |
| `metadata` | `jsonb` |  |
| `created_by` | `uuid` |  Nullable |
| `supplier_id` | `uuid` |  Nullable |
| `location_id` | `uuid` |  Nullable |
| `from_location_id` | `uuid` |  Nullable |
| `to_location_id` | `uuid` |  Nullable |
| `transfer_id` | `uuid` |  Nullable |

## Table `inventory_movements`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `store_id` | `uuid` |  |
| `product_id` | `uuid` |  |
| `variant_id` | `uuid` |  Nullable |
| `type` | `inventory_move_type` |  |
| `quantity` | `numeric` |  |
| `reason` | `text` |  Nullable |
| `reference` | `text` |  Nullable |
| `order_id` | `uuid` |  Nullable |
| `order_item_id` | `uuid` |  Nullable |
| `created_by` | `uuid` |  Nullable |
| `created_by_email` | `text` |  Nullable |
| `meta` | `jsonb` |  |
| `created_at` | `timestamptz` |  |

## Table `inventory_balances`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `store_id` | `uuid` |  |
| `product_id` | `uuid` |  |
| `variant_id` | `uuid` |  Nullable |
| `on_hand` | `numeric` |  |
| `reserved` | `numeric` |  |
| `updated_at` | `timestamptz` |  |

## Table `audit_logs`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `store_id` | `uuid` |  Nullable |
| `user_id` | `uuid` |  Nullable |
| `action` | `text` |  |
| `entity` | `text` |  Nullable |
| `entity_id` | `uuid` |  Nullable |
| `old_data` | `jsonb` |  Nullable |
| `new_data` | `jsonb` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `suppliers`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  Nullable |
| `store_id` | `uuid` |  |
| `name` | `text` |  |
| `document` | `text` |  Nullable |
| `phone` | `text` |  Nullable |
| `email` | `text` |  Nullable |
| `notes` | `text` |  Nullable |
| `active` | `bool` |  |
| `legal_name` | `text` |  Nullable |
| `trade_name` | `text` |  Nullable |
| `person_type` | `text` |  Nullable |
| `state_registration` | `text` |  Nullable |
| `municipal_registration` | `text` |  Nullable |
| `tax_regime` | `text` |  Nullable |
| `cnae_code` | `text` |  Nullable |
| `icms_taxpayer_indicator` | `text` |  Nullable |
| `fiscal_notes` | `text` |  Nullable |
| `commercial_contact_name` | `text` |  Nullable |
| `commercial_contact_role` | `text` |  Nullable |
| `commercial_phone` | `text` |  Nullable |
| `commercial_whatsapp` | `text` |  Nullable |
| `commercial_email` | `text` |  Nullable |
| `financial_contact_name` | `text` |  Nullable |
| `financial_phone` | `text` |  Nullable |
| `financial_email` | `text` |  Nullable |
| `fiscal_contact_name` | `text` |  Nullable |
| `fiscal_phone` | `text` |  Nullable |
| `fiscal_email` | `text` |  Nullable |
| `secondary_phone` | `text` |  Nullable |
| `website` | `text` |  Nullable |
| `service_hours` | `jsonb` |  |
| `address` | `jsonb` |  |
| `billing_address` | `jsonb` |  |
| `shipping_address` | `jsonb` |  |
| `payment_terms` | `text` |  Nullable |
| `average_payment_days` | `int4` |  Nullable |
| `credit_limit` | `numeric` |  |
| `bank_info` | `jsonb` |  |
| `pix_key` | `text` |  Nullable |
| `pix_key_type` | `text` |  Nullable |
| `beneficiary_name` | `text` |  Nullable |
| `minimum_order_value` | `numeric` |  |
| `freight_policy` | `text` |  Nullable |
| `delivery_days` | `int4` |  Nullable |
| `lead_time_days` | `int4` |  Nullable |
| `purchase_frequency` | `text` |  Nullable |
| `commercial_terms` | `text` |  Nullable |
| `homologation_status` | `text` |  |
| `preferred_supplier` | `bool` |  |
| `blocked` | `bool` |  |
| `blocked_reason` | `text` |  Nullable |
| `blocked_at` | `timestamptz` |  Nullable |
| `last_contact_at` | `timestamptz` |  Nullable |
| `relationship_notes` | `text` |  Nullable |
| `tags` | `_text` |  |
| `metadata` | `jsonb` |  |

## Table `purchase_documents`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `created_at` | `timestamptz` |  |
| `store_id` | `uuid` |  |
| `supplier_id` | `uuid` |  |
| `invoice_number` | `text` |  Nullable |
| `issue_date` | `date` |  Nullable |
| `total_amount` | `numeric` |  Nullable |
| `notes` | `text` |  Nullable |
| `status` | `text` |  |
| `cancelled_at` | `timestamptz` |  Nullable |
| `cancelled_by` | `uuid` |  Nullable |
| `cancel_reason` | `text` |  Nullable |
| `document_code` | `text` |  Nullable |

## Table `purchase_document_items`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `purchase_document_id` | `uuid` |  |
| `product_id` | `uuid` |  |
| `quantity` | `numeric` |  |
| `unit_cost` | `numeric` |  |
| `total_cost` | `numeric` |  Nullable |
| `store_id` | `uuid` |  |

## Table `user_pins`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `user_id` | `uuid` | Primary |
| `pin_hash` | `text` |  |
| `updated_at` | `timestamptz` |  |

## Table `supplier_price_history`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `store_id` | `uuid` |  |
| `supplier_id` | `uuid` |  |
| `product_id` | `uuid` |  |
| `purchase_document_id` | `uuid` |  Nullable |
| `purchase_document_item_id` | `uuid` |  Nullable |
| `unit_cost` | `numeric` |  |
| `quantity` | `numeric` |  |
| `total_cost` | `numeric` |  Nullable |
| `issue_date` | `date` |  Nullable |
| `effective_at` | `timestamptz` |  |
| `source` | `text` |  |
| `metadata` | `jsonb` |  |
| `created_at` | `timestamptz` |  |
| `is_active` | `bool` |  |
| `cancelled_at` | `timestamptz` |  Nullable |
| `cancelled_reason` | `text` |  Nullable |

## Table `stock_locations`

Locais internos de estoque por store. Ex.: Estoque Principal, Loja, Avaria, Em Trânsito.

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `store_id` | `uuid` |  |
| `code` | `text` |  |
| `name` | `text` |  |
| `type` | `stock_location_type` |  |
| `description` | `text` |  Nullable |
| `active` | `bool` |  |
| `is_default` | `bool` |  |
| `allow_sales` | `bool` |  |
| `allow_reservations` | `bool` |  |
| `sort_order` | `int4` |  |
| `metadata` | `jsonb` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `inventory_location_balances`

Saldo por local de estoque e por produto/variante. Base do multiestoque.

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `store_id` | `uuid` |  |
| `location_id` | `uuid` |  |
| `product_id` | `uuid` |  |
| `variant_id` | `uuid` |  Nullable |
| `on_hand` | `numeric` |  |
| `reserved` | `numeric` |  |
| `updated_at` | `timestamptz` |  |

## Table `stock_transfers`

Cabeçalho de transferências internas de estoque entre locais da mesma store.

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `store_id` | `uuid` |  |
| `source_store_id` | `uuid` |  |
| `destination_store_id` | `uuid` |  |
| `source_location_id` | `uuid` |  |
| `destination_location_id` | `uuid` |  |
| `status` | `stock_transfer_status` |  |
| `transfer_code` | `text` |  Nullable |
| `requested_by` | `uuid` |  Nullable |
| `approved_by` | `uuid` |  Nullable |
| `shipped_by` | `uuid` |  Nullable |
| `received_by` | `uuid` |  Nullable |
| `requested_at` | `timestamptz` |  |
| `approved_at` | `timestamptz` |  Nullable |
| `shipped_at` | `timestamptz` |  Nullable |
| `received_at` | `timestamptz` |  Nullable |
| `cancelled_at` | `timestamptz` |  Nullable |
| `notes` | `text` |  Nullable |
| `cancel_reason` | `text` |  Nullable |
| `metadata` | `jsonb` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `stock_transfer_items`

Itens da transferência com quantidades solicitadas, expedidas, recebidas e divergência.

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `transfer_id` | `uuid` |  |
| `store_id` | `uuid` |  |
| `product_id` | `uuid` |  |
| `variant_id` | `uuid` |  Nullable |
| `requested_qty` | `numeric` |  |
| `shipped_qty` | `numeric` |  |
| `received_qty` | `numeric` |  |
| `divergence_qty` | `numeric` |  |
| `unit_cost` | `numeric` |  Nullable |
| `notes` | `text` |  Nullable |
| `metadata` | `jsonb` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |
| `divergence_resolution` | `text` |  Nullable |
| `divergence_reason` | `text` |  Nullable |
| `divergence_notes` | `text` |  Nullable |
| `loss_qty` | `numeric` |  |
| `returned_to_origin_qty` | `numeric` |  |
| `accepted_shortage_qty` | `numeric` |  |
| `divergence_resolved_at` | `timestamptz` |  Nullable |

## Table `supplier_contacts`

Contatos múltiplos do fornecedor por área: comercial, financeiro, fiscal, logística, suporte ou outros.

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `store_id` | `uuid` |  |
| `supplier_id` | `uuid` |  |
| `name` | `text` |  |
| `role` | `text` |  Nullable |
| `department` | `text` |  |
| `phone` | `text` |  Nullable |
| `whatsapp` | `text` |  Nullable |
| `email` | `text` |  Nullable |
| `notes` | `text` |  Nullable |
| `is_primary` | `bool` |  |
| `active` | `bool` |  |
| `metadata` | `jsonb` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `supplier_relationship_events`

Linha do tempo do relacionamento com fornecedores: observações, contatos, incidentes, bloqueios, negociações e homologações.

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `store_id` | `uuid` |  |
| `supplier_id` | `uuid` |  |
| `event_type` | `text` |  |
| `title` | `text` |  |
| `description` | `text` |  Nullable |
| `event_at` | `timestamptz` |  |
| `severity` | `text` |  |
| `status` | `text` |  |
| `related_purchase_document_id` | `uuid` |  Nullable |
| `related_product_id` | `uuid` |  Nullable |
| `created_by` | `uuid` |  Nullable |
| `created_by_email` | `text` |  Nullable |
| `metadata` | `jsonb` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `purchase_document_location_applications`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `purchase_document_id` | `uuid` |  |
| `purchase_document_item_id` | `uuid` |  Unique |
| `store_id` | `uuid` |  |
| `supplier_id` | `uuid` |  |
| `location_id` | `uuid` |  |
| `product_id` | `uuid` |  |
| `quantity` | `numeric` |  |
| `unit_cost` | `numeric` |  |
| `applied_at` | `timestamptz` |  |
| `metadata` | `jsonb` |  |

## Table `purchase_quotations`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `store_id` | `uuid` |  |
| `supplier_id` | `uuid` |  |
| `quotation_code` | `text` |  |
| `status` | `text` |  |
| `requested_at` | `timestamptz` |  |
| `responded_at` | `timestamptz` |  Nullable |
| `expires_at` | `timestamptz` |  Nullable |
| `sent_channel` | `text` |  Nullable |
| `responsible_name` | `text` |  Nullable |
| `message_subject` | `text` |  Nullable |
| `message_body` | `text` |  Nullable |
| `notes` | `text` |  Nullable |
| `metadata` | `jsonb` |  |
| `created_by` | `uuid` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |
| `converted_purchase_document_id` | `uuid` |  Nullable |

## Table `purchase_quotation_items`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `quotation_id` | `uuid` |  |
| `store_id` | `uuid` |  |
| `product_id` | `uuid` |  |
| `requested_qty` | `numeric` |  |
| `reference_unit_cost` | `numeric` |  Nullable |
| `quoted_unit_cost` | `numeric` |  Nullable |
| `approved_qty` | `numeric` |  Nullable |
| `notes` | `text` |  Nullable |
| `supplier_notes` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `operational_timeline_events`

Linha do tempo operacional amigável para telas e processos. Não substitui audit_logs; complementa a auditoria técnica com eventos de negócio.

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `store_id` | `uuid` |  |
| `entity_type` | `text` |  |
| `entity_id` | `uuid` |  |
| `event_type` | `text` |  |
| `title` | `text` |  |
| `description` | `text` |  Nullable |
| `severity` | `text` |  |
| `status` | `text` |  |
| `actor_user_id` | `uuid` |  Nullable |
| `actor_email` | `text` |  Nullable |
| `responsible_name` | `text` |  Nullable |
| `channel` | `text` |  Nullable |
| `occurred_at` | `timestamptz` |  |
| `source` | `text` |  |
| `source_id` | `uuid` |  Nullable |
| `old_data` | `jsonb` |  |
| `new_data` | `jsonb` |  |
| `metadata` | `jsonb` |  |
| `related_supplier_id` | `uuid` |  Nullable |
| `related_product_id` | `uuid` |  Nullable |
| `related_purchase_quotation_id` | `uuid` |  Nullable |
| `related_purchase_document_id` | `uuid` |  Nullable |
| `related_stock_transfer_id` | `uuid` |  Nullable |
| `related_stock_movement_id` | `uuid` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `store_sales_channels`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `store_id` | `uuid` |  |
| `code` | `text` |  |
| `name` | `text` |  |
| `description` | `text` |  Nullable |
| `active` | `bool` |  |
| `public_enabled` | `bool` |  |
| `sort_order` | `int4` |  |
| `icon` | `text` |  Nullable |
| `color` | `text` |  Nullable |
| `requires_customer` | `bool` |  |
| `requires_address` | `bool` |  |
| `requires_table` | `bool` |  |
| `metadata` | `jsonb` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `store_payment_methods`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `store_id` | `uuid` |  |
| `code` | `text` |  |
| `name` | `text` |  |
| `description` | `text` |  Nullable |
| `active` | `bool` |  |
| `public_enabled` | `bool` |  |
| `sort_order` | `int4` |  |
| `icon` | `text` |  Nullable |
| `color` | `text` |  Nullable |
| `requires_proof` | `bool` |  |
| `requires_change_for` | `bool` |  |
| `affects_cashbook` | `bool` |  |
| `metadata` | `jsonb` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `cashbook_entries`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `store_id` | `uuid` |  |
| `entry_code` | `text` |  Nullable |
| `entry_date` | `date` |  |
| `occurred_at` | `timestamptz` |  |
| `type` | `text` |  |
| `direction` | `text` |  |
| `amount` | `numeric` |  |
| `description` | `text` |  |
| `notes` | `text` |  Nullable |
| `payment_method` | `text` |  Nullable |
| `payment_method_code` | `text` |  Nullable |
| `source` | `text` |  |
| `source_id` | `uuid` |  Nullable |
| `order_id` | `uuid` |  Nullable |
| `customer_id` | `uuid` |  Nullable |
| `status` | `text` |  |
| `affects_balance` | `bool` |  |
| `metadata` | `jsonb` |  |
| `created_by` | `uuid` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `store_delivery_methods`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `store_id` | `uuid` |  |
| `code` | `text` |  |
| `name` | `text` |  |
| `description` | `text` |  Nullable |
| `active` | `bool` |  |
| `public_enabled` | `bool` |  |
| `sort_order` | `int4` |  |
| `icon` | `text` |  Nullable |
| `color` | `text` |  Nullable |
| `fulfillment_type` | `text` |  |
| `requires_address` | `bool` |  |
| `requires_table` | `bool` |  |
| `minimum_order_value` | `numeric` |  |
| `delivery_fee` | `numeric` |  |
| `estimated_minutes_min` | `int4` |  Nullable |
| `estimated_minutes_max` | `int4` |  Nullable |
| `affects_cashbook` | `bool` |  |
| `metadata` | `jsonb` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `product_stock_location_rules`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `store_id` | `uuid` |  |
| `product_id` | `uuid` |  |
| `location_id` | `uuid` |  |
| `min_stock` | `numeric` |  Nullable |
| `max_stock` | `numeric` |  Nullable |
| `min_percent` | `numeric` |  Nullable |
| `max_percent` | `numeric` |  Nullable |
| `use_percentage` | `bool` |  |
| `active` | `bool` |  |
| `metadata` | `jsonb` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `loyalty_point_rules`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `store_id` | `uuid` |  |
| `code` | `text` |  |
| `name` | `text` |  |
| `description` | `text` |  Nullable |
| `trigger_event` | `text` |  |
| `rule_type` | `text` |  |
| `points_mode` | `text` |  |
| `points_value` | `numeric` |  |
| `priority` | `int4` |  |
| `stackable` | `bool` |  |
| `active` | `bool` |  |
| `starts_at` | `timestamptz` |  Nullable |
| `ends_at` | `timestamptz` |  Nullable |
| `conditions` | `jsonb` |  |
| `metadata` | `jsonb` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `customer_benefit_rules`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `store_id` | `uuid` |  |
| `code` | `text` |  |
| `name` | `text` |  |
| `description` | `text` |  Nullable |
| `benefit_type` | `text` |  |
| `target_type` | `text` |  |
| `target_tier_id` | `uuid` |  Nullable |
| `target_customer_id` | `uuid` |  Nullable |
| `target_tag` | `text` |  Nullable |
| `discount_percent` | `numeric` |  Nullable |
| `discount_amount` | `numeric` |  Nullable |
| `bonus_points` | `int4` |  Nullable |
| `free_delivery` | `bool` |  |
| `minimum_order_value` | `numeric` |  |
| `max_uses_total` | `int4` |  Nullable |
| `max_uses_per_customer` | `int4` |  Nullable |
| `active` | `bool` |  |
| `starts_at` | `timestamptz` |  Nullable |
| `ends_at` | `timestamptz` |  Nullable |
| `conditions` | `jsonb` |  |
| `metadata` | `jsonb` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `customer_segments`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `store_id` | `uuid` |  |
| `code` | `text` |  |
| `name` | `text` |  |
| `description` | `text` |  Nullable |
| `segment_type` | `text` |  |
| `active` | `bool` |  |
| `rules` | `jsonb` |  |
| `metadata` | `jsonb` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `customer_segment_members`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `store_id` | `uuid` |  |
| `segment_id` | `uuid` |  |
| `customer_id` | `uuid` |  |
| `source` | `text` |  |
| `active` | `bool` |  |
| `added_at` | `timestamptz` |  |
| `removed_at` | `timestamptz` |  Nullable |
| `metadata` | `jsonb` |  |

## Table `promotion_campaigns`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `store_id` | `uuid` |  |
| `code` | `text` |  |
| `name` | `text` |  |
| `description` | `text` |  Nullable |
| `campaign_type` | `text` |  |
| `status` | `text` |  |
| `target_type` | `text` |  |
| `target_segment_id` | `uuid` |  Nullable |
| `target_customer_id` | `uuid` |  Nullable |
| `target_tag` | `text` |  Nullable |
| `channel` | `text` |  |
| `title` | `text` |  Nullable |
| `message_template` | `text` |  Nullable |
| `call_to_action` | `text` |  Nullable |
| `landing_url` | `text` |  Nullable |
| `benefit_rule_id` | `uuid` |  Nullable |
| `starts_at` | `timestamptz` |  Nullable |
| `ends_at` | `timestamptz` |  Nullable |
| `scheduled_at` | `timestamptz` |  Nullable |
| `sent_count` | `int4` |  |
| `delivered_count` | `int4` |  |
| `read_count` | `int4` |  |
| `clicked_count` | `int4` |  |
| `converted_count` | `int4` |  |
| `active` | `bool` |  |
| `conditions` | `jsonb` |  |
| `metadata` | `jsonb` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `promotion_campaign_recipients`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `store_id` | `uuid` |  |
| `campaign_id` | `uuid` |  |
| `customer_id` | `uuid` |  |
| `channel` | `text` |  |
| `recipient_name` | `text` |  Nullable |
| `recipient_phone` | `text` |  Nullable |
| `recipient_email` | `text` |  Nullable |
| `status` | `text` |  |
| `message_preview` | `text` |  Nullable |
| `external_message_id` | `text` |  Nullable |
| `sent_at` | `timestamptz` |  Nullable |
| `delivered_at` | `timestamptz` |  Nullable |
| `read_at` | `timestamptz` |  Nullable |
| `clicked_at` | `timestamptz` |  Nullable |
| `converted_at` | `timestamptz` |  Nullable |
| `metadata` | `jsonb` |  |
| `created_at` | `timestamptz` |  |

## Table `store_members`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `store_id` | `uuid` |  |
| `user_id` | `uuid` |  |
| `role` | `text` |  |
| `status` | `text` |  |
| `permissions` | `jsonb` |  |
| `sensitive_actions` | `jsonb` |  |
| `invited_by` | `uuid` |  Nullable |
| `invited_at` | `timestamptz` |  Nullable |
| `accepted_at` | `timestamptz` |  Nullable |
| `last_seen_at` | `timestamptz` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |
| `custom_role_id` | `uuid` |  Nullable |
| `internal_alias` | `text` |  Nullable |
| `job_title` | `text` |  Nullable |
| `department` | `text` |  Nullable |
| `internal_notes` | `text` |  Nullable |
| `started_at` | `timestamptz` |  Nullable |
| `ended_at` | `timestamptz` |  Nullable |
| `exit_reason` | `text` |  Nullable |
| `status_reason` | `text` |  Nullable |
| `member_avatar_url` | `text` |  Nullable |
| `member_email` | `text` |  Nullable |
| `member_phone` | `text` |  Nullable |
| `member_mobile_phone` | `text` |  Nullable |
| `member_whatsapp_phone` | `text` |  Nullable |
| `member_zip_code` | `text` |  Nullable |
| `member_address` | `text` |  Nullable |
| `member_address_number` | `text` |  Nullable |
| `member_complement` | `text` |  Nullable |
| `member_district` | `text` |  Nullable |
| `member_city` | `text` |  Nullable |
| `member_state` | `text` |  Nullable |
| `onboarding_completed_at` | `timestamptz` |  Nullable |
| `onboarding_required` | `bool` |  Nullable |
| `member_additional_info` | `jsonb` |  |

## Table `security_permission_catalog`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `code` | `text` | Primary |
| `module` | `text` |  |
| `action` | `text` |  |
| `label` | `text` |  |
| `description` | `text` |  Nullable |
| `risk_level` | `text` |  |
| `active` | `bool` |  |
| `sort_order` | `int4` |  |
| `created_at` | `timestamptz` |  |
| `macro_group` | `text` |  Nullable |
| `group_key` | `text` |  Nullable |
| `group_label` | `text` |  Nullable |
| `item_key` | `text` |  Nullable |
| `item_label` | `text` |  Nullable |
| `action_key` | `text` |  Nullable |
| `action_label` | `text` |  Nullable |
| `depends_on` | `text` |  Nullable |
| `access_permission_key` | `text` |  Nullable |
| `default_role_allowed` | `jsonb` |  |
| `ui_sort_order` | `int4` |  Nullable |
| `show_in_permission_ui` | `bool` |  |
| `updated_at` | `timestamptz` |  Nullable |

## Table `security_sensitive_action_catalog`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `code` | `text` | Primary |
| `module` | `text` |  |
| `label` | `text` |  |
| `description` | `text` |  Nullable |
| `default_requirement` | `text` |  |
| `default_min_role` | `text` |  |
| `default_token_enabled` | `bool` |  |
| `default_require_reason` | `bool` |  |
| `risk_level` | `text` |  |
| `active` | `bool` |  |
| `sort_order` | `int4` |  |
| `created_at` | `timestamptz` |  |

## Table `store_role_permission_templates`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `store_id` | `uuid` |  |
| `role` | `text` |  |
| `permission_code` | `text` |  |
| `allowed` | `bool` |  |
| `source` | `text` |  |
| `metadata` | `jsonb` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `store_sensitive_action_rules`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `store_id` | `uuid` |  |
| `action_code` | `text` |  |
| `enabled` | `bool` |  |
| `requirement` | `text` |  |
| `min_role` | `text` |  |
| `token_enabled` | `bool` |  |
| `token_expiry_seconds` | `int4` |  |
| `max_attempts` | `int4` |  |
| `require_reason` | `bool` |  |
| `source` | `text` |  |
| `metadata` | `jsonb` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `store_member_private_details`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `store_id` | `uuid` |  |
| `member_id` | `uuid` |  Unique |
| `user_id` | `uuid` |  |
| `nickname` | `text` |  Nullable |
| `address` | `jsonb` |  |
| `started_at` | `date` |  Nullable |
| `ended_at` | `date` |  Nullable |
| `exit_reason` | `text` |  Nullable |
| `internal_notes` | `text` |  Nullable |
| `metadata` | `jsonb` |  |
| `created_by` | `uuid` |  Nullable |
| `updated_by` | `uuid` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `store_member_occurrences`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `store_id` | `uuid` |  |
| `member_id` | `uuid` |  |
| `user_id` | `uuid` |  |
| `occurrence_type` | `text` |  |
| `severity` | `text` |  |
| `title` | `text` |  |
| `description` | `text` |  Nullable |
| `occurred_at` | `timestamptz` |  |
| `visible_to_member` | `bool` |  |
| `created_by` | `uuid` |  Nullable |
| `created_by_email` | `text` |  Nullable |
| `metadata` | `jsonb` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `store_member_invites`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `store_id` | `uuid` |  |
| `email` | `text` |  |
| `normalized_email` | `text` |  Nullable |
| `role` | `text` |  |
| `status` | `text` |  |
| `invited_by` | `uuid` |  Nullable |
| `invited_by_email` | `text` |  Nullable |
| `invited_at` | `timestamptz` |  |
| `accepted_at` | `timestamptz` |  Nullable |
| `accepted_by` | `uuid` |  Nullable |
| `cancelled_at` | `timestamptz` |  Nullable |
| `cancelled_by` | `uuid` |  Nullable |
| `cancel_reason` | `text` |  Nullable |
| `expires_at` | `timestamptz` |  |
| `permissions` | `jsonb` |  |
| `sensitive_actions` | `jsonb` |  |
| `metadata` | `jsonb` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `store_custom_roles`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `store_id` | `uuid` |  |
| `name` | `text` |  |
| `description` | `text` |  Nullable |
| `base_role` | `text` |  |
| `active` | `bool` |  |
| `permissions` | `jsonb` |  |
| `sensitive_actions` | `jsonb` |  |
| `created_by` | `uuid` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `store_member_profile_change_requests`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `store_id` | `uuid` |  |
| `member_id` | `uuid` |  |
| `user_id` | `uuid` |  |
| `requested_by` | `uuid` |  Nullable |
| `requested_by_email` | `text` |  Nullable |
| `request_type` | `text` |  |
| `status` | `text` |  |
| `requested_changes` | `jsonb` |  |
| `current_snapshot` | `jsonb` |  |
| `reason` | `text` |  |
| `admin_notes` | `text` |  Nullable |
| `reviewed_by` | `uuid` |  Nullable |
| `reviewed_by_email` | `text` |  Nullable |
| `reviewed_at` | `timestamptz` |  Nullable |
| `applied_at` | `timestamptz` |  Nullable |
| `visible_to_member` | `bool` |  |
| `sensitive` | `bool` |  |
| `metadata` | `jsonb` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |
| `admin_proposed_changes` | `jsonb` |  |
| `proposed_by` | `uuid` |  Nullable |
| `proposed_by_email` | `text` |  Nullable |
| `proposed_at` | `timestamptz` |  Nullable |
| `member_feedback` | `text` |  Nullable |
| `member_responded_at` | `timestamptz` |  Nullable |
| `applied_changes` | `jsonb` |  |

## Table `store_security_settings`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `store_id` | `uuid` | Primary |
| `idle_timeout_minutes` | `int4` |  |
| `idle_timeout_enabled` | `bool` |  |
| `idle_timeout_exempt_routes` | `_text` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `store_permission_catalog`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `permission_key` | `text` | Primary |
| `category` | `text` |  |
| `label` | `text` |  |
| `description` | `text` |  Nullable |
| `risk` | `text` |  |
| `active` | `bool` |  |
| `sort_order` | `int4` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |
| `macro_group` | `text` |  Nullable |
| `group_key` | `text` |  Nullable |
| `group_label` | `text` |  Nullable |
| `item_key` | `text` |  Nullable |
| `item_label` | `text` |  Nullable |
| `action_key` | `text` |  Nullable |
| `action_label` | `text` |  Nullable |
| `depends_on` | `text` |  Nullable |
| `access_permission_key` | `text` |  Nullable |
| `default_role_allowed` | `jsonb` |  |
| `ui_sort_order` | `int4` |  Nullable |
| `show_in_permission_ui` | `bool` |  |

## Table `store_settings`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `store_id` | `uuid` | Primary |
| `commercial_settings` | `jsonb` |  |
| `order_settings` | `jsonb` |  |
| `stock_settings` | `jsonb` |  |
| `delivery_settings` | `jsonb` |  |
| `payment_settings` | `jsonb` |  |
| `legal_settings` | `jsonb` |  |
| `system_settings` | `jsonb` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `store_role_permission_templates_backup_910c`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` |  Nullable |
| `store_id` | `uuid` |  Nullable |
| `role` | `text` |  Nullable |
| `permission_code` | `text` |  Nullable |
| `allowed` | `bool` |  Nullable |
| `source` | `text` |  Nullable |
| `metadata` | `jsonb` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |
| `backup_created_at` | `timestamptz` |  Nullable |

## Table `store_permission_versions`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `store_id` | `uuid` | Primary |
| `version` | `int8` |  |
| `reason` | `text` |  Nullable |
| `changed_by` | `uuid` |  Nullable |
| `changed_at` | `timestamptz` |  |

