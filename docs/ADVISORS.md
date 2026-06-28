SEMPRE DESCONSIDERE O AVISO Leaked Password Protection Disabled.

[
  {
    "name": "anon_security_definer_function_executable",
    "title": "Public Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable without signing in. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if it is not meant to be public.",
    "detail": "Function `public.create_public_order_by_slug(p_slug text, p_customer_name text, p_customer_phone text, p_fulfillment_type text, p_sales_channel text, p_items jsonb, p_delivery_address jsonb, p_table_code text, p_notes text, p_payment_method_code text, p_delivery_method_code text)` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/create_public_order_by_slug`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable",
    "metadata": {
      "name": "create_public_order_by_slug",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_slug text, p_customer_name text, p_customer_phone text, p_fulfillment_type text, p_sales_channel text, p_items jsonb, p_delivery_address jsonb, p_table_code text, p_notes text, p_payment_method_code text, p_delivery_method_code text",
      "security_definer": true
    },
    "cache_key": "anon_security_definer_function_executable_public_create_public_order_by_slug_p_slug text, p_customer_name text, p_customer_phone text, p_fulfillment_type text, p_sales_channel text, p_items jsonb, p_delivery_address jsonb, p_table_code text, p_notes text, p_payment_method_code text, p_delivery_method_code text"
  },
  {
    "name": "anon_security_definer_function_executable",
    "title": "Public Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable without signing in. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if it is not meant to be public.",
    "detail": "Function `public.customer_login_with_password(p_phone text, p_password text, p_store_id uuid)` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/customer_login_with_password`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable",
    "metadata": {
      "name": "customer_login_with_password",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_phone text, p_password text, p_store_id uuid",
      "security_definer": true
    },
    "cache_key": "anon_security_definer_function_executable_public_customer_login_with_password_p_phone text, p_password text, p_store_id uuid"
  },
  {
    "name": "anon_security_definer_function_executable",
    "title": "Public Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable without signing in. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if it is not meant to be public.",
    "detail": "Function `public.get_public_catalog_by_slug(p_slug text)` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_public_catalog_by_slug`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable",
    "metadata": {
      "name": "get_public_catalog_by_slug",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_slug text",
      "security_definer": true
    },
    "cache_key": "anon_security_definer_function_executable_public_get_public_catalog_by_slug_p_slug text"
  },
  {
    "name": "anon_security_definer_function_executable",
    "title": "Public Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable without signing in. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if it is not meant to be public.",
    "detail": "Function `public.get_public_customer_loyalty_by_phone(p_slug text, p_phone text)` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_public_customer_loyalty_by_phone`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable",
    "metadata": {
      "name": "get_public_customer_loyalty_by_phone",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_slug text, p_phone text",
      "security_definer": true
    },
    "cache_key": "anon_security_definer_function_executable_public_get_public_customer_loyalty_by_phone_p_slug text, p_phone text"
  },
  {
    "name": "anon_security_definer_function_executable",
    "title": "Public Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable without signing in. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if it is not meant to be public.",
    "detail": "Function `public.get_public_delivery_methods_by_slug(p_slug text)` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_public_delivery_methods_by_slug`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable",
    "metadata": {
      "name": "get_public_delivery_methods_by_slug",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_slug text",
      "security_definer": true
    },
    "cache_key": "anon_security_definer_function_executable_public_get_public_delivery_methods_by_slug_p_slug text"
  },
  {
    "name": "anon_security_definer_function_executable",
    "title": "Public Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable without signing in. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if it is not meant to be public.",
    "detail": "Function `public.get_public_payment_methods_by_slug(p_slug text)` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_public_payment_methods_by_slug`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable",
    "metadata": {
      "name": "get_public_payment_methods_by_slug",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_slug text",
      "security_definer": true
    },
    "cache_key": "anon_security_definer_function_executable_public_get_public_payment_methods_by_slug_p_slug text"
  },
  {
    "name": "anon_security_definer_function_executable",
    "title": "Public Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable without signing in. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if it is not meant to be public.",
    "detail": "Function `public.get_public_sales_channels_by_slug(p_slug text)` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_public_sales_channels_by_slug`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable",
    "metadata": {
      "name": "get_public_sales_channels_by_slug",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_slug text",
      "security_definer": true
    },
    "cache_key": "anon_security_definer_function_executable_public_get_public_sales_channels_by_slug_p_slug text"
  },
  {
    "name": "anon_security_definer_function_executable",
    "title": "Public Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable without signing in. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if it is not meant to be public.",
    "detail": "Function `public.get_public_storefront_by_slug(p_slug text)` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_public_storefront_by_slug`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable",
    "metadata": {
      "name": "get_public_storefront_by_slug",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_slug text",
      "security_definer": true
    },
    "cache_key": "anon_security_definer_function_executable_public_get_public_storefront_by_slug_p_slug text"
  },
  {
    "name": "anon_security_definer_function_executable",
    "title": "Public Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable without signing in. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if it is not meant to be public.",
    "detail": "Function `public.get_store_by_slug(p_slug text)` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_store_by_slug`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable",
    "metadata": {
      "name": "get_store_by_slug",
      "schema": "public",
      "language": "sql",
      "arguments": "p_slug text",
      "security_definer": true
    },
    "cache_key": "anon_security_definer_function_executable_public_get_store_by_slug_p_slug text"
  },
  {
    "name": "anon_security_definer_function_executable",
    "title": "Public Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable without signing in. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if it is not meant to be public.",
    "detail": "Function `public.send_customer_otp(p_phone text, p_store_id uuid)` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/send_customer_otp`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable",
    "metadata": {
      "name": "send_customer_otp",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_phone text, p_store_id uuid",
      "security_definer": true
    },
    "cache_key": "anon_security_definer_function_executable_public_send_customer_otp_p_phone text, p_store_id uuid"
  },
  {
    "name": "anon_security_definer_function_executable",
    "title": "Public Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable without signing in. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if it is not meant to be public.",
    "detail": "Function `public.verify_customer_otp(p_phone text, p_otp text, p_store_id uuid)` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/verify_customer_otp`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable",
    "metadata": {
      "name": "verify_customer_otp",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_phone text, p_otp text, p_store_id uuid",
      "security_definer": true
    },
    "cache_key": "anon_security_definer_function_executable_public_verify_customer_otp_p_phone text, p_otp text, p_store_id uuid"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.accept_store_member_invite(p_store_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/accept_store_member_invite`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "accept_store_member_invite",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_accept_store_member_invite_p_store_id uuid"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.adjust_stock_to_physical_count(p_product_id uuid, p_location_id uuid, p_counted_quantity numeric, p_reason text, p_notes text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/adjust_stock_to_physical_count`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "adjust_stock_to_physical_count",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_product_id uuid, p_location_id uuid, p_counted_quantity numeric, p_reason text, p_notes text",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_adjust_stock_to_physical_count_p_product_id uuid, p_location_id uuid, p_counted_quantity numeric, p_reason text, p_notes text"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.admin_cancel_public_order_safe(p_order_id uuid, p_reason text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/admin_cancel_public_order_safe`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "admin_cancel_public_order_safe",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_order_id uuid, p_reason text",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_admin_cancel_public_order_safe_p_order_id uuid, p_reason text"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.admin_complete_public_order_safe(p_order_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/admin_complete_public_order_safe`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "admin_complete_public_order_safe",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_order_id uuid",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_admin_complete_public_order_safe_p_order_id uuid"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.app_current_store_role(p_store_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/app_current_store_role`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "app_current_store_role",
      "schema": "public",
      "language": "sql",
      "arguments": "p_store_id uuid",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_app_current_store_role_p_store_id uuid"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.app_is_store_owner(p_store_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/app_is_store_owner`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "app_is_store_owner",
      "schema": "public",
      "language": "sql",
      "arguments": "p_store_id uuid",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_app_is_store_owner_p_store_id uuid"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.assign_store_custom_role_to_member(p_member_id uuid, p_custom_role_id uuid, p_reason text, p_clear_individual_overrides boolean, p_create_occurrence boolean)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/assign_store_custom_role_to_member`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "assign_store_custom_role_to_member",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_member_id uuid, p_custom_role_id uuid, p_reason text, p_clear_individual_overrides boolean, p_create_occurrence boolean",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_assign_store_custom_role_to_member_p_member_id uuid, p_custom_role_id uuid, p_reason text, p_clear_individual_overrides boolean, p_create_occurrence boolean"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.build_campaign_recipients_preview_safe(p_store_id uuid, p_campaign_id uuid, p_target_type text, p_target_segment_id uuid, p_target_customer_id uuid, p_target_tag text, p_channel text, p_limit integer)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/build_campaign_recipients_preview_safe`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "build_campaign_recipients_preview_safe",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid, p_campaign_id uuid, p_target_type text, p_target_segment_id uuid, p_target_customer_id uuid, p_target_tag text, p_channel text, p_limit integer",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_build_campaign_recipients_preview_safe_p_store_id uuid, p_campaign_id uuid, p_target_type text, p_target_segment_id uuid, p_target_customer_id uuid, p_target_tag text, p_channel text, p_limit integer"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.cancel_purchase_document(p_document_id uuid, p_reason text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/cancel_purchase_document`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "cancel_purchase_document",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_document_id uuid, p_reason text",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_cancel_purchase_document_p_document_id uuid, p_reason text"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.cancel_purchase_document(p_document_id uuid, p_reason text, p_master_password text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/cancel_purchase_document`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "cancel_purchase_document",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_document_id uuid, p_reason text, p_master_password text",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_cancel_purchase_document_p_document_id uuid, p_reason text, p_master_password text"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.cancel_stock_transfer(p_transfer_id uuid, p_cancel_reason text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/cancel_stock_transfer`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "cancel_stock_transfer",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_transfer_id uuid, p_cancel_reason text",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_cancel_stock_transfer_p_transfer_id uuid, p_cancel_reason text"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.cancel_store_member_invite(p_invite_id uuid, p_reason text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/cancel_store_member_invite`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "cancel_store_member_invite",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_invite_id uuid, p_reason text",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_cancel_store_member_invite_p_invite_id uuid, p_reason text"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.change_store_member_role(p_member_id uuid, p_new_role text, p_reason text, p_clear_individual_overrides boolean, p_create_occurrence boolean)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/change_store_member_role`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "change_store_member_role",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_member_id uuid, p_new_role text, p_reason text, p_clear_individual_overrides boolean, p_create_occurrence boolean",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_change_store_member_role_p_member_id uuid, p_new_role text, p_reason text, p_clear_individual_overrides boolean, p_create_occurrence boolean"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.cleanup_old_messages(p_store_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/cleanup_old_messages`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "cleanup_old_messages",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_cleanup_old_messages_p_store_id uuid"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.confirm_order_payment(p_order_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/confirm_order_payment`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "confirm_order_payment",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_order_id uuid",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_confirm_order_payment_p_order_id uuid"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.confirm_purchase_document(p_document_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/confirm_purchase_document`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "confirm_purchase_document",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_document_id uuid",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_confirm_purchase_document_p_document_id uuid"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.convert_purchase_quotation_to_draft(p_quotation_id uuid, p_notes text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/convert_purchase_quotation_to_draft`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "convert_purchase_quotation_to_draft",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_quotation_id uuid, p_notes text",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_convert_purchase_quotation_to_draft_p_quotation_id uuid, p_notes text"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.create_admin_customer_safe(p_store_id uuid, p_full_name text, p_phone text, p_email text, p_cpf text, p_birth_date date, p_tags text[], p_internal_notes text, p_marketing_consent boolean, p_loyalty_opt_in boolean)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/create_admin_customer_safe`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "create_admin_customer_safe",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid, p_full_name text, p_phone text, p_email text, p_cpf text, p_birth_date date, p_tags text[], p_internal_notes text, p_marketing_consent boolean, p_loyalty_opt_in boolean",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_create_admin_customer_safe_p_store_id uuid, p_full_name text, p_phone text, p_email text, p_cpf text, p_birth_date date, p_tags text[], p_internal_notes text, p_marketing_consent boolean, p_loyalty_opt_in boolean"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.create_cashbook_entry(p_store_id uuid, p_type text, p_direction text, p_amount numeric, p_description text, p_payment_method_code text, p_notes text, p_occurred_at timestamp with time zone, p_metadata jsonb)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/create_cashbook_entry`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "create_cashbook_entry",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid, p_type text, p_direction text, p_amount numeric, p_description text, p_payment_method_code text, p_notes text, p_occurred_at timestamp with time zone, p_metadata jsonb",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_create_cashbook_entry_p_store_id uuid, p_type text, p_direction text, p_amount numeric, p_description text, p_payment_method_code text, p_notes text, p_occurred_at timestamp with time zone, p_metadata jsonb"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.create_manual_stock_adjustment(p_product_id uuid, p_location_id uuid, p_adjustment_kind text, p_quantity numeric, p_reason text, p_notes text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/create_manual_stock_adjustment`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "create_manual_stock_adjustment",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_product_id uuid, p_location_id uuid, p_adjustment_kind text, p_quantity numeric, p_reason text, p_notes text",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_create_manual_stock_adjustment_p_product_id uuid, p_location_id uuid, p_adjustment_kind text, p_quantity numeric, p_reason text, p_notes text"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.create_purchase_document_draft_batch(p_supplier_id uuid, p_items jsonb, p_notes text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/create_purchase_document_draft_batch`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "create_purchase_document_draft_batch",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_supplier_id uuid, p_items jsonb, p_notes text",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_create_purchase_document_draft_batch_p_supplier_id uuid, p_items jsonb, p_notes text"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.create_purchase_quotation(p_supplier_id uuid, p_items jsonb, p_message_subject text, p_message_body text, p_sent_channel text, p_responsible_name text, p_notes text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/create_purchase_quotation`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "create_purchase_quotation",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_supplier_id uuid, p_items jsonb, p_message_subject text, p_message_body text, p_sent_channel text, p_responsible_name text, p_notes text",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_create_purchase_quotation_p_supplier_id uuid, p_items jsonb, p_message_subject text, p_message_body text, p_sent_channel text, p_responsible_name text, p_notes text"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.create_stock_transfer_draft_batch(p_source_location_id uuid, p_destination_location_id uuid, p_items jsonb, p_notes text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/create_stock_transfer_draft_batch`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "create_stock_transfer_draft_batch",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_source_location_id uuid, p_destination_location_id uuid, p_items jsonb, p_notes text",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_create_stock_transfer_draft_batch_p_source_location_id uuid, p_destination_location_id uuid, p_items jsonb, p_notes text"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.create_stock_transfer_draft_from_suggestion(p_product_id uuid, p_source_location_id uuid, p_destination_location_id uuid, p_quantity numeric, p_notes text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/create_stock_transfer_draft_from_suggestion`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "create_stock_transfer_draft_from_suggestion",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_product_id uuid, p_source_location_id uuid, p_destination_location_id uuid, p_quantity numeric, p_notes text",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_create_stock_transfer_draft_from_suggestion_p_product_id uuid, p_source_location_id uuid, p_destination_location_id uuid, p_quantity numeric, p_notes text"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.create_store_custom_role(p_store_id uuid, p_name text, p_description text, p_base_role text, p_permissions jsonb, p_sensitive_actions jsonb)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/create_store_custom_role`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "create_store_custom_role",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid, p_name text, p_description text, p_base_role text, p_permissions jsonb, p_sensitive_actions jsonb",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_create_store_custom_role_p_store_id uuid, p_name text, p_description text, p_base_role text, p_permissions jsonb, p_sensitive_actions jsonb"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.create_store_member_invite(p_store_id uuid, p_email text, p_role text, p_permissions jsonb, p_sensitive_actions jsonb, p_expires_in_days integer)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/create_store_member_invite`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "create_store_member_invite",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid, p_email text, p_role text, p_permissions jsonb, p_sensitive_actions jsonb, p_expires_in_days integer",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_create_store_member_invite_p_store_id uuid, p_email text, p_role text, p_permissions jsonb, p_sensitive_actions jsonb, p_expires_in_days integer"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.create_store_member_occurrence_v2(p_member_id uuid, p_occurrence_type text, p_severity text, p_title text, p_description text, p_occurred_at timestamp with time zone, p_visible_to_member boolean, p_metadata jsonb)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/create_store_member_occurrence_v2`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "create_store_member_occurrence_v2",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_member_id uuid, p_occurrence_type text, p_severity text, p_title text, p_description text, p_occurred_at timestamp with time zone, p_visible_to_member boolean, p_metadata jsonb",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_create_store_member_occurrence_v2_p_member_id uuid, p_occurrence_type text, p_severity text, p_title text, p_description text, p_occurred_at timestamp with time zone, p_visible_to_member boolean, p_metadata jsonb"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.decline_my_store_member_invite(p_invite_id uuid, p_reason text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/decline_my_store_member_invite`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "decline_my_store_member_invite",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_invite_id uuid, p_reason text",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_decline_my_store_member_invite_p_invite_id uuid, p_reason text"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.delete_purchase_document_draft(p_document_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/delete_purchase_document_draft`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "delete_purchase_document_draft",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_document_id uuid",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_delete_purchase_document_draft_p_document_id uuid"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.extend_reservation(p_order_id uuid, p_minutes integer)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/extend_reservation`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "extend_reservation",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_order_id uuid, p_minutes integer",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_extend_reservation_p_order_id uuid, p_minutes integer"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.get_admin_customers_safe(p_store_id uuid, p_limit integer)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_admin_customers_safe`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "get_admin_customers_safe",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid, p_limit integer",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_get_admin_customers_safe_p_store_id uuid, p_limit integer"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.get_admin_loyalty_safe(p_store_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_admin_loyalty_safe`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "get_admin_loyalty_safe",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_get_admin_loyalty_safe_p_store_id uuid"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.get_admin_orders_safe(p_store_id uuid, p_status text, p_limit integer)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_admin_orders_safe`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "get_admin_orders_safe",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid, p_status text, p_limit integer",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_get_admin_orders_safe_p_store_id uuid, p_status text, p_limit integer"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.get_campaign_recipients_safe(p_store_id uuid, p_campaign_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_campaign_recipients_safe`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "get_campaign_recipients_safe",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid, p_campaign_id uuid",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_get_campaign_recipients_safe_p_store_id uuid, p_campaign_id uuid"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.get_cashbook_entries_safe(p_store_id uuid, p_limit integer)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_cashbook_entries_safe`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "get_cashbook_entries_safe",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid, p_limit integer",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_get_cashbook_entries_safe_p_store_id uuid, p_limit integer"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.get_cashbook_summary(p_store_id uuid, p_start_date date, p_end_date date)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_cashbook_summary`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "get_cashbook_summary",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid, p_start_date date, p_end_date date",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_get_cashbook_summary_p_store_id uuid, p_start_date date, p_end_date date"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.get_commercial_dashboard_safe(p_store_id uuid, p_start_date date, p_end_date date)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_commercial_dashboard_safe`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "get_commercial_dashboard_safe",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid, p_start_date date, p_end_date date",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_get_commercial_dashboard_safe_p_store_id uuid, p_start_date date, p_end_date date"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.get_current_user_store_permissions_v2(p_store_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_current_user_store_permissions_v2`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "get_current_user_store_permissions_v2",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_get_current_user_store_permissions_v2_p_store_id uuid"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.get_customer_360_safe(p_store_id uuid, p_customer_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_customer_360_safe`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "get_customer_360_safe",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid, p_customer_id uuid",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_get_customer_360_safe_p_store_id uuid, p_customer_id uuid"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.get_dashboard_orders_summary(p_store_id uuid, p_start_at timestamp with time zone, p_end_at timestamp with time zone)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_dashboard_orders_summary`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "get_dashboard_orders_summary",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid, p_start_at timestamp with time zone, p_end_at timestamp with time zone",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_get_dashboard_orders_summary_p_store_id uuid, p_start_at timestamp with time zone, p_end_at timestamp with time zone"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.get_dashboard_recent_orders(p_store_id uuid, p_limit integer)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_dashboard_recent_orders`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "get_dashboard_recent_orders",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid, p_limit integer",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_get_dashboard_recent_orders_p_store_id uuid, p_limit integer"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.get_default_admin_landing_path_v3(p_store_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_default_admin_landing_path_v3`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "get_default_admin_landing_path_v3",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_get_default_admin_landing_path_v3_p_store_id uuid"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.get_inventory_management_products(p_store_id uuid, p_recommended_action text, p_limit integer)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_inventory_management_products`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "get_inventory_management_products",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid, p_recommended_action text, p_limit integer",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_get_inventory_management_products_p_store_id uuid, p_recommended_action text, p_limit integer"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.get_inventory_position_by_store(p_store_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_inventory_position_by_store`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "get_inventory_position_by_store",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_get_inventory_position_by_store_p_store_id uuid"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.get_inventory_transit_by_store(p_store_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_inventory_transit_by_store`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "get_inventory_transit_by_store",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_get_inventory_transit_by_store_p_store_id uuid"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.get_login_store_options()` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_login_store_options`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "get_login_store_options",
      "schema": "public",
      "language": "sql",
      "arguments": "",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_get_login_store_options_"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.get_loyalty_advanced_settings_safe(p_store_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_loyalty_advanced_settings_safe`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "get_loyalty_advanced_settings_safe",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_get_loyalty_advanced_settings_safe_p_store_id uuid"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.get_marketing_center_safe(p_store_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_marketing_center_safe`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "get_marketing_center_safe",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_get_marketing_center_safe_p_store_id uuid"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.get_my_pending_store_invites()` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_my_pending_store_invites`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "get_my_pending_store_invites",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_get_my_pending_store_invites_"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.get_my_visible_activity_logs(p_store_id uuid, p_start_date date, p_end_date date, p_action text, p_outcome text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_my_visible_activity_logs`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "get_my_visible_activity_logs",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid, p_start_date date, p_end_date date, p_action text, p_outcome text",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_get_my_visible_activity_logs_p_store_id uuid, p_start_date date, p_end_date date, p_action text, p_outcome text"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.get_order_monitor_pending_orders(p_store_id uuid, p_since timestamp with time zone, p_limit integer)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_order_monitor_pending_orders`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "get_order_monitor_pending_orders",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid, p_since timestamp with time zone, p_limit integer",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_get_order_monitor_pending_orders_p_store_id uuid, p_since timestamp with time zone, p_limit integer"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.get_product_inventory_lifecycle(p_store_id uuid, p_product_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_product_inventory_lifecycle`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "get_product_inventory_lifecycle",
      "schema": "public",
      "language": "sql",
      "arguments": "p_store_id uuid, p_product_id uuid",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_get_product_inventory_lifecycle_p_store_id uuid, p_product_id uuid"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.get_product_stock_management(p_product_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_product_stock_management`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "get_product_stock_management",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_product_id uuid",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_get_product_stock_management_p_product_id uuid"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.get_product_stock_movements(p_store_id uuid, p_product_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_product_stock_movements`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "get_product_stock_movements",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid, p_product_id uuid",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_get_product_stock_movements_p_store_id uuid, p_product_id uuid"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.get_product_stock_rules_safe(p_store_id uuid, p_product_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_product_stock_rules_safe`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "get_product_stock_rules_safe",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid, p_product_id uuid",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_get_product_stock_rules_safe_p_store_id uuid, p_product_id uuid"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.get_product_transfer_divergences(p_product_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_product_transfer_divergences`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "get_product_transfer_divergences",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_product_id uuid",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_get_product_transfer_divergences_p_product_id uuid"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.get_product_transit_summary(p_product_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_product_transit_summary`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "get_product_transit_summary",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_product_id uuid",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_get_product_transit_summary_p_product_id uuid"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.get_purchase_quotation_detail(p_quotation_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_purchase_quotation_detail`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "get_purchase_quotation_detail",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_quotation_id uuid",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_get_purchase_quotation_detail_p_quotation_id uuid"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.get_purchase_quotations_by_store(p_store_id uuid, p_status text, p_limit integer)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_purchase_quotations_by_store`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "get_purchase_quotations_by_store",
      "schema": "public",
      "language": "sql",
      "arguments": "p_store_id uuid, p_status text, p_limit integer",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_get_purchase_quotations_by_store_p_store_id uuid, p_status text, p_limit integer"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.get_purchase_suggestions_by_store(p_store_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_purchase_suggestions_by_store`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "get_purchase_suggestions_by_store",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_get_purchase_suggestions_by_store_p_store_id uuid"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.get_sensitive_action_requirement(p_store_id uuid, p_action_code text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_sensitive_action_requirement`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "get_sensitive_action_requirement",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid, p_action_code text",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_get_sensitive_action_requirement_p_store_id uuid, p_action_code text"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.get_stock_movements_safe(p_store_id uuid, p_limit integer, p_offset integer)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_stock_movements_safe`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "get_stock_movements_safe",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid, p_limit integer, p_offset integer",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_get_stock_movements_safe_p_store_id uuid, p_limit integer, p_offset integer"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.get_stock_transfer_detail(p_transfer_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_stock_transfer_detail`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "get_stock_transfer_detail",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_transfer_id uuid",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_get_stock_transfer_detail_p_transfer_id uuid"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.get_stock_transfer_suggestions_by_store(p_store_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_stock_transfer_suggestions_by_store`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "get_stock_transfer_suggestions_by_store",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_get_stock_transfer_suggestions_by_store_p_store_id uuid"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.get_stock_transfers_by_store(p_store_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_stock_transfers_by_store`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "get_stock_transfers_by_store",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_get_stock_transfers_by_store_p_store_id uuid"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.get_store_config_admin(p_store_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_store_config_admin`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "get_store_config_admin",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_get_store_config_admin_p_store_id uuid"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.get_store_member_full_history(p_store_id uuid, p_member_id uuid, p_date_from date, p_date_to date, p_module text, p_action text, p_outcome text, p_search text, p_limit integer, p_offset integer)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_store_member_full_history`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "get_store_member_full_history",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid, p_member_id uuid, p_date_from date, p_date_to date, p_module text, p_action text, p_outcome text, p_search text, p_limit integer, p_offset integer",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_get_store_member_full_history_p_store_id uuid, p_member_id uuid, p_date_from date, p_date_to date, p_module text, p_action text, p_outcome text, p_search text, p_limit integer, p_offset integer"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.get_store_member_invites(p_store_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_store_member_invites`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "get_store_member_invites",
      "schema": "public",
      "language": "sql",
      "arguments": "p_store_id uuid",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_get_store_member_invites_p_store_id uuid"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.get_store_member_permission_detail(p_member_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_store_member_permission_detail`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "get_store_member_permission_detail",
      "schema": "public",
      "language": "sql",
      "arguments": "p_member_id uuid",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_get_store_member_permission_detail_p_member_id uuid"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.get_store_member_session_summary(p_store_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_store_member_session_summary`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "get_store_member_session_summary",
      "schema": "public",
      "language": "sql",
      "arguments": "p_store_id uuid",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_get_store_member_session_summary_p_store_id uuid"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.get_store_members_for_permissions(p_store_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_store_members_for_permissions`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "get_store_members_for_permissions",
      "schema": "public",
      "language": "sql",
      "arguments": "p_store_id uuid",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_get_store_members_for_permissions_p_store_id uuid"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.get_store_permission_matrix_v3(p_store_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_store_permission_matrix_v3`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "get_store_permission_matrix_v3",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_get_store_permission_matrix_v3_p_store_id uuid"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.get_store_security_activity_logs(p_store_id uuid, p_start_date date, p_end_date date, p_user_filter text, p_action_filter text, p_outcome text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_store_security_activity_logs`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "get_store_security_activity_logs",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid, p_start_date date, p_end_date date, p_user_filter text, p_action_filter text, p_outcome text",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_get_store_security_activity_logs_p_store_id uuid, p_start_date date, p_end_date date, p_user_filter text, p_action_filter text, p_outcome text"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.get_store_security_settings(p_store_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_store_security_settings`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "get_store_security_settings",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_get_store_security_settings_p_store_id uuid"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.get_store_sensitive_action_matrix(p_store_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_store_sensitive_action_matrix`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "get_store_sensitive_action_matrix",
      "schema": "public",
      "language": "sql",
      "arguments": "p_store_id uuid",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_get_store_sensitive_action_matrix_p_store_id uuid"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.get_store_settings_center(p_store_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_store_settings_center`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "get_store_settings_center",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_get_store_settings_center_p_store_id uuid"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.get_transfer_prefill_preview(p_product_id uuid, p_source_location_id uuid, p_destination_location_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_transfer_prefill_preview`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "get_transfer_prefill_preview",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_product_id uuid, p_source_location_id uuid, p_destination_location_id uuid",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_get_transfer_prefill_preview_p_product_id uuid, p_source_location_id uuid, p_destination_location_id uuid"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.get_user_store_by_id(p_user_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/get_user_store_by_id`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "get_user_store_by_id",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_user_id uuid",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_get_user_store_by_id_p_user_id uuid"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.insert_security_log(p_store_id uuid, p_user_id uuid, p_user_email text, p_action text, p_details jsonb, p_outcome text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/insert_security_log`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "insert_security_log",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid, p_user_id uuid, p_user_email text, p_action text, p_details jsonb, p_outcome text",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_insert_security_log_p_store_id uuid, p_user_id uuid, p_user_email text, p_action text, p_details jsonb, p_outcome text"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.is_store_member(p_store_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/is_store_member`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "is_store_member",
      "schema": "public",
      "language": "sql",
      "arguments": "p_store_id uuid",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_is_store_member_p_store_id uuid"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.is_store_owner(p_store_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/is_store_owner`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "is_store_owner",
      "schema": "public",
      "language": "sql",
      "arguments": "p_store_id uuid",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_is_store_owner_p_store_id uuid"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.list_product_stock_settings_safe(p_store_id uuid, p_search text, p_limit integer)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/list_product_stock_settings_safe`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "list_product_stock_settings_safe",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid, p_search text, p_limit integer",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_list_product_stock_settings_safe_p_store_id uuid, p_search text, p_limit integer"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.list_store_custom_roles(p_store_id uuid, p_include_inactive boolean)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/list_store_custom_roles`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "list_store_custom_roles",
      "schema": "public",
      "language": "sql",
      "arguments": "p_store_id uuid, p_include_inactive boolean",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_list_store_custom_roles_p_store_id uuid, p_include_inactive boolean"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.log_user_session_event(p_store_id uuid, p_action text, p_details jsonb, p_outcome text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/log_user_session_event`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "log_user_session_event",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid, p_action text, p_details jsonb, p_outcome text",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_log_user_session_event_p_store_id uuid, p_action text, p_details jsonb, p_outcome text"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.mark_campaign_recipient_manual_sent_safe(p_store_id uuid, p_recipient_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/mark_campaign_recipient_manual_sent_safe`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "mark_campaign_recipient_manual_sent_safe",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid, p_recipient_id uuid",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_mark_campaign_recipient_manual_sent_safe_p_store_id uuid, p_recipient_id uuid"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.prepare_campaign_recipients_safe(p_store_id uuid, p_campaign_id uuid, p_limit integer)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/prepare_campaign_recipients_safe`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "prepare_campaign_recipients_safe",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid, p_campaign_id uuid, p_limit integer",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_prepare_campaign_recipients_safe_p_store_id uuid, p_campaign_id uuid, p_limit integer"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.product_has_movements(p_product_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/product_has_movements`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "product_has_movements",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_product_id uuid",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_product_has_movements_p_product_id uuid"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.receive_stock_transfer(p_transfer_id uuid, p_items jsonb, p_notes text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/receive_stock_transfer`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "receive_stock_transfer",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_transfer_id uuid, p_items jsonb, p_notes text",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_receive_stock_transfer_p_transfer_id uuid, p_items jsonb, p_notes text"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.redeem_reward(p_customer_id uuid, p_reward_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/redeem_reward`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "redeem_reward",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_customer_id uuid, p_reward_id uuid",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_redeem_reward_p_customer_id uuid, p_reward_id uuid"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.reserve_order_stock(p_store_id uuid, p_order_id uuid, p_items public.order_item_reserve_input[], p_created_by uuid, p_metadata jsonb)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/reserve_order_stock`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "reserve_order_stock",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid, p_order_id uuid, p_items public.order_item_reserve_input[], p_created_by uuid, p_metadata jsonb",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_reserve_order_stock_p_store_id uuid, p_order_id uuid, p_items public.order_item_reserve_input[], p_created_by uuid, p_metadata jsonb"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.reserve_stock(p_order_id uuid, p_product_id uuid, p_quantity integer)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/reserve_stock`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "reserve_stock",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_order_id uuid, p_product_id uuid, p_quantity integer",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_reserve_stock_p_order_id uuid, p_product_id uuid, p_quantity integer"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.reserve_stock(p_store_id uuid, p_product_id uuid, p_quantity numeric, p_source_id uuid, p_created_by uuid, p_metadata jsonb)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/reserve_stock`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "reserve_stock",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid, p_product_id uuid, p_quantity numeric, p_source_id uuid, p_created_by uuid, p_metadata jsonb",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_reserve_stock_p_store_id uuid, p_product_id uuid, p_quantity numeric, p_source_id uuid, p_created_by uuid, p_metadata jsonb"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.reset_store_master_password(p_store_id uuid, p_new_password text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/reset_store_master_password`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "reset_store_master_password",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid, p_new_password text",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_reset_store_master_password_p_store_id uuid, p_new_password text"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.return_stock_after_confirm(p_store_id uuid, p_order_id uuid, p_product_id uuid, p_quantity numeric, p_created_by uuid, p_metadata jsonb)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/return_stock_after_confirm`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "return_stock_after_confirm",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid, p_order_id uuid, p_product_id uuid, p_quantity numeric, p_created_by uuid, p_metadata jsonb",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_return_stock_after_confirm_p_store_id uuid, p_order_id uuid, p_product_id uuid, p_quantity numeric, p_created_by uuid, p_metadata jsonb"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.return_stock_after_confirm(p_store_id uuid, p_product_id uuid, p_quantity numeric, p_order_id uuid, p_created_by uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/return_stock_after_confirm`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "return_stock_after_confirm",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid, p_product_id uuid, p_quantity numeric, p_order_id uuid, p_created_by uuid",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_return_stock_after_confirm_p_store_id uuid, p_product_id uuid, p_quantity numeric, p_order_id uuid, p_created_by uuid"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.send_admin_message(p_store_id uuid, p_title text, p_message text, p_recipient_ids uuid[], p_expires_in_days integer)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/send_admin_message`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "send_admin_message",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid, p_title text, p_message text, p_recipient_ids uuid[], p_expires_in_days integer",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_send_admin_message_p_store_id uuid, p_title text, p_message text, p_recipient_ids uuid[], p_expires_in_days integer"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.set_store_role_permission_v3(p_store_id uuid, p_role text, p_permission_code text, p_allowed boolean, p_reason text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/set_store_role_permission_v3`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "set_store_role_permission_v3",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid, p_role text, p_permission_code text, p_allowed boolean, p_reason text",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_set_store_role_permission_v3_p_store_id uuid, p_role text, p_permission_code text, p_allowed boolean, p_reason text"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.set_store_role_permissions_bulk_v3(p_store_id uuid, p_role text, p_changes jsonb, p_reason text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/set_store_role_permissions_bulk_v3`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "set_store_role_permissions_bulk_v3",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid, p_role text, p_changes jsonb, p_reason text",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_set_store_role_permissions_bulk_v3_p_store_id uuid, p_role text, p_changes jsonb, p_reason text"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.ship_stock_transfer(p_transfer_id uuid, p_notes text, p_use_transit boolean)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/ship_stock_transfer`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "ship_stock_transfer",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_transfer_id uuid, p_notes text, p_use_transit boolean",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_ship_stock_transfer_p_transfer_id uuid, p_notes text, p_use_transit boolean"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.update_admin_customer_safe(p_store_id uuid, p_customer_id uuid, p_full_name text, p_phone text, p_email text, p_cpf text, p_birth_date date, p_status text, p_tags text[], p_internal_notes text, p_marketing_consent boolean, p_loyalty_opt_in boolean)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/update_admin_customer_safe`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "update_admin_customer_safe",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid, p_customer_id uuid, p_full_name text, p_phone text, p_email text, p_cpf text, p_birth_date date, p_status text, p_tags text[], p_internal_notes text, p_marketing_consent boolean, p_loyalty_opt_in boolean",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_update_admin_customer_safe_p_store_id uuid, p_customer_id uuid, p_full_name text, p_phone text, p_email text, p_cpf text, p_birth_date date, p_status text, p_tags text[], p_internal_notes text, p_marketing_consent boolean, p_loyalty_opt_in boolean"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.update_product_stock_rules(p_store_id uuid, p_product_id uuid, p_min_stock numeric, p_max_stock numeric, p_rules jsonb)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/update_product_stock_rules`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "update_product_stock_rules",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid, p_product_id uuid, p_min_stock numeric, p_max_stock numeric, p_rules jsonb",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_update_product_stock_rules_p_store_id uuid, p_product_id uuid, p_min_stock numeric, p_max_stock numeric, p_rules jsonb"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.update_purchase_quotation_response(p_quotation_id uuid, p_items jsonb, p_status text, p_sent_channel text, p_responsible_name text, p_notes text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/update_purchase_quotation_response`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "update_purchase_quotation_response",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_quotation_id uuid, p_items jsonb, p_status text, p_sent_channel text, p_responsible_name text, p_notes text",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_update_purchase_quotation_response_p_quotation_id uuid, p_items jsonb, p_status text, p_sent_channel text, p_responsible_name text, p_notes text"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.update_store_commercial_settings(p_store_id uuid, p_public_store_enabled boolean, p_public_catalog_enabled boolean, p_slug text, p_minimum_order_value numeric, p_reservation_time_minutes integer, p_public_sales_location_id uuid, p_whatsapp_business text, p_main_email text, p_website text, p_social_media text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/update_store_commercial_settings`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "update_store_commercial_settings",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid, p_public_store_enabled boolean, p_public_catalog_enabled boolean, p_slug text, p_minimum_order_value numeric, p_reservation_time_minutes integer, p_public_sales_location_id uuid, p_whatsapp_business text, p_main_email text, p_website text, p_social_media text",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_update_store_commercial_settings_p_store_id uuid, p_public_store_enabled boolean, p_public_catalog_enabled boolean, p_slug text, p_minimum_order_value numeric, p_reservation_time_minutes integer, p_public_sales_location_id uuid, p_whatsapp_business text, p_main_email text, p_website text, p_social_media text"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.update_store_custom_role(p_custom_role_id uuid, p_name text, p_description text, p_base_role text, p_active boolean, p_permissions jsonb, p_sensitive_actions jsonb, p_reason text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/update_store_custom_role`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "update_store_custom_role",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_custom_role_id uuid, p_name text, p_description text, p_base_role text, p_active boolean, p_permissions jsonb, p_sensitive_actions jsonb, p_reason text",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_update_store_custom_role_p_custom_role_id uuid, p_name text, p_description text, p_base_role text, p_active boolean, p_permissions jsonb, p_sensitive_actions jsonb, p_reason text"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.update_store_idle_timeout_settings(p_store_id uuid, p_idle_timeout_enabled boolean, p_idle_timeout_minutes integer)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/update_store_idle_timeout_settings`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "update_store_idle_timeout_settings",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid, p_idle_timeout_enabled boolean, p_idle_timeout_minutes integer",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_update_store_idle_timeout_settings_p_store_id uuid, p_idle_timeout_enabled boolean, p_idle_timeout_minutes integer"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.update_store_member_avatar_url(p_member_id uuid, p_avatar_url text, p_reason text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/update_store_member_avatar_url`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "update_store_member_avatar_url",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_member_id uuid, p_avatar_url text, p_reason text",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_update_store_member_avatar_url_p_member_id uuid, p_avatar_url text, p_reason text"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.update_store_member_permissions(p_member_id uuid, p_permissions jsonb, p_sensitive_actions jsonb, p_reason text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/update_store_member_permissions`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "update_store_member_permissions",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_member_id uuid, p_permissions jsonb, p_sensitive_actions jsonb, p_reason text",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_update_store_member_permissions_p_member_id uuid, p_permissions jsonb, p_sensitive_actions jsonb, p_reason text"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.update_store_message_settings(p_store_id uuid, p_sms_gateway_token text, p_config jsonb)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/update_store_message_settings`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "update_store_message_settings",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid, p_sms_gateway_token text, p_config jsonb",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_update_store_message_settings_p_store_id uuid, p_sms_gateway_token text, p_config jsonb"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.update_store_message_settings_admin(p_store_id uuid, p_sms_gateway_token text, p_config jsonb)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/update_store_message_settings_admin`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "update_store_message_settings_admin",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid, p_sms_gateway_token text, p_config jsonb",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_update_store_message_settings_admin_p_store_id uuid, p_sms_gateway_token text, p_config jsonb"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.update_store_sensitive_action_rule(p_store_id uuid, p_action_code text, p_enabled boolean, p_requirement text, p_min_role text, p_token_enabled boolean, p_token_expiry_seconds integer, p_max_attempts integer, p_require_reason boolean, p_reason text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/update_store_sensitive_action_rule`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "update_store_sensitive_action_rule",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid, p_action_code text, p_enabled boolean, p_requirement text, p_min_role text, p_token_enabled boolean, p_token_expiry_seconds integer, p_max_attempts integer, p_require_reason boolean, p_reason text",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_update_store_sensitive_action_rule_p_store_id uuid, p_action_code text, p_enabled boolean, p_requirement text, p_min_role text, p_token_enabled boolean, p_token_expiry_seconds integer, p_max_attempts integer, p_require_reason boolean, p_reason text"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.update_store_settings_section(p_store_id uuid, p_section text, p_settings jsonb)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/update_store_settings_section`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "update_store_settings_section",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid, p_section text, p_settings jsonb",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_update_store_settings_section_p_store_id uuid, p_section text, p_settings jsonb"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.upsert_customer_benefit_rule_safe(p_store_id uuid, p_rule_id uuid, p_code text, p_name text, p_description text, p_benefit_type text, p_target_type text, p_target_tier_id uuid, p_target_customer_id uuid, p_target_tag text, p_discount_percent numeric, p_discount_amount numeric, p_bonus_points integer, p_free_delivery boolean, p_minimum_order_value numeric, p_max_uses_total integer, p_max_uses_per_customer integer, p_active boolean, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_conditions jsonb, p_metadata jsonb)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/upsert_customer_benefit_rule_safe`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "upsert_customer_benefit_rule_safe",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid, p_rule_id uuid, p_code text, p_name text, p_description text, p_benefit_type text, p_target_type text, p_target_tier_id uuid, p_target_customer_id uuid, p_target_tag text, p_discount_percent numeric, p_discount_amount numeric, p_bonus_points integer, p_free_delivery boolean, p_minimum_order_value numeric, p_max_uses_total integer, p_max_uses_per_customer integer, p_active boolean, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_conditions jsonb, p_metadata jsonb",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_upsert_customer_benefit_rule_safe_p_store_id uuid, p_rule_id uuid, p_code text, p_name text, p_description text, p_benefit_type text, p_target_type text, p_target_tier_id uuid, p_target_customer_id uuid, p_target_tag text, p_discount_percent numeric, p_discount_amount numeric, p_bonus_points integer, p_free_delivery boolean, p_minimum_order_value numeric, p_max_uses_total integer, p_max_uses_per_customer integer, p_active boolean, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_conditions jsonb, p_metadata jsonb"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.upsert_customer_segment_safe(p_store_id uuid, p_segment_id uuid, p_code text, p_name text, p_description text, p_segment_type text, p_active boolean, p_rules jsonb, p_metadata jsonb)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/upsert_customer_segment_safe`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "upsert_customer_segment_safe",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid, p_segment_id uuid, p_code text, p_name text, p_description text, p_segment_type text, p_active boolean, p_rules jsonb, p_metadata jsonb",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_upsert_customer_segment_safe_p_store_id uuid, p_segment_id uuid, p_code text, p_name text, p_description text, p_segment_type text, p_active boolean, p_rules jsonb, p_metadata jsonb"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.upsert_loyalty_point_rule_safe(p_store_id uuid, p_rule_id uuid, p_code text, p_name text, p_description text, p_trigger_event text, p_rule_type text, p_points_mode text, p_points_value numeric, p_priority integer, p_stackable boolean, p_active boolean, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_conditions jsonb, p_metadata jsonb)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/upsert_loyalty_point_rule_safe`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "upsert_loyalty_point_rule_safe",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid, p_rule_id uuid, p_code text, p_name text, p_description text, p_trigger_event text, p_rule_type text, p_points_mode text, p_points_value numeric, p_priority integer, p_stackable boolean, p_active boolean, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_conditions jsonb, p_metadata jsonb",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_upsert_loyalty_point_rule_safe_p_store_id uuid, p_rule_id uuid, p_code text, p_name text, p_description text, p_trigger_event text, p_rule_type text, p_points_mode text, p_points_value numeric, p_priority integer, p_stackable boolean, p_active boolean, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_conditions jsonb, p_metadata jsonb"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.upsert_promotion_campaign_safe(p_store_id uuid, p_campaign_id uuid, p_code text, p_name text, p_description text, p_campaign_type text, p_status text, p_target_type text, p_target_segment_id uuid, p_target_customer_id uuid, p_target_tag text, p_channel text, p_title text, p_message_template text, p_call_to_action text, p_landing_url text, p_benefit_rule_id uuid, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_scheduled_at timestamp with time zone, p_active boolean, p_conditions jsonb, p_metadata jsonb)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/upsert_promotion_campaign_safe`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "upsert_promotion_campaign_safe",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid, p_campaign_id uuid, p_code text, p_name text, p_description text, p_campaign_type text, p_status text, p_target_type text, p_target_segment_id uuid, p_target_customer_id uuid, p_target_tag text, p_channel text, p_title text, p_message_template text, p_call_to_action text, p_landing_url text, p_benefit_rule_id uuid, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_scheduled_at timestamp with time zone, p_active boolean, p_conditions jsonb, p_metadata jsonb",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_upsert_promotion_campaign_safe_p_store_id uuid, p_campaign_id uuid, p_code text, p_name text, p_description text, p_campaign_type text, p_status text, p_target_type text, p_target_segment_id uuid, p_target_customer_id uuid, p_target_tag text, p_channel text, p_title text, p_message_template text, p_call_to_action text, p_landing_url text, p_benefit_rule_id uuid, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_scheduled_at timestamp with time zone, p_active boolean, p_conditions jsonb, p_metadata jsonb"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.user_can_purchase_action(p_store_id uuid, p_action text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/user_can_purchase_action`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "user_can_purchase_action",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid, p_action text",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_user_can_purchase_action_p_store_id uuid, p_action text"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.user_has_store_permission(p_store_id uuid, p_permission_code text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/user_has_store_permission`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "user_has_store_permission",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid, p_permission_code text",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_user_has_store_permission_p_store_id uuid, p_permission_code text"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.user_has_store_permission_v2(p_store_id uuid, p_permission_code text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/user_has_store_permission_v2`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "user_has_store_permission_v2",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid, p_permission_code text",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_user_has_store_permission_v2_p_store_id uuid, p_permission_code text"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.user_owns_store(p_store_id uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/user_owns_store`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "user_owns_store",
      "schema": "public",
      "language": "sql",
      "arguments": "p_store_id uuid",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_user_owns_store_p_store_id uuid"
  },
  {
    "name": "authenticated_security_definer_function_executable",
    "title": "Signed-In Users Can Execute SECURITY DEFINER Function",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it.",
    "detail": "Function `public.validate_store_slug(p_store_id uuid, p_slug text)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/validate_store_slug`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable",
    "metadata": {
      "name": "validate_store_slug",
      "schema": "public",
      "language": "plpgsql",
      "arguments": "p_store_id uuid, p_slug text",
      "security_definer": true
    },
    "cache_key": "authenticated_security_definer_function_executable_public_validate_store_slug_p_store_id uuid, p_slug text"
  },
  {
    "name": "auth_leaked_password_protection",
    "title": "Leaked Password Protection Disabled",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Leaked password protection is currently disabled.",
    "detail": "Supabase Auth prevents the use of compromised passwords by checking against HaveIBeenPwned.org. Enable this feature to enhance security.",
    "cache_key": "auth_leaked_password_protection",
    "remediation": "https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection",
    "metadata": {
      "type": "auth",
      "entity": "Auth"
    }
  }
]